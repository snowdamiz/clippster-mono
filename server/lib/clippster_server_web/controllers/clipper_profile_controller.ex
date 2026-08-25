defmodule ClippsterServerWeb.ClipperProfileController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.Campaigns
  alias ClippsterServer.Social.ProviderMode
  alias ClippsterServer.Social.PostForMeConnectionSession
  alias ClippsterServer.Social.PostForMeConnectionSessions
  alias ClippsterServer.Social.PostForMeConnectionSync
  alias ClippsterServer.Social.Providers.PostForMe
  alias ClippsterServerWeb.OAuthCallbackTarget

  plug ClippsterServerWeb.AuthPlug

  # ============================================================================
  # Social Accounts
  # ============================================================================

  @doc """
  List social accounts for the current user.
  """
  def list_social_accounts(conn, _params) do
    user = conn.assigns.current_user
    accounts = PostForMeConnectionSync.sync_user_accounts_from_provider(user)

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
                 PostForMeConnectionSync.build_user_connect_session_attrs(
                   user,
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
                |> json(%{success: false, error: format_provider_error(error)})
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

  @doc """
  Get status for a Post For Me connection session (user scope).
  GET /user/social/connect-status?connection_id=...
  """
  def connect_status(conn, %{"connection_id" => connection_id}) do
    user = conn.assigns.current_user

    case PostForMeConnectionSessions.get_session(connection_id) do
      nil ->
        conn
        |> put_status(404)
        |> json(%{success: false, error: "Connection session not found"})

      %PostForMeConnectionSession{scope: "user", user_id: user_id} = session
      when user_id == user.id ->
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

      _ ->
        conn
        |> put_status(403)
        |> json(%{success: false, error: "Not authorized to access this connection session"})
    end
  end

  def connect_status(conn, _params) do
    conn
    |> put_status(422)
    |> json(%{success: false, error: "connection_id is required"})
  end

  @doc """
  Complete a Post For Me connection and upsert local user social accounts.
  """
  def complete_connect(conn, params) do
    user = conn.assigns.current_user

    with {:ok, session} <- load_user_session(params["connection_id"], user),
             :ok <- ensure_session_not_expired(session),
             platform <- resolved_platform(params, session),
             external_id <- resolved_external_id(params, session),
             account_ids <- resolved_account_ids(params, session),
             {:ok, result} <-
               PostForMeConnectionSync.complete_user_connect(
                 user,
                 account_ids,
                 external_id,
                 platform
               ) do
          _ =
            maybe_mark_user_session_synced(session, %{
              callback_payload: session && session.callback_payload,
              account_ids: result.account_ids
            })

          json(conn, %{
            success: true,
            provider: "post_for_me",
            platform: result.platform,
            social_account:
              result.primary_account && serialize_social_account(result.primary_account),
            social_accounts: Enum.map(result.accounts, &serialize_social_account/1)
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
      provider_status: provider_status(account),
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

  defp provider_status(%{is_active: true}), do: "connected"
  defp provider_status(%{is_active: false}), do: "disconnected"
  defp provider_status(_), do: nil

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

  defp load_user_session(nil, _user), do: {:ok, nil}
  defp load_user_session("", _user), do: {:ok, nil}

  defp load_user_session(connection_id, user) do
    case PostForMeConnectionSessions.get_session(connection_id) do
      nil ->
        {:error, :connection_not_found}

      %PostForMeConnectionSession{scope: "user", user_id: user_id} = session
      when user_id == user.id ->
        {:ok, session}

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

  defp maybe_mark_user_session_synced(nil, _attrs), do: :ok

  defp maybe_mark_user_session_synced(%PostForMeConnectionSession{} = session, attrs) do
    case PostForMeConnectionSessions.mark_synced(session, attrs) do
      {:ok, _updated} -> :ok
      {:error, _reason} -> :ok
    end
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
