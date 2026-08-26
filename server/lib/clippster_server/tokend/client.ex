defmodule ClippsterServer.Tokend.Client do
  @moduledoc """
  Tokend integration boundary.

  Modes:
  - `mock` — no `TOKEND_API_BASE_URL`; fixtures shaped like local Tokend seeds
    (`seed-nova` / `seed-orbit` / `seed-halo`). Those creators exist only after local
    Tokend `POST /api/v1/dev/seed-data`, **not** on production `tokend.tv`.
  - `local` — `TOKEND_API_BASE_URL` set (typically `http://localhost:4101`) without a
    complete OAuth configuration; proxies Tokend's shipped public creator endpoints.
  - `live` — base URL + OAuth client id/secret/redirect URI present. Public catalog/status
    still use the shipped public creator endpoints. Partner OAuth remains disabled unless
    `TOKEND_PARTNER_API_ENABLED=true`.

  Local and live reads fail closed: only creator 404s become honest empty/offline results.

  Secrets never leave Phoenix; Tauri/Vue must call Clippster APIs only.
  """

  require Logger

  @type mode :: :mock | :local | :live

  @seed_slugs ~w(seed-nova seed-orbit seed-halo)

  @spec mode() :: mode()
  def mode do
    cfg = config()

    cond do
      oauth_configured?(cfg) ->
        :live

      present?(cfg[:api_base_url]) ->
        :local

      true ->
        :mock
    end
  end

  @doc """
  Reports whether OAuth configuration is complete and names missing settings without
  exposing any configured values.
  """
  @spec oauth_configuration() :: %{
          enabled: boolean(),
          ready: boolean(),
          configured: boolean(),
          incomplete: boolean(),
          missing: [String.t()]
        }
  def oauth_configuration do
    cfg = config()

    fields = [
      api_base_url: "TOKEND_API_BASE_URL",
      oauth_client_id: "TOKEND_OAUTH_CLIENT_ID",
      oauth_client_secret: "TOKEND_OAUTH_CLIENT_SECRET",
      oauth_redirect_uri: "TOKEND_OAUTH_REDIRECT_URI"
    ]

    missing =
      for {key, env_name} <- fields,
          not present?(cfg[key]),
          do: env_name

    oauth_values_present? =
      Enum.any?(
        [:oauth_client_id, :oauth_client_secret, :oauth_redirect_uri],
        &present?(cfg[&1])
      )

    configured = missing == []

    %{
      enabled: cfg[:partner_api_enabled] == true,
      ready: cfg[:partner_api_enabled] == true and configured,
      configured: configured,
      incomplete: missing != [] and oauth_values_present?,
      missing: missing
    }
  end

  @spec config() :: keyword()
  def config do
    cfg = Application.get_env(:clippster_server, :tokend, [])

    # Prefer live process env so .env updates work after restart without stale blanks;
    # trim to avoid Windows CRLF / paste whitespace breaking client_secret verify.
    Keyword.merge(cfg,
      api_base_url: env_or(cfg[:api_base_url], "TOKEND_API_BASE_URL"),
      web_base_url: env_or(cfg[:web_base_url], "TOKEND_WEB_BASE_URL") || "http://localhost:4100",
      oauth_client_id: env_or(cfg[:oauth_client_id], "TOKEND_OAUTH_CLIENT_ID"),
      oauth_client_secret: env_or(cfg[:oauth_client_secret], "TOKEND_OAUTH_CLIENT_SECRET"),
      oauth_redirect_uri: env_or(cfg[:oauth_redirect_uri], "TOKEND_OAUTH_REDIRECT_URI"),
      webhook_signing_secret:
        env_or(cfg[:webhook_signing_secret], "TOKEND_WEBHOOK_SIGNING_SECRET"),
      partner_api_enabled:
        env_boolean(cfg[:partner_api_enabled], "TOKEND_PARTNER_API_ENABLED", false)
    )
  end

  defp env_or(configured, name) do
    case System.get_env(name) do
      value when is_binary(value) and value != "" ->
        String.trim(value)

      _ ->
        if is_binary(configured), do: String.trim(configured), else: configured
    end
  end

  defp env_boolean(configured, name, default) do
    case System.get_env(name) do
      value when is_binary(value) ->
        String.downcase(String.trim(value)) in ~w(true 1 yes on)

      _ when is_boolean(configured) ->
        configured

      _ ->
        default
    end
  end

  @doc """
  Creator catalog for Stream VODs.
  `streams` = Tokend VODs (ended live sessions); `videos` = Tokend clips.
  """
  @spec creator_catalog(String.t()) :: {:ok, map()} | {:error, term()}
  def creator_catalog(slug) when is_binary(slug) do
    with {:ok, slug} <- normalize_slug(slug) do
      case mode() do
        :mock ->
          {:ok, mock_catalog(slug)}

        :local ->
          fetch_catalog(slug, :local)

        :live ->
          fetch_catalog(slug, :live)
      end
    end
  end

  @doc """
  Live channel status for Live Clip monitoring.
  """
  @spec live_status(String.t()) :: {:ok, map()} | {:error, term()}
  def live_status(slug) when is_binary(slug) do
    with {:ok, slug} <- normalize_slug(slug) do
      case mode() do
        :mock ->
          {:ok, mock_live_status(slug)}

        :local ->
          fetch_live_status(slug, :local)

        :live ->
          fetch_live_status(slug, :live)
      end
    end
  end

  @doc """
  Mock-connect a Tokend account for Clippster user/org when partner OAuth is unset.
  """
  @spec mock_connect_profile() :: map()
  def mock_connect_profile do
    %{
      provider_account_id: "tokend-mock-seed-nova",
      username: "seednova",
      display_name: "Seed Nova",
      profile_image_url: nil,
      provider_platform: "tokend",
      access_token: "tokend-mock-access-token",
      refresh_token: "tokend-mock-refresh-token",
      note: "Mock link — local Tokend seed shape only. Not a production tokend.tv connection."
    }
  end

  @doc """
  Native publishing via Tokend partner upload + creator post APIs.
  Requires partner OAuth (`TOKEND_PARTNER_API_ENABLED`) and `posts:write`.
  """
  @spec publish_media(String.t(), String.t(), map()) :: {:ok, map()} | {:error, term()}
  def publish_media(access_token, media_url, opts \\ %{})

  def publish_media(access_token, media_url, opts)
      when is_binary(access_token) and is_binary(media_url) do
    opts = Map.new(opts)
    creator_slug = opts[:creator_slug] || opts["creator_slug"]
    caption = opts[:caption] || opts["caption"] || ""
    idempotency_key =
      opts[:idempotency_key] || opts["idempotency_key"] ||
        "clippster-#{Base.url_encode64(:crypto.strong_rand_bytes(18), padding: false)}"

    with :ok <- require_oauth_ready(),
         :ok <- require_present(creator_slug, :missing_creator_slug),
         {:ok, %{body: body, content_type: content_type}} <- download_remote_media(media_url),
         {:ok, upload} <- partner_upload(access_token, body, content_type),
         upload_url when is_binary(upload_url) and upload_url != "" <-
           upload["url"] || upload[:url] || {:error, :missing_upload_url},
         {:ok, post} <-
           partner_create_post(access_token, creator_slug, %{
             body: caption,
             audiences: ["everyone"],
             media: [
               %{
                 kind: "video",
                 url: upload_url,
                 content_type: upload["content_type"] || upload[:content_type] || content_type,
                 duration_seconds: opts[:duration_seconds] || opts["duration_seconds"]
               }
             ],
             idempotency_key: idempotency_key
           }) do
      post_id = to_string(post["id"] || post[:id])
      web = web_base()

      {:ok,
       %{
         post_id: post_id,
         post_url: "#{web}/#{creator_slug}/posts/#{post_id}",
         provider_payload: post
       }}
    end
  end

  def publish_media(_, _, _), do: {:error, :invalid_publish_request}

  @doc """
  Partner catalog for an authenticated linked Tokend user.
  Falls back to public creator routes when partner catalog is unavailable.
  """
  @spec partner_creator_catalog(String.t(), String.t()) :: {:ok, map()} | {:error, term()}
  def partner_creator_catalog(access_token, slug)
      when is_binary(access_token) and is_binary(slug) do
    with :ok <- require_oauth_ready(),
         {:ok, slug} <- normalize_slug(slug) do
      case fetch_partner_catalog(access_token, slug) do
        {:ok, _} = ok ->
          ok

        {:error, :not_found} ->
          creator_catalog(slug)

        {:error, _} = error ->
          case creator_catalog(slug) do
            {:ok, catalog} -> {:ok, Map.put(catalog, :note, "Partner catalog unavailable; used public creator catalog.")}
            _ -> error
          end
      end
    end
  end

  def partner_creator_catalog(_, _), do: {:error, :invalid_catalog_request}

  @doc """
  Issue a short-lived media download grant via Tokend partner API.
  """
  @spec create_media_grant(String.t(), String.t(), String.t(), String.t()) ::
          {:ok, map()} | {:error, term()}
  def create_media_grant(access_token, asset_type, asset_id, purpose \\ "download")

  def create_media_grant(access_token, asset_type, asset_id, purpose)
      when is_binary(access_token) and is_binary(asset_type) and is_binary(asset_id) and
             is_binary(purpose) do
    with :ok <- require_oauth_ready(),
         :ok <- require_present(asset_type, :invalid_asset_type),
         :ok <- require_present(asset_id, :invalid_asset_id) do
      url =
        "#{api_base()}/api/v1/partner/media/#{URI.encode(asset_type)}/#{URI.encode(asset_id)}/grants"

      case http_request(:post, url,
             headers: [{"authorization", "Bearer #{access_token}"}],
             json: %{purpose: purpose},
             receive_timeout: 15_000,
             retry: false
           ) do
        {:ok, %{status: status, body: body}} when status in 200..299 and is_map(body) ->
          data = body["data"] || body
          token = data["token"] || data[:token] || data["grant_token"] || data[:grant_token]

          if present?(token) do
            {:ok,
             %{
               token: token,
               expires_at: data["expires_at"] || data[:expires_at],
               delivery_path: data["delivery_path"] || data[:delivery_path],
               raw: data
             }}
          else
            {:error, :missing_grant_token}
          end

        {:ok, %{status: status, body: body}} ->
          {:error, {:media_grant_failed, status, upstream_error(body)}}

        {:error, reason} ->
          {:error, reason}
      end
    end
  end

  def create_media_grant(_, _, _, _), do: {:error, :invalid_grant_request}

  @doc """
  Redeem a media grant through Phoenix (Bearer stays server-side).
  Returns `{:ok, {:body, binary, content_type}}` or `{:ok, {:redirect, url}}`.
  """
  @spec redeem_media_grant(String.t(), String.t()) ::
          {:ok, {:body, binary(), String.t()} | {:redirect, String.t()}} | {:error, term()}
  def redeem_media_grant(access_token, grant_token)
      when is_binary(access_token) and is_binary(grant_token) do
    with :ok <- require_oauth_ready(),
         :ok <- require_present(grant_token, :missing_grant_token) do
      url = "#{api_base()}/api/v1/partner/media/grants/#{URI.encode(grant_token)}"

      case http_request(:get, url,
             headers: [{"authorization", "Bearer #{access_token}"}],
             decode_body: false,
             receive_timeout: 120_000,
             retry: false
           ) do
        {:ok, %{status: status, body: body, headers: headers}} when status in 200..299 ->
          content_type = content_type_from_headers(headers) || "application/octet-stream"
          {:ok, {:body, body, content_type}}

        {:ok, %{status: status, headers: headers}} when status in [301, 302, 303, 307, 308] ->
          case location_from_headers(headers) do
            url when is_binary(url) and url != "" -> {:ok, {:redirect, url}}
            _ -> {:error, {:media_grant_redeem_failed, status, %{}}}
          end

        {:ok, %{status: status, body: body}} ->
          decoded = decode_json_body(body)
          {:error, {:media_grant_redeem_failed, status, upstream_error(decoded)}}

        {:error, reason} ->
          {:error, reason}
      end
    end
  end

  def redeem_media_grant(_, _), do: {:error, :invalid_grant_redeem_request}

  @doc """
  Request a LiveKit/viewer token for a Tokend stream.
  """
  @spec create_viewer_token(String.t(), String.t()) :: {:ok, map()} | {:error, term()}
  def create_viewer_token(access_token, stream_id)
      when is_binary(access_token) and is_binary(stream_id) do
    with :ok <- require_oauth_ready(),
         :ok <- require_present(stream_id, :invalid_stream_id) do
      url = "#{api_base()}/api/v1/partner/catalog/streams/#{URI.encode(stream_id)}/viewer-token"

      case http_request(:post, url,
             headers: [{"authorization", "Bearer #{access_token}"}],
             json: %{},
             receive_timeout: 15_000,
             retry: false
           ) do
        {:ok, %{status: status, body: body}} when status in 200..299 and is_map(body) ->
          data = body["data"] || body
          token = data["token"] || data[:token] || data["viewer_token"] || data[:viewer_token]

          if present?(token) do
            {:ok,
             %{
               token: token,
               url: data["url"] || data[:url],
               expires_at: data["expires_at"] || data[:expires_at],
               raw: data
             }}
          else
            {:error, :missing_viewer_token}
          end

        {:ok, %{status: status, body: body}} ->
          {:error, {:viewer_token_failed, status, upstream_error(body)}}

        {:error, reason} ->
          {:error, reason}
      end
    end
  end

  def create_viewer_token(_, _), do: {:error, :invalid_viewer_token_request}

  @partner_oauth_scopes "profile:read catalog:read media:download streams:watch circles:read posts:write offline_access"
  @default_oauth_scopes "profile:read offline_access"

  @doc """
  True only when the partner API flag is enabled and all OAuth settings are present.
  """
  @spec oauth_ready?() :: boolean()
  def oauth_ready?, do: oauth_configuration().ready

  @spec default_oauth_scopes() :: String.t()
  def default_oauth_scopes do
    if oauth_ready?(), do: @partner_oauth_scopes, else: @default_oauth_scopes
  end

  @doc """
  Capability matrix exposed to desktop clients.
  """
  @spec capabilities() :: map()
  def capabilities do
    ready = oauth_ready?()

    %{
      public_catalog: true,
      live_status: true,
      oauth_connect: ready,
      mock_connect: mode() == :mock and not oauth_configuration().incomplete,
      publish: ready,
      schedule: ready,
      download: ready,
      watch: ready,
      dvr: false,
      analytics: false,
      webhooks: present?(config()[:webhook_signing_secret])
    }
  end

  @doc """
  Generate PKCE verifier + S256 challenge.
  """
  @spec generate_pkce() :: %{code_verifier: String.t(), code_challenge: String.t()}
  def generate_pkce do
    verifier = Base.url_encode64(:crypto.strong_rand_bytes(32), padding: false)

    challenge =
      :crypto.hash(:sha256, verifier)
      |> Base.url_encode64(padding: false)

    %{code_verifier: verifier, code_challenge: challenge}
  end

  @doc """
  Browser authorize URL on Tokend web (`/oauth/authorize?...`).
  """
  @spec authorize_url(String.t(), String.t(), String.t() | nil) :: String.t()
  def authorize_url(state, code_challenge, scopes \\ nil)
      when is_binary(state) and is_binary(code_challenge) do
    cfg = config()
    redirect_uri = cfg[:oauth_redirect_uri]
    scopes = scopes || default_oauth_scopes()

    query =
      URI.encode_query(%{
        "client_id" => cfg[:oauth_client_id],
        "redirect_uri" => redirect_uri,
        "scope" => scopes,
        "state" => state,
        "code_challenge" => code_challenge,
        "code_challenge_method" => "S256"
      })

    "#{web_base()}/oauth/authorize?#{query}"
  end

  @doc """
  Exchange authorization code for access/refresh tokens.
  """
  @spec exchange_authorization_code(String.t(), String.t()) :: {:ok, map()} | {:error, term()}
  def exchange_authorization_code(code, code_verifier)
      when is_binary(code) and code != "" and is_binary(code_verifier) and code_verifier != "" do
    cfg = config()

    with :ok <- require_oauth_ready(),
         {:ok, response} <-
           token_request(%{
             "grant_type" => "authorization_code",
             "client_id" => cfg[:oauth_client_id],
             "client_secret" => cfg[:oauth_client_secret],
             "code" => code,
             "redirect_uri" => cfg[:oauth_redirect_uri],
             "code_verifier" => code_verifier
           }),
         {:ok, tokens} <- validate_token_response(response) do
      {:ok, tokens}
    end
  end

  def exchange_authorization_code(_, _), do: {:error, :invalid_authorization_code_request}

  @doc """
  Refresh an access token. Tokend rotates refresh tokens, so callers must persist the
  returned refresh token when present.
  """
  @spec refresh_access_token(String.t()) :: {:ok, map()} | {:error, term()}
  def refresh_access_token(refresh_token) when is_binary(refresh_token) and refresh_token != "" do
    cfg = config()

    with :ok <- require_oauth_ready(),
         {:ok, response} <-
           token_request(%{
             "grant_type" => "refresh_token",
             "client_id" => cfg[:oauth_client_id],
             "client_secret" => cfg[:oauth_client_secret],
             "refresh_token" => refresh_token
           }),
         {:ok, tokens} <- validate_token_response(response) do
      {:ok, tokens}
    end
  end

  def refresh_access_token(_), do: {:error, :missing_refresh_token}

  @doc """
  Revoke an OAuth token. The endpoint intentionally returns success for unknown tokens.
  """
  @spec revoke_token(String.t(), String.t()) :: :ok | {:error, term()}
  def revoke_token(token, token_type_hint \\ "refresh_token")

  def revoke_token(token, token_type_hint)
      when is_binary(token) and token != "" and
             token_type_hint in ["refresh_token", "access_token"] do
    cfg = config()

    with :ok <- require_oauth_ready(),
         {:ok, %{status: status}} when status in 200..299 <-
           http_request(:post, "#{api_base()}/api/v1/oauth/revoke",
             form: %{
               "client_id" => cfg[:oauth_client_id],
               "client_secret" => cfg[:oauth_client_secret],
               "token" => token,
               "token_type_hint" => token_type_hint
             },
             receive_timeout: 15_000,
             retry: false
           ) do
      :ok
    else
      {:ok, %{status: status, body: body}} ->
        {:error, {:token_revoke_failed, status, upstream_error(body)}}

      {:error, _} = error ->
        error
    end
  end

  def revoke_token(_, _), do: {:error, :invalid_revoke_request}

  @doc """
  Fetch linked Tokend user profile via partner `/me`.
  """
  @spec fetch_partner_me(String.t()) :: {:ok, map()} | {:error, term()}
  def fetch_partner_me(access_token) when is_binary(access_token) do
    with :ok <- require_oauth_ready() do
      case http_request(:get, "#{api_base()}/api/v1/partner/me",
             headers: [{"authorization", "Bearer #{access_token}"}],
             receive_timeout: 10_000,
             retry: false
           ) do
        {:ok, %{status: 200, body: %{"data" => data}}} when is_map(data) ->
          case data["id"] || data[:id] do
            id when is_binary(id) and id != "" -> {:ok, data}
            id when is_integer(id) -> {:ok, data}
            _ -> {:error, :missing_partner_user_id}
          end

        {:ok, %{status: status, body: body}} ->
          {:error, {:partner_me_failed, status, upstream_error(body)}}

        {:error, reason} ->
          {:error, reason}
      end
    end
  end

  @doc false
  @spec validate_token_response(term()) :: {:ok, map()} | {:error, term()}
  def validate_token_response(resp) when is_map(resp) do
    tokens = %{
      access_token: resp["access_token"] || resp[:access_token],
      refresh_token: resp["refresh_token"] || resp[:refresh_token],
      expires_in: resp["expires_in"] || resp[:expires_in],
      scope: resp["scope"] || resp[:scope],
      token_type: resp["token_type"] || resp[:token_type]
    }

    cond do
      not present?(tokens.access_token) ->
        {:error, {:invalid_token_response, :access_token}}

      not (is_binary(tokens.token_type) and String.downcase(tokens.token_type) == "bearer") ->
        {:error, {:invalid_token_response, :token_type}}

      not (is_integer(tokens.expires_in) and tokens.expires_in > 0) ->
        {:error, {:invalid_token_response, :expires_in}}

      not is_nil(tokens.refresh_token) and not present?(tokens.refresh_token) ->
        {:error, {:invalid_token_response, :refresh_token}}

      true ->
        {:ok, %{tokens | token_type: "Bearer"}}
    end
  end

  def validate_token_response(_), do: {:error, {:invalid_token_response, :body}}

  defp token_request(form) do
    case http_request(:post, "#{api_base()}/api/v1/oauth/token",
           form: form,
           receive_timeout: 15_000,
           retry: false
         ) do
      {:ok, %{status: status, body: body}} when status in 200..299 and is_map(body) ->
        {:ok, body}

      {:ok, %{status: status, body: body}} ->
        {:error, {:token_request_failed, status, upstream_error(body)}}

      {:error, reason} ->
        {:error, {:token_request_failed, reason}}
    end
  end

  defp upstream_error(body) when is_map(body) do
    %{
      error: body["error"] || body[:error],
      error_description: body["error_description"] || body[:error_description]
    }
    |> Enum.reject(fn {_key, value} -> not is_binary(value) end)
    |> Map.new()
  end

  defp upstream_error(_), do: %{}

  defp fetch_catalog(slug, mode) do
    base = api_base()
    web = web_base()
    mode_label = to_string(mode)

    with {:ok, channel} <- get_json("#{base}/api/v1/creators/#{URI.encode(slug)}/channel"),
         {:ok, vods} <-
           get_json("#{base}/api/v1/creators/#{URI.encode(slug)}/vods?limit=20&days=30"),
         {:ok, clips} <- get_json("#{base}/api/v1/creators/#{URI.encode(slug)}/clips") do
      profile = get_in(channel, ["data", "profile"]) || %{}
      display = profile["display_name"] || profile["slug"] || slug_to_display(slug)

      {:ok,
       %{
         mode: mode_label,
         slug: slug,
         displayName: display,
         avatarUrl: profile["avatar_url"],
         streams: Enum.map(vods["data"] || [], &map_vod(&1, slug, web)),
         videos: Enum.map(clips["data"] || [], &map_clip(&1, slug, web))
       }}
    else
      {:error, :not_found} ->
        {:ok,
         %{
           mode: mode_label,
           slug: slug,
           displayName: slug_to_display(slug),
           avatarUrl: nil,
           streams: [],
           videos: [],
           note: "Creator not found on configured Tokend API."
         }}

      {:error, reason} ->
        Logger.warning(
          "[Tokend.Client] #{mode_label} catalog failed for #{slug}: #{inspect(reason)}"
        )

        {:error, reason}
    end
  end

  defp fetch_live_status(slug, mode) do
    base = api_base()
    mode_label = to_string(mode)

    case get_json("#{base}/api/v1/creators/#{URI.encode(slug)}/channel") do
      {:ok, body} ->
        data = body["data"] || %{}
        profile = data["profile"] || %{}
        stream = data["stream"] || %{}
        is_live = data["is_live"] == true

        {:ok,
         %{
           mode: mode_label,
           isLive: is_live,
           channelId: slug,
           displayName: profile["display_name"] || slug_to_display(slug),
           profileImageUrl: profile["avatar_url"],
           streamTitle: stream["title"],
           viewerCount: stream["viewer_count"] || stream["peak_viewers"] || 0,
           thumbnailUrl: stream["thumbnail_url"],
           startedAt: stream["started_at"]
         }}

      {:error, :not_found} ->
        {:ok,
         %{
           mode: mode_label,
           isLive: false,
           channelId: slug,
           displayName: slug_to_display(slug),
           error: "not_found_on_tokend"
         }}

      {:error, reason} ->
        Logger.warning(
          "[Tokend.Client] #{mode_label} live status failed for #{slug}: #{inspect(reason)}"
        )

        {:error, reason}
    end
  end

  defp http_request(method, url, opts) do
    case Application.get_env(:clippster_server, :tokend_http_client) do
      client when is_function(client, 3) -> client.(method, url, opts)
      client when is_function(client, 2) -> client.(url, opts)
      _ -> Req.request(Keyword.merge(opts, method: method, url: url))
    end
  end

  defp map_vod(item, slug, web) when is_map(item) do
    id = to_string(item["id"] || item["provider_stream_id"] || "vod")

    %{
      id: "tokend-vod-#{id}",
      title: item["title"] || "Tokend VOD",
      duration: item["duration_seconds"],
      thumbnailUrl: item["thumbnail_url"],
      url: item["playback_url"] || item["vod_url"] || "#{web}/#{slug}/vod/#{id}",
      publishedAt: item["ended_at"] || item["started_at"],
      kind: "stream"
    }
  end

  defp map_clip(item, slug, web) when is_map(item) do
    id = to_string(item["id"] || "clip")

    %{
      id: "tokend-clip-#{id}",
      title: item["title"] || "Tokend clip",
      duration: item["duration_seconds"],
      thumbnailUrl: item["thumbnail_url"],
      url: item["playback_url"] || "#{web}/#{slug}/clips",
      publishedAt: item["inserted_at"] || item["created_at"],
      kind: "video"
    }
  end

  defp mock_catalog(slug) when slug in @seed_slugs do
    display = seed_display(slug)
    web = web_base()

    streams =
      case slug do
        "seed-nova" ->
          [
            %{
              id: "tokend-vod-dev-seed-nova-vod-launch-retro",
              title: "Launch dashboard retro and next bets",
              duration: 3600,
              thumbnailUrl:
                "https://images.unsplash.com/photo-1556761175-4b46a572b786?auto=format&fit=crop&w=1400&q=80",
              url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
              publishedAt: nil,
              kind: "stream"
            }
          ]

        _ ->
          [
            %{
              id: "tokend-vod-dev-seed-#{slug}-1",
              title: "#{display} session 1",
              duration: 2400,
              thumbnailUrl: nil,
              url: "#{web}/#{slug}/vods",
              publishedAt: nil,
              kind: "stream"
            }
          ]
      end

    %{
      mode: "mock",
      slug: slug,
      displayName: display,
      avatarUrl: nil,
      note:
        "Fixture mirrors Tokend local seeds only. Point TOKEND_API_BASE_URL at http://localhost:4101 after seeding. Not available on production tokend.tv.",
      streams: streams,
      videos: [
        %{
          id: "tokend-clip-#{slug}-1",
          title: "#{display} clip",
          duration: 45,
          thumbnailUrl: nil,
          url: "#{web}/#{slug}/clips",
          publishedAt: nil,
          kind: "video"
        }
      ]
    }
  end

  defp mock_catalog(slug) do
    %{
      mode: "mock",
      slug: slug,
      displayName: slug_to_display(slug),
      avatarUrl: nil,
      note:
        "Unknown slug in mock mode. Use seed-nova / seed-orbit / seed-halo against local Tokend (localhost:4100), or set TOKEND_API_BASE_URL=http://localhost:4101.",
      streams: [],
      videos: []
    }
  end

  defp mock_live_status("seed-nova") do
    %{
      mode: "mock",
      isLive: true,
      channelId: "seed-nova",
      displayName: "Seed Nova",
      profileImageUrl: nil,
      streamTitle: "Shipping the creator launch dashboard",
      viewerCount: 2314,
      thumbnailUrl:
        "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1400&q=80",
      startedAt: DateTime.utc_now() |> DateTime.add(-3600, :second) |> DateTime.to_iso8601(),
      note:
        "Fixture from Tokend local seeds (dev-seed-nova-live). Not live on production tokend.tv."
    }
  end

  defp mock_live_status(slug) when slug in @seed_slugs do
    %{
      mode: "mock",
      isLive: false,
      channelId: slug,
      displayName: seed_display(slug),
      profileImageUrl: nil,
      streamTitle: nil,
      viewerCount: 0,
      thumbnailUrl: nil,
      startedAt: nil,
      note: "Local seed creator fixture (offline). Not on production tokend.tv."
    }
  end

  defp mock_live_status(slug) do
    %{
      mode: "mock",
      isLive: false,
      channelId: slug,
      displayName: slug_to_display(slug),
      error: "not_a_local_seed_slug"
    }
  end

  defp seed_display("seed-nova"), do: "Seed Nova"
  defp seed_display("seed-orbit"), do: "Seed Orbit"
  defp seed_display("seed-halo"), do: "Seed Halo"
  defp seed_display(slug), do: slug_to_display(slug)

  defp api_base do
    config()[:api_base_url]
    |> to_string()
    |> String.trim_trailing("/")
  end

  defp web_base do
    case config()[:web_base_url] do
      url when is_binary(url) and url != "" -> String.trim_trailing(url, "/")
      _ -> "http://localhost:4100"
    end
  end

  defp normalize_slug(input) do
    slug =
      input
      |> String.trim()
      |> String.trim_leading("@")
      |> String.downcase()
      |> String.replace(~r/[^a-z0-9_-]/, "")

    if slug == "", do: {:error, :invalid_slug}, else: {:ok, slug}
  end

  defp slug_to_display(slug) do
    slug
    |> String.split(~r/[-_]/)
    |> Enum.map(&String.capitalize/1)
    |> Enum.join(" ")
  end

  defp present?(value) when is_binary(value), do: String.trim(value) != ""
  defp present?(_), do: false

  defp require_present(value, error) do
    if present?(value), do: :ok, else: {:error, error}
  end

  defp oauth_configured?(cfg) do
    present?(cfg[:api_base_url]) and present?(cfg[:oauth_client_id]) and
      present?(cfg[:oauth_client_secret]) and present?(cfg[:oauth_redirect_uri])
  end

  defp require_oauth_ready do
    if oauth_ready?(), do: :ok, else: {:error, :oauth_not_ready}
  end

  defp download_remote_media(url) do
    case http_request(:get, url,
           decode_body: false,
           receive_timeout: 120_000,
           retry: false
         ) do
      {:ok, %{status: status, body: body, headers: headers}} when status in 200..299 ->
        {:ok,
         %{
           body: body,
           content_type: content_type_from_headers(headers) || "video/mp4"
         }}

      {:ok, %{status: status, body: body}} ->
        {:error, {:media_download_failed, status, decode_json_body(body)}}

      {:error, reason} ->
        {:error, {:media_download_failed, reason}}
    end
  end

  defp partner_upload(access_token, body, content_type)
       when is_binary(access_token) and is_binary(body) do
    filename = filename_for_content_type(content_type)

    case http_request(:post, "#{api_base()}/api/v1/partner/uploads",
           headers: [{"authorization", "Bearer #{access_token}"}],
           form_multipart: [
             file: {body, filename: filename, content_type: content_type}
           ],
           receive_timeout: 180_000,
           retry: false
         ) do
      {:ok, %{status: status, body: resp}} when status in 200..299 and is_map(resp) ->
        {:ok, resp["data"] || resp}

      {:ok, %{status: status, body: resp}} ->
        {:error, {:partner_upload_failed, status, upstream_error(resp)}}

      {:error, reason} ->
        {:error, {:partner_upload_failed, reason}}
    end
  end

  defp partner_create_post(access_token, creator_slug, attrs) do
    media =
      (attrs[:media] || attrs["media"] || [])
      |> Enum.map(fn item ->
        item
        |> Map.new()
        |> Map.reject(fn {_k, v} -> is_nil(v) end)
      end)

    payload =
      %{
        body: attrs[:body] || attrs["body"] || "",
        audiences: attrs[:audiences] || attrs["audiences"] || ["everyone"],
        media: media,
        idempotency_key: attrs[:idempotency_key] || attrs["idempotency_key"]
      }
      |> Map.reject(fn {_k, v} -> is_nil(v) end)

    url = "#{api_base()}/api/v1/partner/creators/#{URI.encode(creator_slug)}/posts"

    case http_request(:post, url,
           headers: [{"authorization", "Bearer #{access_token}"}],
           json: payload,
           receive_timeout: 30_000,
           retry: false
         ) do
      {:ok, %{status: status, body: resp}} when status in 200..299 and is_map(resp) ->
        {:ok, resp["data"] || resp}

      {:ok, %{status: status, body: resp}} ->
        {:error, {:partner_create_post_failed, status, upstream_error(resp)}}

      {:error, reason} ->
        {:error, {:partner_create_post_failed, reason}}
    end
  end

  defp fetch_partner_catalog(access_token, slug) do
    base = api_base()
    web = web_base()
    headers = [{"authorization", "Bearer #{access_token}"}]
    encoded = URI.encode(slug)

    with {:ok, channel} <-
           get_json("#{base}/api/v1/partner/catalog/creators/#{encoded}/channel", headers),
         {:ok, vods} <-
           get_json("#{base}/api/v1/partner/catalog/creators/#{encoded}/vods?limit=20", headers),
         {:ok, clips} <-
           get_json("#{base}/api/v1/partner/catalog/creators/#{encoded}/clips", headers) do
      profile = get_in(channel, ["data", "profile"]) || channel["profile"] || %{}
      display = profile["display_name"] || profile["slug"] || slug_to_display(slug)
      vod_items = channel_list(vods)
      clip_items = channel_list(clips)

      {:ok,
       %{
         mode: "live",
         source: "partner",
         slug: slug,
         displayName: display,
         avatarUrl: profile["avatar_url"],
         streams: Enum.map(vod_items, &map_vod(&1, slug, web)),
         videos: Enum.map(clip_items, &map_clip(&1, slug, web))
       }}
    end
  end

  defp channel_list(%{"data" => data}) when is_list(data), do: data
  defp channel_list(data) when is_list(data), do: data
  defp channel_list(_), do: []

  defp get_json(url, headers \\ []) do
    case http_request(:get, url, headers: headers, receive_timeout: 8_000, retry: false) do
      {:ok, %{status: 200, body: body}} when is_map(body) ->
        {:ok, body}

      {:ok, %{status: 404}} ->
        {:error, :not_found}

      {:ok, %{status: status, body: body}} ->
        {:error, {:http, status, body}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp content_type_from_headers(headers) when is_list(headers) do
    Enum.find_value(headers, fn
      {"content-type", value} when is_binary(value) ->
        value |> String.split(";") |> List.first() |> String.trim()

      {"Content-Type", value} when is_binary(value) ->
        value |> String.split(";") |> List.first() |> String.trim()

      _ ->
        nil
    end)
  end

  defp content_type_from_headers(_), do: nil

  defp location_from_headers(headers) when is_list(headers) do
    Enum.find_value(headers, fn
      {"location", value} when is_binary(value) -> value
      {"Location", value} when is_binary(value) -> value
      _ -> nil
    end)
  end

  defp location_from_headers(_), do: nil

  defp decode_json_body(body) when is_binary(body) do
    case Jason.decode(body) do
      {:ok, decoded} -> decoded
      _ -> %{}
    end
  end

  defp decode_json_body(body) when is_map(body), do: body
  defp decode_json_body(_), do: %{}

  defp filename_for_content_type("video/webm"), do: "clip.webm"
  defp filename_for_content_type("video/quicktime"), do: "clip.mov"
  defp filename_for_content_type("image/png"), do: "clip.png"
  defp filename_for_content_type("image/jpeg"), do: "clip.jpg"
  defp filename_for_content_type(_), do: "clip.mp4"
end
