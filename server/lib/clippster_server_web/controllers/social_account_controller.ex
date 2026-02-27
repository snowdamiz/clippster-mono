defmodule ClippsterServerWeb.SocialAccountController do
  @moduledoc """
  Controller for managing organization social accounts.
  Handles CRUD operations and account assignments.
  """
  use ClippsterServerWeb, :controller

  alias ClippsterServer.Social
  alias ClippsterServer.Social.ProviderMode
  alias ClippsterServer.Social.Providers.PostForMe
  alias ClippsterServer.Organizations

  plug ClippsterServerWeb.AuthPlug

  # ============================================================================
  # Social Account CRUD
  # ============================================================================

  @doc """
  List all social accounts for an organization.
  GET /organizations/:organization_id/social-accounts
  """
  def index(conn, %{"organization_id" => org_id} = params) do
    user = conn.assigns.current_user

    if Organizations.is_member?(org_id, user.id) do
      include_inactive = params["include_inactive"] == "true"

      accounts =
        Social.list_organization_social_accounts(org_id, include_inactive: include_inactive)

      json(conn, %{
        success: true,
        accounts: Enum.map(accounts, &serialize_account/1)
      })
    else
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Not a member of this organization"})
    end
  end

  @doc """
  Get a single social account.
  GET /organizations/:organization_id/social-accounts/:id
  """
  def show(conn, %{"organization_id" => org_id, "id" => account_id}) do
    user = conn.assigns.current_user

    if Organizations.is_member?(org_id, user.id) do
      case Social.get_social_account(org_id, account_id) do
        nil ->
          conn
          |> put_status(404)
          |> json(%{success: false, error: "Account not found"})

        account ->
          json(conn, %{
            success: true,
            account: serialize_account(account)
          })
      end
    else
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Not a member of this organization"})
    end
  end

  @doc """
  Create a new social account.
  POST /organizations/:organization_id/social-accounts

  For Instagram, the client obtains a Page Access Token via Facebook JavaScript SDK
  and sends it along with the Instagram account details.

  Admin only.
  """
  def create(conn, %{"organization_id" => org_id} = params) do
    user = conn.assigns.current_user

    # Free tier users cannot connect social accounts
    if is_free_tier?(user) do
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Social account posting requires a paid subscription"})
    else
      attrs =
        %{
          platform: params["platform"],
          platform_user_id: params["platform_user_id"],
          provider: params["provider"],
          provider_platform: params["provider_platform"],
          provider_account_id: params["provider_account_id"],
          provider_payload: params["provider_payload"],
          username: params["username"],
          display_name: params["display_name"],
          profile_image_url: params["profile_image_url"],
          access_token: params["access_token"],
          refresh_token: params["refresh_token"],
          token_expires_at: parse_datetime(params["token_expires_at"]),
          facebook_page_id: params["facebook_page_id"]
        }
        |> Enum.reject(fn {_, v} -> is_nil(v) end)
        |> Enum.into(%{})

      case Social.create_social_account(org_id, attrs, user) do
        {:ok, account} ->
          conn
          |> put_status(201)
          |> json(%{success: true, account: serialize_account(account)})

        {:error, :unauthorized} ->
          conn
          |> put_status(403)
          |> json(%{success: false, error: "Only admins can connect social accounts"})

        {:error, changeset} when is_struct(changeset, Ecto.Changeset) ->
          conn
          |> put_status(422)
          |> json(%{success: false, error: format_errors(changeset)})

        {:error, reason} ->
          conn
          |> put_status(400)
          |> json(%{success: false, error: to_string(reason)})
      end
    end
  end

  @doc """
  Generate a generic connect URL for Post For Me.
  POST /social/connect-url
  """
  def connect_url(conn, %{"organization_id" => org_id} = params) do
    user = conn.assigns.current_user

    cond do
      not ProviderMode.post_for_me_enabled?() ->
        conn
        |> put_status(400)
        |> json(%{
          success: false,
          error: "SOCIAL_PROVIDER_MODE must be post_for_me or dual to use this endpoint"
        })

      not Organizations.is_admin?(org_id, user.id) ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Only organization admins can connect social accounts"})

      true ->
        platform = ProviderMode.normalize_platform(params["platform"] || "")

        if platform == "" do
          conn
          |> put_status(422)
          |> json(%{success: false, error: "platform is required"})
        else
          permissions = parse_permissions(params["permissions"])
          external_id = params["external_id"] || default_external_id(org_id, user.id, platform)

          payload =
            %{
              platform: platform,
              external_id: external_id,
              redirect_url_override: params["redirect_url_override"],
              permissions: permissions,
              platform_data: params["platform_data"]
            }
            |> Enum.reject(fn {_, value} -> is_nil(value) end)
            |> Enum.into(%{})

          case PostForMe.create_social_account_auth_url(payload) do
            {:ok, auth_data} ->
              json(conn, %{
                success: true,
                provider: "post_for_me",
                platform: auth_data.platform,
                external_id: external_id,
                auth_url: auth_data.url
              })

            {:error, error} ->
              conn
              |> put_status(400)
              |> json(%{
                success: false,
                error: format_provider_error(error)
              })
          end
        end
    end
  end

  def connect_url(conn, _params) do
    conn
    |> put_status(422)
    |> json(%{success: false, error: "organization_id and platform are required"})
  end

  @doc """
  Complete a Post For Me connection and upsert local organization social accounts.
  POST /social/complete-connect
  """
  def complete_connect(conn, %{"organization_id" => org_id} = params) do
    user = conn.assigns.current_user

    cond do
      not ProviderMode.post_for_me_enabled?() ->
        conn
        |> put_status(400)
        |> json(%{
          success: false,
          error: "SOCIAL_PROVIDER_MODE must be post_for_me or dual to use this endpoint"
        })

      not Organizations.is_admin?(org_id, user.id) ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Only organization admins can complete social connects"})

      true ->
        platform = normalize_optional_platform(params["platform"])
        external_id = params["external_id"]
        account_ids = parse_account_ids(params)

        with {:ok, filters} <- build_post_for_me_filters(account_ids, external_id, platform),
             {:ok, listing} <- PostForMe.list_social_accounts(filters),
             {:ok, synced_accounts} <- upsert_org_accounts(org_id, user, listing.data, platform) do
          primary_account = pick_primary_account(synced_accounts, platform)

          json(conn, %{
            success: true,
            provider: "post_for_me",
            platform: primary_account && primary_account.platform,
            account: primary_account && serialize_account(primary_account),
            accounts: Enum.map(synced_accounts, &serialize_account/1)
          })
        else
          {:error, :missing_identifiers} ->
            conn
            |> put_status(422)
            |> json(%{
              success: false,
              error: "Provide at least one of: account_id/account_ids or external_id"
            })

          {:error, {:provider, reason}} ->
            conn
            |> put_status(400)
            |> json(%{success: false, error: format_provider_error(reason)})

          {:error, reason} ->
            conn
            |> put_status(400)
            |> json(%{success: false, error: format_provider_error(reason)})
        end
    end
  end

  def complete_connect(conn, _params) do
    conn
    |> put_status(422)
    |> json(%{success: false, error: "organization_id is required"})
  end

  @doc """
  Update a social account.
  PUT /organizations/:organization_id/social-accounts/:id
  Admin only.
  """
  def update(conn, %{"organization_id" => org_id, "id" => account_id} = params) do
    user = conn.assigns.current_user

    unless Organizations.is_admin?(org_id, user.id) do
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Only admins can update social accounts"})
    else
      case Social.get_social_account(org_id, account_id) do
        nil ->
          conn
          |> put_status(404)
          |> json(%{success: false, error: "Account not found"})

        account ->
          attrs =
            Map.take(params, [
              "display_name",
              "is_active",
              "platform",
              "provider",
              "provider_platform",
              "provider_account_id",
              "provider_payload"
            ])
            |> Enum.map(fn {k, v} -> {String.to_existing_atom(k), v} end)
            |> Enum.into(%{})

          case Social.update_social_account(account, attrs) do
            {:ok, updated} ->
              json(conn, %{success: true, account: serialize_account(updated)})

            {:error, changeset} when is_struct(changeset, Ecto.Changeset) ->
              conn
              |> put_status(422)
              |> json(%{success: false, error: format_errors(changeset)})

            {:error, reason} ->
              conn
              |> put_status(400)
              |> json(%{success: false, error: to_string(reason)})
          end
      end
    end
  end

  @doc """
  Delete a social account.
  DELETE /organizations/:organization_id/social-accounts/:id
  Admin only.
  """
  def delete(conn, %{"organization_id" => org_id, "id" => account_id}) do
    user = conn.assigns.current_user

    case Social.get_social_account(org_id, account_id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Account not found"})

      account ->
        case Social.delete_social_account(account, user) do
          {:ok, _} ->
            json(conn, %{success: true})

          {:error, :unauthorized} ->
            conn
            |> put_status(403)
            |> json(%{success: false, error: "Only admins can delete social accounts"})

          {:error, reason} ->
            conn
            |> put_status(400)
            |> json(%{success: false, error: to_string(reason)})
        end
    end
  end

  @doc """
  Manually trigger token refresh for an account.
  POST /organizations/:organization_id/social-accounts/:id/refresh
  Admin only.
  """
  def refresh_token(conn, %{"organization_id" => org_id, "id" => account_id}) do
    user = conn.assigns.current_user

    unless Organizations.is_admin?(org_id, user.id) do
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Only admins can refresh tokens"})
    else
      ClippsterServer.Social.TokenRefreshWorker.refresh_account(account_id)
      json(conn, %{success: true, message: "Token refresh initiated"})
    end
  end

  # ============================================================================
  # Account Assignments
  # ============================================================================

  @doc """
  List all assignments for a social account.
  GET /organizations/:organization_id/social-accounts/:id/assignments
  """
  def list_assignments(conn, %{"organization_id" => org_id, "id" => account_id}) do
    user = conn.assigns.current_user

    if Organizations.is_member?(org_id, user.id) do
      assignments = Social.list_account_assignments(org_id, account_id)

      json(conn, %{
        success: true,
        assignments: Enum.map(assignments, &serialize_assignment/1)
      })
    else
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Not a member of this organization"})
    end
  end

  @doc """
  Assign a social account to members.
  POST /organizations/:organization_id/social-accounts/:id/assignments
  Admin only.
  Body: { "user_ids": [1, 2, 3] }
  """
  def assign(conn, %{"organization_id" => org_id, "id" => account_id} = params) do
    user = conn.assigns.current_user
    user_ids = params["user_ids"] || []

    case Social.assign_social_account(org_id, account_id, user_ids, user) do
      {:ok, result} ->
        conn
        |> put_status(201)
        |> json(%{success: true, assigned: result.assigned, total: result.total})

      {:error, :unauthorized} ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Only admins can assign accounts"})

      {:error, :account_not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Account not found"})

      {:error, reason} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: to_string(reason)})
    end
  end

  @doc """
  Unassign a social account from a member.
  DELETE /organizations/:organization_id/social-accounts/:id/assignments/:user_id
  Admin only.
  """
  def unassign(conn, %{
        "organization_id" => org_id,
        "id" => account_id,
        "user_id" => target_user_id
      }) do
    user = conn.assigns.current_user

    case Social.unassign_social_account(org_id, account_id, target_user_id, user) do
      {:ok, _} ->
        json(conn, %{success: true})

      {:error, :unauthorized} ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Only admins can unassign accounts"})

      {:error, :account_not_found} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Account not found"})

      {:error, :not_assigned} ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "User is not assigned to this account"})

      {:error, reason} ->
        conn
        |> put_status(400)
        |> json(%{success: false, error: to_string(reason)})
    end
  end

  @doc """
  Get accounts assigned to the current user within an organization.
  GET /organizations/:organization_id/my-social-accounts
  """
  def my_accounts(conn, %{"organization_id" => org_id}) do
    user = conn.assigns.current_user

    if Organizations.is_member?(org_id, user.id) do
      accounts = Social.get_user_assigned_accounts(org_id, user.id)

      json(conn, %{
        success: true,
        accounts: Enum.map(accounts, &serialize_account/1)
      })
    else
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Not a member of this organization"})
    end
  end

  # ============================================================================
  # Private Helpers
  # ============================================================================

  defp serialize_account(account) do
    base = %{
      id: account.id,
      platform: account.platform,
      provider: account.provider,
      provider_platform: account.provider_platform,
      provider_account_id: account.provider_account_id,
      platform_user_id: account.platform_user_id,
      username: account.username,
      display_name: account.display_name,
      profile_image_url: account.profile_image_url,
      is_active: account.is_active,
      connected_at: account.connected_at,
      token_expires_at: account.token_expires_at,
      inserted_at: account.inserted_at,
      updated_at: account.updated_at
    }

    # Add assignments if loaded
    if Ecto.assoc_loaded?(account.assignments) do
      Map.put(base, :assignments, Enum.map(account.assignments, &serialize_assignment/1))
    else
      base
    end
  end

  defp serialize_assignment(assignment) do
    %{
      id: assignment.id,
      user_id: assignment.user_id,
      assigned_at: assignment.assigned_at,
      user: serialize_user(assignment.user),
      assigned_by:
        if(Ecto.assoc_loaded?(assignment.assigned_by_user) && assignment.assigned_by_user,
          do: serialize_user(assignment.assigned_by_user),
          else: nil
        )
    }
  end

  defp serialize_user(nil), do: nil

  defp serialize_user(user) do
    %{
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url
    }
  end

  defp parse_datetime(nil), do: nil

  defp parse_datetime(datetime_str) when is_binary(datetime_str) do
    case DateTime.from_iso8601(datetime_str) do
      {:ok, datetime, _} -> datetime
      _ -> nil
    end
  end

  defp parse_permissions(nil), do: ["posts"]

  defp parse_permissions(permissions) when is_list(permissions) do
    permissions
    |> Enum.filter(&is_binary/1)
    |> case do
      [] -> ["posts"]
      list -> list
    end
  end

  defp parse_permissions(permission) when is_binary(permission), do: [permission]
  defp parse_permissions(_), do: ["posts"]

  defp parse_account_ids(params) do
    [params["account_id"], params["account_ids"]]
    |> Enum.flat_map(&normalize_account_id_param/1)
    |> Enum.uniq()
  end

  defp normalize_account_id_param(nil), do: []

  defp normalize_account_id_param(value) when is_binary(value) do
    value
    |> String.split(",", trim: true)
    |> Enum.map(&String.trim/1)
    |> Enum.reject(&(&1 == ""))
  end

  defp normalize_account_id_param(value) when is_list(value) do
    Enum.flat_map(value, &normalize_account_id_param/1)
  end

  defp normalize_account_id_param(_), do: []

  defp normalize_optional_platform(nil), do: nil

  defp normalize_optional_platform(platform) when is_binary(platform) do
    case ProviderMode.normalize_platform(platform) do
      "" -> nil
      normalized -> normalized
    end
  end

  defp normalize_optional_platform(_), do: nil

  defp build_post_for_me_filters(account_ids, external_id, platform) do
    filters =
      %{}
      |> maybe_put_filter(:id, account_ids)
      |> maybe_put_filter(:external_id, external_id)
      |> maybe_put_filter(:platform, platform)

    if map_size(filters) == 0 do
      {:error, :missing_identifiers}
    else
      {:ok, filters}
    end
  end

  defp maybe_put_filter(filters, _key, nil), do: filters
  defp maybe_put_filter(filters, _key, []), do: filters

  defp maybe_put_filter(filters, key, value) do
    Map.put(filters, key, value)
  end

  defp upsert_org_accounts(org_id, user, provider_accounts, platform_override)
       when is_list(provider_accounts) do
    provider_accounts
    |> Enum.reduce_while({:ok, []}, fn provider_account, {:ok, acc} ->
      if provider_account.status == "disconnected" do
        {:cont, {:ok, acc}}
      else
        attrs = provider_account_to_org_attrs(provider_account, platform_override)

        case upsert_org_account(org_id, user, attrs) do
          {:ok, account} -> {:cont, {:ok, [account | acc]}}
          {:error, reason} -> {:halt, {:error, reason}}
        end
      end
    end)
    |> case do
      {:ok, accounts} -> {:ok, Enum.reverse(accounts)}
      other -> other
    end
  end

  defp upsert_org_account(org_id, user, attrs) do
    case Social.get_social_account_by_provider(org_id, "post_for_me", attrs.provider_account_id) do
      nil ->
        Social.create_social_account(org_id, attrs, user)

      existing ->
        Social.update_social_account(existing, attrs)
    end
  end

  defp provider_account_to_org_attrs(provider_account, platform_override) do
    normalized_platform =
      provider_account.platform
      |> normalize_optional_platform()
      |> case do
        nil -> platform_override || "x"
        platform -> platform
      end

    platform_user_id = provider_account.user_id || provider_account.id
    username = provider_account.username || platform_user_id || provider_account.id

    %{
      platform: normalized_platform,
      platform_user_id: platform_user_id,
      provider: "post_for_me",
      provider_platform: provider_account.platform || normalized_platform,
      provider_account_id: provider_account.id,
      provider_payload: provider_account.raw,
      username: username,
      display_name: provider_display_name(provider_account),
      profile_image_url: provider_account.profile_photo_url,
      is_active: provider_account.status != "disconnected"
    }
  end

  defp provider_display_name(%PostForMe.SocialAccount{metadata: metadata})
       when is_map(metadata) do
    metadata["display_name"] || metadata["name"] || metadata["full_name"]
  end

  defp provider_display_name(_), do: nil

  defp pick_primary_account([], _platform), do: nil
  defp pick_primary_account([first | _], nil), do: first

  defp pick_primary_account(accounts, platform) do
    Enum.find(accounts, fn account -> account.platform == platform end) || List.first(accounts)
  end

  defp default_external_id(org_id, user_id, platform) do
    timestamp = DateTime.utc_now() |> DateTime.to_unix()
    "org:#{org_id}:user:#{user_id}:platform:#{platform}:#{timestamp}"
  end

  defp format_provider_error(%PostForMe.ApiError{message: message}), do: message
  defp format_provider_error(other) when is_binary(other), do: other
  defp format_provider_error(other), do: inspect(other)

  defp format_errors(%Ecto.Changeset{} = changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
    |> Enum.map(fn {field, errors} -> "#{field}: #{Enum.join(errors, ", ")}" end)
    |> Enum.join("; ")
  end

  defp is_free_tier?(user) do
    if user.is_admin, do: false, else: user.subscription_status in [nil, "none", "expired"]
  end
end
