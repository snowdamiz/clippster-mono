defmodule ClippsterServerWeb.SocialAccountController do
  @moduledoc """
  Controller for managing organization social accounts.
  Handles CRUD operations and account assignments.
  """
  use ClippsterServerWeb, :controller

  alias ClippsterServer.Social
  alias ClippsterServer.Social.ProviderMode
  alias ClippsterServer.Social.PostForMeConnectionSession
  alias ClippsterServer.Social.PostForMeConnectionSessions
  alias ClippsterServer.Social.PostForMeConnectionSync
  alias ClippsterServer.Social.Providers.PostForMe
  alias ClippsterServer.Organizations
  alias ClippsterServerWeb.OAuthCallbackTarget

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
        org_id
        |> Social.list_organization_social_accounts(include_inactive: include_inactive)
        |> then(&PostForMeConnectionSync.sync_org_accounts_from_provider/1)

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

    if not Organizations.is_admin?(org_id, user.id) do
      conn
      |> put_status(403)
      |> json(%{success: false, error: "Only organization admins can connect social accounts"})
    else
      platform = ProviderMode.normalize_platform(params["platform"] || "")

      if platform == "" do
          conn
          |> put_status(422)
          |> json(%{success: false, error: "platform is required"})
        else
          permissions = parse_permissions(params["permissions"])
          return_mode = normalize_return_mode(params["return_mode"], "tauri")

          with {:ok, return_url} <- normalize_return_url(return_mode, params["return_url"]),
               {:ok, session_attrs} <-
                 PostForMeConnectionSync.build_org_connect_session_attrs(
                   org_id,
                   user.id,
                   platform,
                   params,
                   return_mode,
                   return_url
                 ),
               {:ok, session} <- PostForMeConnectionSessions.create_session(session_attrs) do
            payload =
              %{
                platform: platform,
                external_id: session.external_id,
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
                  external_id: session.external_id,
                  connection_id: session.id,
                  auth_url: auth_data.url
                })

              {:error, error} ->
                _ =
                  PostForMeConnectionSessions.mark_failed(
                    session,
                    format_provider_error(error)
                  )

                conn
                |> put_status(400)
                |> json(%{
                  success: false,
                  error: format_provider_error(error)
                })
            end
          else
            {:error, :return_url_required} ->
              conn
              |> put_status(422)
              |> json(%{success: false, error: "return_url is required when return_mode=web"})

            {:error, :invalid_return_url} ->
              conn
              |> put_status(422)
              |> json(%{success: false, error: "return_url is invalid or not allowed"})

            {:error, :account_not_found} ->
              conn
              |> put_status(404)
              |> json(%{success: false, error: "Social account not found"})

            {:error, :missing_provider_account_id} ->
              conn
              |> put_status(422)
              |> json(%{
                success: false,
                error: "This account cannot be refreshed. Disconnect and connect it again."
              })

            {:error, :missing_external_id} ->
              conn
              |> put_status(422)
              |> json(%{
                success: false,
                error: "Could not resolve Post For Me external id for this account"
              })

            {:error, :provider_account_not_found} ->
              conn
              |> put_status(404)
              |> json(%{success: false, error: "Post For Me account not found"})

            {:error, :missing_reconnect_account} ->
              conn
              |> put_status(422)
              |> json(%{
                success: false,
                error: "provider_account_id or social_account_id is required to refresh"
              })

            {:error, changeset} ->
              conn
              |> put_status(422)
              |> json(%{success: false, error: format_errors(changeset)})
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
  Get status for a Post For Me connection session (organization scope).
  GET /social/connect-status?organization_id=...&connection_id=...
  """
  def connect_status(conn, %{"organization_id" => org_id, "connection_id" => connection_id}) do
    user = conn.assigns.current_user

    cond do
      not Organizations.is_admin?(org_id, user.id) ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Only organization admins can view connect status"})

      true ->
        case PostForMeConnectionSessions.get_session(connection_id) do
          nil ->
            conn
            |> put_status(404)
            |> json(%{success: false, error: "Connection session not found"})

          %PostForMeConnectionSession{
            scope: "org",
            organization_id: session_org_id
          } = session ->
            if to_string(session_org_id) == to_string(org_id) do
              session = maybe_expire_session(session)

              json(conn, %{
                success: true,
                connection_id: session.id,
                status: session.status,
                session_success: session.success,
                error: session.error_message,
                external_id: session.external_id,
                platform: session.platform,
                account_ids: session.account_ids || []
              })
            else
              conn
              |> put_status(403)
              |> json(%{
                success: false,
                error: "Not authorized to access this connection session"
              })
            end

          _ ->
            conn
            |> put_status(403)
            |> json(%{success: false, error: "Not authorized to access this connection session"})
        end
    end
  end

  def connect_status(conn, _params) do
    conn
    |> put_status(422)
    |> json(%{success: false, error: "organization_id and connection_id are required"})
  end

  @doc """
  Complete a Post For Me connection and upsert local organization social accounts.
  POST /social/complete-connect
  """
  def complete_connect(conn, %{"organization_id" => org_id} = params) do
    user = conn.assigns.current_user

    cond do
      not Organizations.is_admin?(org_id, user.id) ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Only organization admins can complete social connects"})

      true ->
        with {:ok, session} <- load_org_session(params["connection_id"], org_id, user),
             :ok <- ensure_session_not_expired(session),
             platform <- resolved_platform(params, session),
             external_id <- resolved_external_id(params, session),
             account_ids <- resolved_account_ids(params, session),
             {:ok, result} <-
               PostForMeConnectionSync.complete_org_connect(
                 org_id,
                 user,
                 account_ids,
                 external_id,
                 platform
               ) do
          _ =
            maybe_mark_org_session_synced(session, %{
              callback_payload: session && session.callback_payload,
              account_ids: result.account_ids
            })

          json(conn, %{
            success: true,
            provider: "post_for_me",
            platform: result.platform,
            account: result.primary_account && serialize_account(result.primary_account),
            accounts: Enum.map(result.accounts, &serialize_account/1)
          })
        else
          {:error, :connection_not_found} ->
            conn
            |> put_status(404)
            |> json(%{success: false, error: "Connection session not found"})

          {:error, :forbidden_connection} ->
            conn
            |> put_status(403)
            |> json(%{success: false, error: "Not authorized to complete this connection"})

          {:error, :expired_connection} ->
            conn
            |> put_status(408)
            |> json(%{success: false, error: "Connection session expired"})

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
      provider_status: provider_status(account),
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

  defp provider_status(%{is_active: true}), do: "connected"
  defp provider_status(%{is_active: false}), do: "disconnected"
  defp provider_status(_), do: nil

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
    PostForMeConnectionSync.parse_account_ids(params)
  end

  defp normalize_return_mode(nil, default), do: default

  defp normalize_return_mode(mode, default) when is_binary(mode) do
    normalized = mode |> String.trim() |> String.downcase()
    if normalized in PostForMeConnectionSession.return_modes(), do: normalized, else: default
  end

  defp normalize_return_mode(_, default), do: default

  defp normalize_return_url("web", nil), do: {:error, :return_url_required}

  defp normalize_return_url("web", return_url) when is_binary(return_url) do
    case OAuthCallbackTarget.normalize_web_redirect_uri(return_url) do
      {:ok, safe_url} -> {:ok, safe_url}
      {:error, _reason} -> {:error, :invalid_return_url}
    end
  end

  defp normalize_return_url(_return_mode, _return_url), do: {:ok, nil}

  defp load_org_session(nil, _org_id, _user), do: {:ok, nil}
  defp load_org_session("", _org_id, _user), do: {:ok, nil}

  defp load_org_session(connection_id, org_id, _user) do
    case PostForMeConnectionSessions.get_session(connection_id) do
      nil ->
        {:error, :connection_not_found}

      %PostForMeConnectionSession{
        scope: "org",
        organization_id: session_org_id
      } = session ->
        if to_string(session_org_id) == to_string(org_id) do
          {:ok, session}
        else
          {:error, :forbidden_connection}
        end

      _ ->
        {:error, :forbidden_connection}
    end
  end

  defp ensure_session_not_expired(nil), do: :ok

  defp ensure_session_not_expired(%PostForMeConnectionSession{} = session) do
    if PostForMeConnectionSessions.expired?(session) and
         session.status in ["pending", "callback_received"] do
      _ = PostForMeConnectionSessions.mark_expired(session)
      {:error, :expired_connection}
    else
      :ok
    end
  end

  defp resolved_platform(params, nil) do
    PostForMeConnectionSync.normalize_optional_platform(params["platform"])
  end

  defp resolved_platform(params, session) do
    PostForMeConnectionSync.normalize_optional_platform(params["platform"] || session.platform)
  end

  defp resolved_external_id(params, nil), do: params["external_id"]
  defp resolved_external_id(params, session), do: params["external_id"] || session.external_id

  defp resolved_account_ids(params, nil), do: parse_account_ids(params)

  defp resolved_account_ids(params, session) do
    parsed = parse_account_ids(params)

    if parsed == [] do
      session.account_ids ||
        PostForMeConnectionSync.extract_account_ids_from_payload(session.callback_payload)
    else
      parsed
    end
  end

  defp maybe_expire_session(%PostForMeConnectionSession{} = session) do
    if PostForMeConnectionSessions.expired?(session) and
         session.status in ["pending", "callback_received"] do
      case PostForMeConnectionSessions.mark_expired(session) do
        {:ok, updated} -> updated
        {:error, _} -> session
      end
    else
      session
    end
  end

  defp maybe_mark_org_session_synced(nil, _attrs), do: :ok

  defp maybe_mark_org_session_synced(%PostForMeConnectionSession{} = session, attrs) do
    case PostForMeConnectionSessions.mark_synced(session, attrs) do
      {:ok, _updated} -> :ok
      {:error, _reason} -> :ok
    end
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
