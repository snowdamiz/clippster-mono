defmodule ClippsterServerWeb.TokendController do
  use ClippsterServerWeb, :controller

  require Logger

  alias ClippsterServer.Accounts
  alias ClippsterServer.Campaigns
  alias ClippsterServer.Organizations
  alias ClippsterServer.Social
  alias ClippsterServer.Social.PostForMeConnectionSession
  alias ClippsterServer.Social.PostForMeConnectionSessions
  alias ClippsterServer.Tokend.Client

  plug ClippsterServerWeb.AuthPlug
       when action in [
              :connect_user,
              :connect_org,
              :connect_url_user,
              :connect_url_org
            ]

  @session_ttl_seconds 900

  @doc """
  GET /api/tokend/channels/:slug
  """
  def get_channel(conn, %{"slug" => slug}) do
    case Client.creator_catalog(slug) do
      {:ok, catalog} ->
        json(conn, catalog)

      {:error, reason} ->
        conn
        |> put_status(:bad_gateway)
        |> json(%{error: inspect(reason)})
    end
  end

  @doc """
  GET /api/tokend/channels/:slug/live
  """
  def get_live_status(conn, %{"slug" => slug}) do
    {:ok, status} = Client.live_status(slug)
    json(conn, status)
  end

  @doc """
  GET /api/tokend/mode
  """
  def mode(conn, _params) do
    mode = Client.mode()

    json(conn, %{
      mode: mode,
      configured: mode in [:local, :live],
      oauth_ready: Client.oauth_ready?(),
      message: mode_message(mode)
    })
  end

  @doc """
  POST /api/user/tokend/connect-url

  Starts OAuth 2.1 + PKCE. Returns auth_url for the system browser.
  """
  def connect_url_user(conn, params) do
    user = conn.assigns.current_user

    case start_oauth_session(:user, user, nil, params) do
      {:ok, payload} ->
        json(conn, Map.put(payload, :success, true))

      {:error, :oauth_not_configured} ->
        oauth_not_configured(conn)

      {:error, reason} ->
        conn
        |> put_status(422)
        |> json(%{success: false, error: format_errors(reason)})
    end
  end

  @doc """
  POST /api/organizations/:org_id/tokend/connect-url
  """
  def connect_url_org(conn, %{"org_id" => org_id} = params) do
    user = conn.assigns.current_user

    with {id, ""} <- Integer.parse(to_string(org_id)),
         true <- Organizations.is_admin?(id, user.id) do
      case start_oauth_session(:org, user, id, params) do
        {:ok, payload} ->
          json(conn, Map.put(payload, :success, true))

        {:error, :oauth_not_configured} ->
          oauth_not_configured(conn)

        {:error, reason} ->
          conn
          |> put_status(422)
          |> json(%{success: false, error: format_errors(reason)})
      end
    else
      :error ->
        conn |> put_status(400) |> json(%{success: false, error: "Invalid organization id"})

      false ->
        conn |> put_status(403) |> json(%{success: false, error: "Admin only"})
    end
  end

  @doc """
  POST /api/user/tokend/connect

  Mock connect when OAuth is not configured (mock/local).
  When OAuth is ready, returns oauth_required so the client opens the browser flow.
  """
  def connect_user(conn, _params) do
    user = conn.assigns.current_user

    cond do
      Client.oauth_ready?() ->
        conn
        |> put_status(:conflict)
        |> json(%{
          success: false,
          error: "oauth_required",
          message: "Use Tokend OAuth connect-url to link your real Tokend account."
        })

      true ->
        case connect_mock_account(:user, user, nil) do
          {:ok, account} ->
            json(conn, %{success: true, social_account: serialize_user_account(account)})

          {:error, changeset} ->
            conn
            |> put_status(422)
            |> json(%{success: false, error: format_errors(changeset)})
        end
    end
  end

  @doc """
  POST /api/organizations/:org_id/tokend/connect
  """
  def connect_org(conn, %{"org_id" => org_id}) do
    user = conn.assigns.current_user

    with {id, ""} <- Integer.parse(to_string(org_id)),
         true <- Organizations.is_admin?(id, user.id) do
      cond do
        Client.oauth_ready?() ->
          conn
          |> put_status(:conflict)
          |> json(%{
            success: false,
            error: "oauth_required",
            message: "Use Tokend OAuth connect-url to link your real Tokend account."
          })

        true ->
          case connect_mock_account(:org, user, id) do
            {:ok, account} ->
              json(conn, %{success: true, social_account: serialize_org_account(account)})

            {:error, :unauthorized} ->
              conn |> put_status(403) |> json(%{success: false, error: "Not authorized"})

            {:error, changeset} ->
              conn
              |> put_status(422)
              |> json(%{success: false, error: format_errors(changeset)})
          end
      end
    else
      :error ->
        conn |> put_status(400) |> json(%{success: false, error: "Invalid organization id"})

      false ->
        conn |> put_status(403) |> json(%{success: false, error: "Admin only"})
    end
  end

  @doc """
  GET /api/auth/tokend/callback — OAuth redirect from Tokend web consent.
  """
  def oauth_callback(conn, params) do
    cond do
      is_binary(params["error"]) and params["error"] != "" ->
        handle_oauth_denied(conn, params)

      is_binary(params["code"]) and is_binary(params["state"]) ->
        handle_oauth_success(conn, params)

      true ->
        render_html_result(conn, false, "Missing authorization code or state.")
    end
  end

  defp start_oauth_session(scope, user, org_id, params) do
    unless Client.oauth_ready?() do
      {:error, :oauth_not_configured}
    else
      pkce = Client.generate_pkce()
      state = "tokend_" <> Base.url_encode64(:crypto.strong_rand_bytes(24), padding: false)
      scopes = Client.default_oauth_scopes()
      redirect_uri = Client.config()[:oauth_redirect_uri]
      return_mode = normalize_return_mode(params["return_mode"])

      session_attrs = %{
        scope: if(scope == :org, do: "org", else: "user"),
        user_id: user.id,
        organization_id: org_id,
        platform: "tokend",
        external_id: state,
        status: "pending",
        return_mode: return_mode,
        return_url: params["return_url"],
        expires_at: DateTime.utc_now() |> DateTime.add(@session_ttl_seconds, :second) |> DateTime.truncate(:second),
        callback_payload: %{
          "code_verifier" => pkce.code_verifier,
          "code_challenge" => pkce.code_challenge,
          "redirect_uri" => redirect_uri,
          "scopes" => scopes
        }
      }

      case PostForMeConnectionSessions.create_session(session_attrs) do
        {:ok, session} ->
          auth_url = Client.authorize_url(state, pkce.code_challenge, scopes)

          {:ok,
           %{
             connection_id: session.id,
             auth_url: auth_url,
             external_id: state,
             platform: "tokend",
             expires_at: session.expires_at
           }}

        {:error, changeset} ->
          {:error, changeset}
      end
    end
  end

  defp handle_oauth_denied(conn, params) do
    state = params["state"]
    message = params["error_description"] || params["error"] || "access_denied"

    if is_binary(state) and state != "" do
      case PostForMeConnectionSessions.get_session_by_external_id(state) do
        %PostForMeConnectionSession{} = session ->
          _ = PostForMeConnectionSessions.mark_failed(session, message, %{})

        _ ->
          :ok
      end
    end

    render_html_result(conn, false, "Tokend authorization was denied: #{message}")
  end

  defp handle_oauth_success(conn, %{"code" => code, "state" => state}) do
    with %PostForMeConnectionSession{} = session <-
           PostForMeConnectionSessions.get_session_by_external_id(state),
         :ok <- ensure_session_pending(session),
         verifier when is_binary(verifier) <-
           get_in(session.callback_payload || %{}, ["code_verifier"]),
         {:ok, tokens} <- Client.exchange_authorization_code(code, verifier),
         {:ok, me} <- Client.fetch_partner_me(tokens.access_token),
         {:ok, account} <- upsert_oauth_account(session, tokens, me),
         {:ok, synced} <-
           PostForMeConnectionSessions.mark_synced(session, %{
             success: true,
             account_ids: [to_string(account.id)],
             callback_payload:
               Map.merge(session.callback_payload || %{}, %{
                 "tokend_user_id" => me["id"],
                 "scopes" => tokens.scope
               })
           }) do
      Logger.info("[Tokend] OAuth linked account=#{account.id} session=#{synced.id}")
      render_html_result(conn, true, nil)
    else
      nil ->
        render_html_result(conn, false, "No pending Tokend connection session matched this callback.")

      {:error, :expired} ->
        render_html_result(conn, false, "This Tokend connection session expired. Try connecting again.")

      {:error, reason} ->
        mark_session_failed_by_state(state, reason)
        Logger.warning("[Tokend] OAuth callback failed: #{inspect(reason)}")
        render_html_result(conn, false, "Failed to complete Tokend connection: #{format_errors(reason)}")

      other ->
        mark_session_failed_by_state(state, other)
        render_html_result(conn, false, "Failed to complete Tokend connection.")
    end
  end

  defp ensure_session_pending(%PostForMeConnectionSession{} = session) do
    cond do
      PostForMeConnectionSessions.expired?(session) ->
        _ = PostForMeConnectionSessions.mark_expired(session)
        {:error, :expired}

      session.status in ["pending", "callback_received"] ->
        :ok

      true ->
        {:error, {:invalid_session_status, session.status}}
    end
  end

  defp upsert_oauth_account(%PostForMeConnectionSession{} = session, tokens, me) do
    provider_account_id = to_string(me["id"] || me[:id])
    display_name = me["display_name"] || me[:display_name]
    email = me["email"] || me[:email]
    username = derive_username(display_name, email, provider_account_id)
    web = Application.get_env(:clippster_server, :tokend, [])[:web_base_url] || "http://localhost:4100"

    expires_at =
      case tokens.expires_in do
        n when is_integer(n) and n > 0 ->
          DateTime.utc_now() |> DateTime.add(n, :second) |> DateTime.truncate(:second)

        _ ->
          nil
      end

    base_attrs = %{
      platform: "tokend",
      platform_user_id: provider_account_id,
      provider: "tokend",
      provider_platform: "tokend",
      provider_account_id: provider_account_id,
      username: username,
      display_name: display_name || username,
      profile_image_url: nil,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: expires_at,
      provider_payload: %{
        "mode" => "live",
        "tokend_user_id" => me["id"],
        "email" => email,
        "wallet" => me["wallet"],
        "scopes" => tokens.scope
      },
      is_active: true
    }

    case session.scope do
      "user" ->
        user = Accounts.get_user(session.user_id)
        attrs = Map.put(base_attrs, :profile_url, "#{String.trim_trailing(to_string(web), "/")}/#{username}")

        case {user, Campaigns.get_social_account_by_provider(session.user_id, "tokend", provider_account_id)} do
          {nil, _} ->
            {:error, :user_not_found}

          {user, nil} ->
            Campaigns.create_social_account(user, attrs)

          {user, existing} ->
            Campaigns.update_social_account(existing, attrs, user)
        end

      "org" ->
        user = Accounts.get_user(session.user_id)

        case {user,
              Social.get_social_account_by_provider(
                session.organization_id,
                "tokend",
                provider_account_id
              )} do
          {nil, _} ->
            {:error, :user_not_found}

          {user, nil} ->
            Social.create_social_account(session.organization_id, base_attrs, user)

          {_user, existing} ->
            Social.update_social_account(existing, base_attrs)
        end
    end
  end

  defp derive_username(display_name, email, fallback_id) do
    cond do
      is_binary(display_name) and String.trim(display_name) != "" ->
        display_name
        |> String.downcase()
        |> String.replace(~r/[^a-z0-9_.]/, "")
        |> case do
          "" -> email_username(email, fallback_id)
          name -> name
        end

      true ->
        email_username(email, fallback_id)
    end
  end

  defp email_username(email, fallback_id) when is_binary(email) do
    email
    |> String.split("@")
    |> List.first()
    |> to_string()
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9_.]/, "")
    |> case do
      "" -> "tokend_#{fallback_id}"
      name -> name
    end
  end

  defp email_username(_, fallback_id), do: "tokend_#{fallback_id}"

  defp mark_session_failed_by_state(state, reason) when is_binary(state) do
    case PostForMeConnectionSessions.get_session_by_external_id(state) do
      %PostForMeConnectionSession{} = session ->
        _ = PostForMeConnectionSessions.mark_failed(session, format_errors(reason), %{})

      _ ->
        :ok
    end
  end

  defp mark_session_failed_by_state(_, _), do: :ok

  defp connect_mock_account(scope, user, org_id) do
    mode = Client.mode()
    profile = Client.mock_connect_profile()
    web = Application.get_env(:clippster_server, :tokend, [])[:web_base_url] || "http://localhost:4100"

    attrs = %{
      platform: "tokend",
      platform_user_id: profile.provider_account_id,
      provider: "tokend",
      provider_platform: "tokend",
      provider_account_id: profile.provider_account_id,
      username: profile.username,
      display_name: profile.display_name,
      profile_image_url: profile.profile_image_url,
      profile_url: "#{String.trim_trailing(to_string(web), "/")}/seed-nova",
      access_token: profile.access_token,
      refresh_token: profile.refresh_token,
      provider_payload: %{
        "mode" => to_string(mode),
        "note" => profile.note
      },
      is_active: true
    }

    case scope do
      :user ->
        case Campaigns.get_social_account_by_provider(
               user.id,
               "tokend",
               profile.provider_account_id
             ) do
          nil -> Campaigns.create_social_account(user, attrs)
          existing -> Campaigns.update_social_account(existing, attrs, user)
        end

      :org ->
        case Social.get_social_account_by_provider(
               org_id,
               "tokend",
               profile.provider_account_id
             ) do
          nil -> Social.create_social_account(org_id, attrs, user)
          existing -> Social.update_social_account(existing, attrs)
        end
    end
  end

  defp oauth_not_configured(conn) do
    conn
    |> put_status(:service_unavailable)
    |> json(%{
      success: false,
      error: "configure_tokend",
      message:
        "Set TOKEND_API_BASE_URL, TOKEND_OAUTH_CLIENT_ID, TOKEND_OAUTH_CLIENT_SECRET, and TOKEND_OAUTH_REDIRECT_URI on Phoenix."
    })
  end

  defp normalize_return_mode(mode) when mode in ["dashboard", "tauri", "web"], do: mode
  defp normalize_return_mode(_), do: "tauri"

  defp render_html_result(conn, true, _error) do
    html = """
    <!DOCTYPE html>
    <html><body style="font-family:system-ui;padding:2rem;background:#0b1220;color:#e2e8f0">
      <h1 style="color:#22c55e">Tokend connected</h1>
      <p>You can close this tab and return to Clippster.</p>
    </body></html>
    """

    conn
    |> put_resp_content_type("text/html")
    |> send_resp(200, html)
  end

  defp render_html_result(conn, false, message) do
    safe = Plug.HTML.html_escape(to_string(message || "Connection failed"))

    html = """
    <!DOCTYPE html>
    <html><body style="font-family:system-ui;padding:2rem;background:#0b1220;color:#e2e8f0">
      <h1 style="color:#f87171">Tokend connection failed</h1>
      <p>#{safe}</p>
      <p>Close this tab and try again from Clippster.</p>
    </body></html>
    """

    conn
    |> put_resp_content_type("text/html")
    |> send_resp(400, html)
  end

  defp mode_message(:mock),
    do:
      "Mock mode — seed-shaped fixtures only (not production tokend.tv). Optional: TOKEND_API_BASE_URL=http://localhost:4101 after local seed-data."

  defp mode_message(:local),
    do: "Local mode — proxying TOKEND_API_BASE_URL (typically http://localhost:4101)."

  defp mode_message(:live),
    do:
      "Live mode — OAuth credentials present. Connect uses Tokend authorize/consent; catalog/status proxy API base."

  defp serialize_user_account(account) do
    %{
      id: account.id,
      platform: account.platform,
      platform_user_id: account.platform_user_id,
      provider: account.provider,
      provider_account_id: account.provider_account_id,
      username: account.username,
      display_name: account.display_name,
      profile_image_url: account.profile_image_url,
      profile_url: Map.get(account, :profile_url),
      is_active: account.is_active,
      connected_at: account.connected_at,
      inserted_at: account.inserted_at,
      updated_at: account.updated_at
    }
  end

  defp serialize_org_account(account) do
    %{
      id: account.id,
      platform: account.platform,
      platform_user_id: account.platform_user_id,
      provider: account.provider,
      provider_account_id: account.provider_account_id,
      username: account.username,
      display_name: account.display_name,
      profile_image_url: account.profile_image_url,
      is_active: account.is_active,
      connected_at: account.connected_at,
      inserted_at: account.inserted_at,
      updated_at: account.updated_at
    }
  end

  defp format_errors({:token_exchange_failed, 401, %{"error" => "invalid_client"}}) do
    "Tokend rejected the OAuth client secret (invalid_client). " <>
      "Update TOKEND_OAUTH_CLIENT_SECRET in server/.env to match the one-time secret from Tokend Admin for this client_id, then restart Phoenix."
  end

  defp format_errors(%Ecto.Changeset{} = changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {msg, opts} ->
      Regex.replace(~r"%{(\w+)}", msg, fn _, key ->
        opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
      end)
    end)
  end

  defp format_errors(other), do: inspect(other)
end
