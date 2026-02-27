defmodule ClippsterServerWeb.ClipperProfileController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.Campaigns
  alias ClippsterServer.Social.ProviderMode
  alias ClippsterServer.Social.Providers.PostForMe

  plug ClippsterServerWeb.AuthPlug

  # ============================================================================
  # Social Accounts
  # ============================================================================

  @doc """
  List social accounts for the current user.
  """
  def list_social_accounts(conn, _params) do
    user = conn.assigns.current_user
    accounts = Campaigns.list_user_social_accounts(user.id)

    json(conn, %{
      success: true,
      social_accounts: Enum.map(accounts, &serialize_social_account/1)
    })
  end

  @doc """
  Generate a generic Post For Me connect URL for the current user.
  """
  def connect_url(conn, params) do
    user = conn.assigns.current_user

    cond do
      not ProviderMode.post_for_me_enabled?() ->
        conn
        |> put_status(400)
        |> json(%{
          success: false,
          error: "SOCIAL_PROVIDER_MODE must be post_for_me or dual to use this endpoint"
        })

      true ->
        platform = ProviderMode.normalize_platform(params["platform"] || "")

        if platform == "" do
          conn
          |> put_status(422)
          |> json(%{success: false, error: "platform is required"})
        else
          permissions = parse_permissions(params["permissions"])
          external_id = params["external_id"] || default_user_external_id(user.id, platform)

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
              |> json(%{success: false, error: format_provider_error(error)})
          end
        end
    end
  end

  @doc """
  Complete a Post For Me connection and upsert local user social accounts.
  """
  def complete_connect(conn, params) do
    user = conn.assigns.current_user

    cond do
      not ProviderMode.post_for_me_enabled?() ->
        conn
        |> put_status(400)
        |> json(%{
          success: false,
          error: "SOCIAL_PROVIDER_MODE must be post_for_me or dual to use this endpoint"
        })

      true ->
        platform = normalize_optional_platform(params["platform"])
        external_id = params["external_id"]
        account_ids = parse_account_ids(params)

        with {:ok, filters} <- build_post_for_me_filters(account_ids, external_id, platform),
             {:ok, listing} <- PostForMe.list_social_accounts(filters),
             {:ok, synced_accounts} <- upsert_user_accounts(user, listing.data, platform) do
          primary_account = pick_primary_account(synced_accounts, platform)

          json(conn, %{
            success: true,
            provider: "post_for_me",
            platform: primary_account && primary_account.platform,
            social_account: primary_account && serialize_social_account(primary_account),
            social_accounts: Enum.map(synced_accounts, &serialize_social_account/1)
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

  @doc """
  Create a social account.
  """
  def create_social_account(conn, params) do
    user = conn.assigns.current_user

    attrs = %{
      platform: Map.get(params, "platform"),
      platform_user_id: Map.get(params, "platform_user_id"),
      username: Map.get(params, "username"),
      display_name: Map.get(params, "display_name"),
      profile_url: Map.get(params, "profile_url"),
      follower_count: Map.get(params, "follower_count")
    }

    case Campaigns.create_social_account(user, attrs) do
      {:ok, account} ->
        json(conn, %{
          success: true,
          social_account: serialize_social_account(account)
        })

      {:error, changeset} ->
        conn
        |> put_status(422)
        |> json(%{success: false, error: format_errors(changeset)})
    end
  end

  @doc """
  Update a social account.
  """
  def update_social_account(conn, %{"id" => id} = params) do
    user = conn.assigns.current_user

    case Campaigns.get_social_account(id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Social account not found"})

      account ->
        attrs = Map.take(params, ["username", "display_name", "profile_url", "follower_count"])

        case Campaigns.update_social_account(account, attrs, user) do
          {:ok, updated} ->
            json(conn, %{
              success: true,
              social_account: serialize_social_account(updated)
            })

          {:error, :unauthorized} ->
            conn
            |> put_status(403)
            |> json(%{success: false, error: "Not authorized"})

          {:error, changeset} ->
            conn
            |> put_status(422)
            |> json(%{success: false, error: format_errors(changeset)})
        end
    end
  end

  @doc """
  Delete a social account.
  """
  def delete_social_account(conn, %{"id" => id}) do
    user = conn.assigns.current_user

    case Campaigns.get_social_account(id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Social account not found"})

      account ->
        case Campaigns.delete_social_account(account, user) do
          {:ok, _} ->
            json(conn, %{success: true})

          {:error, :unauthorized} ->
            conn
            |> put_status(403)
            |> json(%{success: false, error: "Not authorized"})
        end
    end
  end

  # ============================================================================
  # Payment Methods
  # ============================================================================

  @doc """
  List payment methods for the current user.
  """
  def list_payment_methods(conn, _params) do
    user = conn.assigns.current_user
    methods = Campaigns.list_user_payment_methods(user.id)

    json(conn, %{
      success: true,
      payment_methods: Enum.map(methods, &serialize_payment_method/1)
    })
  end

  @doc """
  Create a payment method.
  """
  def create_payment_method(conn, params) do
    user = conn.assigns.current_user

    attrs = %{
      method_type: Map.get(params, "method_type"),
      details: encode_details(Map.get(params, "details")),
      is_default: Map.get(params, "is_default", false)
    }

    case Campaigns.create_payment_method(user, attrs) do
      {:ok, method} ->
        json(conn, %{
          success: true,
          payment_method: serialize_payment_method(method)
        })

      {:error, changeset} ->
        conn
        |> put_status(422)
        |> json(%{success: false, error: format_errors(changeset)})
    end
  end

  @doc """
  Update a payment method.
  """
  def update_payment_method(conn, %{"id" => id} = params) do
    user = conn.assigns.current_user

    case Campaigns.get_payment_method(id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Payment method not found"})

      method ->
        attrs = %{}

        attrs =
          if Map.has_key?(params, "details"),
            do: Map.put(attrs, :details, encode_details(Map.get(params, "details"))),
            else: attrs

        attrs =
          if Map.has_key?(params, "is_default"),
            do: Map.put(attrs, :is_default, Map.get(params, "is_default")),
            else: attrs

        case Campaigns.update_payment_method(method, attrs, user) do
          {:ok, updated} ->
            json(conn, %{
              success: true,
              payment_method: serialize_payment_method(updated)
            })

          {:error, :unauthorized} ->
            conn
            |> put_status(403)
            |> json(%{success: false, error: "Not authorized"})

          {:error, changeset} ->
            conn
            |> put_status(422)
            |> json(%{success: false, error: format_errors(changeset)})
        end
    end
  end

  @doc """
  Delete a payment method.
  """
  def delete_payment_method(conn, %{"id" => id}) do
    user = conn.assigns.current_user

    case Campaigns.get_payment_method(id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Payment method not found"})

      method ->
        case Campaigns.delete_payment_method(method, user) do
          {:ok, _} ->
            json(conn, %{success: true})

          {:error, :unauthorized} ->
            conn
            |> put_status(403)
            |> json(%{success: false, error: "Not authorized"})
        end
    end
  end

  # ============================================================================
  # Serializers
  # ============================================================================

  defp serialize_social_account(account) do
    %{
      id: account.id,
      platform: account.platform,
      provider: account.provider,
      provider_platform: account.provider_platform,
      provider_account_id: account.provider_account_id,
      platform_user_id: account.platform_user_id,
      username: account.username,
      display_name: account.display_name,
      profile_image_url: account.profile_image_url,
      profile_url: account.profile_url,
      follower_count: account.follower_count,
      is_verified: account.is_verified,
      is_active: account.is_active,
      token_expires_at: account.token_expires_at,
      connected_at: account.connected_at,
      inserted_at: account.inserted_at,
      updated_at: account.updated_at
    }
  end

  defp serialize_payment_method(method) do
    %{
      id: method.id,
      method_type: method.method_type,
      details: decode_details(method.details),
      is_default: method.is_default,
      inserted_at: method.inserted_at,
      updated_at: method.updated_at
    }
  end

  # ============================================================================
  # Helpers
  # ============================================================================

  defp format_errors(%Ecto.Changeset{} = changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Enum.reduce(opts, msg, fn {key, value}, acc ->
        String.replace(acc, "%{#{key}}", to_string(value))
      end)
    end)
  end

  defp format_errors(error) when is_binary(error), do: error
  defp format_errors(error), do: inspect(error)

  defp format_provider_error(%PostForMe.ApiError{message: message}), do: message
  defp format_provider_error(other) when is_binary(other), do: other
  defp format_provider_error(other), do: inspect(other)

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
  defp maybe_put_filter(filters, key, value), do: Map.put(filters, key, value)

  defp upsert_user_accounts(user, provider_accounts, platform_override)
       when is_list(provider_accounts) do
    provider_accounts
    |> Enum.reduce_while({:ok, []}, fn provider_account, {:ok, acc} ->
      if provider_account.status == "disconnected" do
        {:cont, {:ok, acc}}
      else
        attrs = provider_account_to_user_attrs(provider_account, platform_override)

        case upsert_user_account(user, attrs) do
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

  defp upsert_user_account(user, attrs) do
    case Campaigns.get_social_account_by_provider(
           user.id,
           "post_for_me",
           attrs.provider_account_id
         ) do
      nil ->
        Campaigns.create_social_account(user, attrs)

      existing ->
        Campaigns.update_social_account(existing, attrs, user)
    end
  end

  defp provider_account_to_user_attrs(provider_account, platform_override) do
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

  defp default_user_external_id(user_id, platform) do
    timestamp = DateTime.utc_now() |> DateTime.to_unix()
    "user:#{user_id}:platform:#{platform}:#{timestamp}"
  end

  defp encode_details(nil), do: nil

  defp encode_details(details) when is_map(details) do
    Jason.encode!(details)
  end

  defp encode_details(details) when is_binary(details), do: details

  defp decode_details(nil), do: nil

  defp decode_details(details) when is_binary(details) do
    case Jason.decode(details) do
      {:ok, decoded} -> decoded
      _ -> %{}
    end
  end

  defp decode_details(_), do: %{}
end
