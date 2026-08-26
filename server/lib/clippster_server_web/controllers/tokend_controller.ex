defmodule ClippsterServerWeb.TokendController do
  use ClippsterServerWeb, :controller

  require Logger

  alias ClippsterServer.Accounts
  alias ClippsterServer.Campaigns
  alias ClippsterServer.Organizations
  alias ClippsterServer.Social
  alias ClippsterServer.Social.PostForMeConnectionSession
  alias ClippsterServer.Social.PostForMeConnectionSessions
  alias ClippsterServer.Tokend.{AccountTokens, Client, Webhooks}

  plug ClippsterServerWeb.AuthPlug
       when action in [
              :connect_user,
              :connect_org,
              :connect_url_user,
              :connect_url_org,
              :partner_catalog,
              :create_media_grant,
              :redeem_media_grant,
              :create_viewer_token
            ]

  @session_ttl_seconds 900

  @doc """
  GET /api/tokend/channels/:slug
  """
  def get_channel(conn, %{"slug" => slug}) do
    case Client.creator_catalog(slug) do
      {:ok, catalog} ->
        json(conn, catalog)

      {:error, :invalid_slug} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "invalid_slug"})

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
    case Client.live_status(slug) do
      {:ok, status} ->
        json(conn, status)

      {:error, :invalid_slug} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "invalid_slug"})

      {:error, reason} ->
        conn
        |> put_status(:bad_gateway)
        |> json(%{error: inspect(reason)})
    end
  end

  @doc """
  GET /api/tokend/mode
  """
  def mode(conn, _params) do
    mode = Client.mode()
    oauth = Client.oauth_configuration()
    capabilities = Client.capabilities()

    json(conn, %{
      mode: mode,
      configured: mode in [:local, :live],
      oauth_enabled: oauth.enabled,
      oauth_ready: oauth.ready,
      oauth_configured: oauth.configured,
      oauth_incomplete: oauth.incomplete,
      missing_oauth_configuration: oauth.missing,
      capabilities: %{
        public_catalog: capabilities.public_catalog,
        live_status: capabilities.live_status,
        oauth_connect: capabilities.oauth_connect,
        mock_connect: capabilities.mock_connect,
        publish: capabilities.publish,
        schedule: capabilities.schedule,
        download: capabilities.download,
        watch: capabilities.watch,
        dvr: capabilities.dvr,
        analytics: capabilities.analytics,
        webhooks: capabilities.webhooks
      },
      message: mode_message(mode, oauth)
    })
  end

  @doc """
  POST /api/tokend/webhook — Tokend partner webhook receiver.
  """
  def webhook(conn, _params) do
    case Webhooks.verify_and_parse(conn) do
      {:ok, event} ->
        case Webhooks.ingest(event) do
          {:ok, :processed} ->
            json(conn, %{success: true, status: "processed"})

          {:ok, :duplicate} ->
            json(conn, %{success: true, status: "duplicate"})

          {:error, reason} ->
            Logger.warning("[Tokend] webhook ingest failed: #{inspect(reason)}")

            conn
            |> put_status(422)
            |> json(%{success: false, error: "ingest_failed"})
        end

      {:error, :missing_raw_body} ->
        conn |> put_status(400) |> json(%{success: false, error: "missing_raw_body"})

      {:error, :webhook_secret_not_configured} ->
        conn |> put_status(503) |> json(%{success: false, error: "webhook_not_configured"})

      {:error, :missing_signature_headers} ->
        conn |> put_status(401) |> json(%{success: false, error: "missing_signature"})

      {:error, :timestamp_skew} ->
        conn |> put_status(401) |> json(%{success: false, error: "timestamp_skew"})

      {:error, :invalid_signature} ->
        conn |> put_status(401) |> json(%{success: false, error: "invalid_signature"})

      {:error, :invalid_json} ->
        conn |> put_status(400) |> json(%{success: false, error: "invalid_json"})

      {:error, reason} ->
        conn |> put_status(400) |> json(%{success: false, error: inspect(reason)})
    end
  end

  @doc """
  GET /api/user/tokend/catalog/:slug — partner catalog with public fallback.
  """
  def partner_catalog(conn, %{"slug" => slug}) do
    user = conn.assigns.current_user

    with {:ok, account} <- get_user_tokend_account(user.id),
         {:ok, %{access_token: access_token}} <- AccountTokens.ensure_fresh_access_token(account),
         {:ok, catalog} <- Client.partner_creator_catalog(access_token, slug) do
      json(conn, catalog)
    else
      {:error, :not_found} ->
        conn |> put_status(404) |> json(%{error: "Tokend account not connected"})

      {:error, :oauth_not_ready} ->
        oauth_not_configured(conn)

      {:error, reason} ->
        conn |> put_status(502) |> json(%{error: inspect(reason)})
    end
  end

  @doc """
  POST /api/user/tokend/media/:type/:id/grants
  """
  def create_media_grant(conn, %{"type" => type, "id" => id} = params) do
    user = conn.assigns.current_user
    purpose = params["purpose"] || "download"

    with {:ok, account} <- get_user_tokend_account(user.id),
         {:ok, %{access_token: access_token}} <- AccountTokens.ensure_fresh_access_token(account),
         {:ok, grant} <- Client.create_media_grant(access_token, type, id, purpose) do
      json(conn, %{
        success: true,
        token: grant.token,
        expires_at: grant.expires_at,
        download_url: "/api/user/tokend/media/grants/#{grant.token}"
      })
    else
      {:error, :not_found} ->
        conn |> put_status(404) |> json(%{success: false, error: "Tokend account not connected"})

      {:error, :oauth_not_ready} ->
        oauth_not_configured(conn)

      {:error, reason} ->
        conn |> put_status(502) |> json(%{success: false, error: inspect(reason)})
    end
  end

  @doc """
  GET /api/user/tokend/media/grants/:token — proxy grant redeem (Bearer stays on Phoenix).
  """
  def redeem_media_grant(conn, %{"token" => token}) do
    user = conn.assigns.current_user

    with {:ok, account} <- get_user_tokend_account(user.id),
         {:ok, %{access_token: access_token}} <- AccountTokens.ensure_fresh_access_token(account),
         {:ok, result} <- Client.redeem_media_grant(access_token, token) do
      case result do
        {:redirect, url} ->
          redirect(conn, external: url)

        {:body, body, content_type} ->
          conn
          |> put_resp_content_type(content_type)
          |> send_resp(200, body)
      end
    else
      {:error, :not_found} ->
        conn |> put_status(404) |> json(%{success: false, error: "Tokend account not connected"})

      {:error, :oauth_not_ready} ->
        oauth_not_configured(conn)

      {:error, reason} ->
        conn |> put_status(502) |> json(%{success: false, error: inspect(reason)})
    end
  end

  @doc """
  POST /api/user/tokend/streams/:id/viewer-token
  """
  def create_viewer_token(conn, %{"id" => stream_id}) do
    user = conn.assigns.current_user

    with {:ok, account} <- get_user_tokend_account(user.id),
         {:ok, %{access_token: access_token}} <- AccountTokens.ensure_fresh_access_token(account),
         {:ok, viewer} <- Client.create_viewer_token(access_token, stream_id) do
      json(conn, %{
        success: true,
        token: viewer.token,
        url: viewer.url,
        expires_at: viewer.expires_at
      })
    else
      {:error, :not_found} ->
        conn |> put_status(404) |> json(%{success: false, error: "Tokend account not connected"})

      {:error, :oauth_not_ready} ->
        oauth_not_configured(conn)

      {:error, reason} ->
        conn |> put_status(502) |> json(%{success: false, error: inspect(reason)})
    end
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

  Mock connect only in explicit mock mode with no partial OAuth configuration.
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

      mock_connect_allowed?() ->
        case connect_mock_account(:user, user, nil) do
          {:ok, account} ->
            json(conn, %{success: true, social_account: serialize_user_account(account)})

          {:error, changeset} ->
            conn
            |> put_status(422)
            |> json(%{success: false, error: format_errors(changeset)})
        end

      true ->
        oauth_not_configured(conn)
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

        mock_connect_allowed?() ->
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

        true ->
          oauth_not_configured(conn)
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
        expires_at:
          DateTime.utc_now()
          |> DateTime.add(@session_ttl_seconds, :second)
          |> DateTime.truncate(:second),
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
                 "tokend_user_id" => me["id"] || me[:id],
                 "scopes" => tokens.scope,
                 "token_type" => tokens.token_type
               })
           }) do
      Logger.info("[Tokend] OAuth linked account=#{account.id} session=#{synced.id}")
      render_html_result(conn, true, nil)
    else
      nil ->
        render_html_result(
          conn,
          false,
          "No pending Tokend connection session matched this callback."
        )

      {:error, :expired} ->
        render_html_result(
          conn,
          false,
          "This Tokend connection session expired. Try connecting again."
        )

      {:error, reason} ->
        mark_session_failed_by_state(state, reason)
        Logger.warning("[Tokend] OAuth callback failed: #{inspect(reason)}")

        render_html_result(
          conn,
          false,
          "Failed to complete Tokend connection: #{format_errors(reason)}"
        )

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
    provider_account_id = me["id"] || me[:id]
    display_name = me["display_name"] || me[:display_name]
    email = me["email"] || me[:email]
    creator_slug =
      me["creator_slug"] || me[:creator_slug] || me["slug"] || me[:slug] || me["username"] ||
        me[:username]

    username =
      if is_binary(creator_slug) and String.trim(creator_slug) != "" do
        String.trim(creator_slug) |> String.downcase()
      else
        derive_username(display_name, email, to_string(provider_account_id))
      end

    provider_account_id = to_string(provider_account_id)

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
        "tokend_user_id" => me["id"] || me[:id],
        "creator_slug" => username,
        "email" => email,
        "wallet" => me["wallet"] || me[:wallet],
        "scopes" => tokens.scope,
        "token_type" => tokens.token_type
      },
      is_active: true
    }

    case session.scope do
      "user" ->
        user = Accounts.get_user(session.user_id)
        user_attrs = Map.put(base_attrs, :profile_url, nil)

        case {user,
              Campaigns.get_social_account_by_provider(
                session.user_id,
                "tokend",
                provider_account_id
              )} do
          {nil, _} ->
            {:error, :user_not_found}

          {user, nil} ->
            Campaigns.create_social_account(user, user_attrs)

          {user, existing} ->
            Campaigns.update_social_account(existing, user_attrs, user)
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

    web = Client.config()[:web_base_url] || "http://localhost:4100"

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

  defp mock_connect_allowed? do
    Client.mode() == :mock and not Client.oauth_configuration().incomplete
  end

  defp get_user_tokend_account(user_id) do
    account =
      user_id
      |> Campaigns.list_user_social_accounts()
      |> Enum.find(fn acc ->
        acc.platform == "tokend" and acc.provider == "tokend" and acc.is_active == true
      end)

    if account, do: {:ok, account}, else: {:error, :not_found}
  end

  defp oauth_not_configured(conn) do
    conn
    |> put_status(:service_unavailable)
    |> json(%{
      success: false,
      error: "configure_tokend",
      message:
        "Enable TOKEND_PARTNER_API_ENABLED and set TOKEND_API_BASE_URL, TOKEND_OAUTH_CLIENT_ID, TOKEND_OAUTH_CLIENT_SECRET, and TOKEND_OAUTH_REDIRECT_URI on Phoenix."
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

  defp mode_message(:mock, _oauth),
    do:
      "Mock mode — seed-shaped fixtures only (not production tokend.tv). Optional: TOKEND_API_BASE_URL=http://localhost:4101 after local seed-data."

  defp mode_message(:local, _oauth),
    do:
      "Local mode — proxying shipped public creator APIs. OAuth remains unavailable until the partner flag is enabled and all required settings are present."

  defp mode_message(:live, %{ready: true}),
    do:
      "Live mode — partner OAuth is enabled. Publish/download/watch unlock when Tokend partner APIs respond; catalog/status still use public creator routes."

  defp mode_message(:live, %{enabled: false}),
    do:
      "Live mode — remote configuration is complete, but partner OAuth is disabled. Public catalog/status remain available."

  defp mode_message(:live, _oauth),
    do:
      "Live mode — partner OAuth is enabled but incomplete. Public catalog/status remain available."

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

  defp format_errors({:token_request_failed, 401, %{error: "invalid_client"}}) do
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
