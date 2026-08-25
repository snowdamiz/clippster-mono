defmodule ClippsterServer.Tokend.Client do
  @moduledoc """
  Tokend partner API boundary.

  Modes:
  - `mock` — no `TOKEND_API_BASE_URL`; fixtures shaped like local Tokend seeds
    (`seed-nova` / `seed-orbit` / `seed-halo`). Those creators exist only after local
    Tokend `POST /api/v1/dev/seed-data`, **not** on production `tokend.tv`.
  - `local` — `TOKEND_API_BASE_URL` set (typically `http://localhost:4101`) without OAuth;
    proxies Tokend public creator channel / vods / clips endpoints.
  - `live` — base URL + OAuth client id/secret present. Public catalog/status still
    proxy `TOKEND_API_BASE_URL` (fallback mock if unreachable). Connect/publish stay
    stubbed until partner OAuth + upload APIs are wired.

  Secrets never leave Phoenix; Tauri/Vue must call Clippster APIs only.
  """

  require Logger

  @type mode :: :mock | :local | :live

  @seed_slugs ~w(seed-nova seed-orbit seed-halo)

  @spec mode() :: mode()
  def mode do
    cfg = config()

    cond do
      present?(cfg[:api_base_url]) and present?(cfg[:oauth_client_id]) and
          present?(cfg[:oauth_client_secret]) ->
        :live

      present?(cfg[:api_base_url]) ->
        :local

      true ->
        :mock
    end
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
      webhook_signing_secret: env_or(cfg[:webhook_signing_secret], "TOKEND_WEBHOOK_SIGNING_SECRET")
    )
  end

  defp env_or(configured, name) do
    case System.get_env(name) do
      value when is_binary(value) and value != "" -> String.trim(value)
      _ ->
        if is_binary(configured), do: String.trim(configured), else: configured
    end
  end

  @doc """
  Creator catalog for Stream VODs.
  `streams` = Tokend VODs (ended live sessions); `videos` = Tokend clips.
  """
  @spec creator_catalog(String.t()) :: {:ok, map()} | {:error, term()}
  def creator_catalog(slug) when is_binary(slug) do
    slug = normalize_slug(slug)

    case mode() do
      :mock ->
        {:ok, mock_catalog(slug)}

      :local ->
        fetch_local_catalog(slug)

      :live ->
        {:ok, catalog} = fetch_local_catalog(slug)
        {:ok, Map.put(catalog, :mode, catalog[:mode] || "live")}
    end
  end

  @doc """
  Live channel status for Live Clip monitoring.
  """
  @spec live_status(String.t()) :: {:ok, map()}
  def live_status(slug) when is_binary(slug) do
    slug = normalize_slug(slug)

    case mode() do
      :mock ->
        {:ok, mock_live_status(slug)}

      :local ->
        fetch_local_live_status(slug)

      :live ->
        {:ok, status} = fetch_local_live_status(slug)
        {:ok, Map.put(status, :mode, status[:mode] || "live")}
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
  Publish stub until partner upload APIs ship. Works in mock/local/live so UI can exercise the path.
  """
  @spec publish_media(String.t(), String.t(), map()) :: {:ok, map()} | {:error, term()}
  def publish_media(_access_token, media_url, opts) when is_binary(media_url) do
    mode = mode()

    {:ok,
     %{
       post_id: "tokend-mock-post-#{System.unique_integer([:positive])}",
       post_url: "#{web_base()}/seed-nova",
       media_type: Map.get(opts, :media_type, "video"),
       mode: to_string(mode),
       note:
         if(mode == :live,
           do: "Stub publish — real Tokend upload not wired yet.",
           else: "Stub publish — mock/local only."
         )
     }}
  end

  @default_oauth_scopes "profile:read catalog:read media:download streams:watch circles:read posts:write offline_access"

  @doc """
  True when OAuth client id, secret, redirect URI, and API base are all set.
  """
  @spec oauth_ready?() :: boolean()
  def oauth_ready? do
    cfg = config()

    present?(cfg[:api_base_url]) and present?(cfg[:oauth_client_id]) and
      present?(cfg[:oauth_client_secret]) and present?(cfg[:oauth_redirect_uri])
  end

  @spec default_oauth_scopes() :: String.t()
  def default_oauth_scopes, do: @default_oauth_scopes

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
  @spec authorize_url(String.t(), String.t(), String.t()) :: String.t()
  def authorize_url(state, code_challenge, scopes \\ @default_oauth_scopes)
      when is_binary(state) and is_binary(code_challenge) do
    cfg = config()
    redirect_uri = cfg[:oauth_redirect_uri]

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
      when is_binary(code) and is_binary(code_verifier) do
    cfg = config()
    url = "#{api_base()}/api/v1/oauth/token"

    case Req.post(url,
           form: %{
             "grant_type" => "authorization_code",
             "client_id" => cfg[:oauth_client_id],
             "client_secret" => cfg[:oauth_client_secret],
             "code" => code,
             "redirect_uri" => cfg[:oauth_redirect_uri],
             "code_verifier" => code_verifier
           },
           receive_timeout: 15_000,
           retry: false
         ) do
      {:ok, %{status: status, body: resp}} when status in 200..299 ->
        {:ok, normalize_token_response(resp)}

      {:ok, %{status: status, body: body}} ->
        Logger.warning("[Tokend.Client] token exchange failed status=#{status} body=#{inspect(body)}")
        {:error, {:token_exchange_failed, status, body}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Fetch linked Tokend user profile via partner `/me`.
  """
  @spec fetch_partner_me(String.t()) :: {:ok, map()} | {:error, term()}
  def fetch_partner_me(access_token) when is_binary(access_token) do
    url = "#{api_base()}/api/v1/partner/me"

    case Req.get(url,
           headers: [{"authorization", "Bearer #{access_token}"}],
           receive_timeout: 10_000,
           retry: false
         ) do
      {:ok, %{status: 200, body: %{"data" => data}}} when is_map(data) ->
        {:ok, data}

      {:ok, %{status: status, body: body}} ->
        {:error, {:partner_me_failed, status, body}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp normalize_token_response(resp) when is_map(resp) do
    %{
      access_token: resp["access_token"] || resp[:access_token],
      refresh_token: resp["refresh_token"] || resp[:refresh_token],
      expires_in: resp["expires_in"] || resp[:expires_in] || 3600,
      scope: resp["scope"] || resp[:scope],
      token_type: resp["token_type"] || resp[:token_type] || "Bearer"
    }
  end

  defp fetch_local_catalog(slug) do
    base = api_base()
    web = web_base()

    with {:ok, channel} <- get_json("#{base}/api/v1/creators/#{URI.encode(slug)}/channel"),
         {:ok, vods} <- get_json("#{base}/api/v1/creators/#{URI.encode(slug)}/vods?limit=20&days=30"),
         {:ok, clips} <- get_json("#{base}/api/v1/creators/#{URI.encode(slug)}/clips") do
      profile = get_in(channel, ["data", "profile"]) || %{}
      display = profile["display_name"] || profile["slug"] || slug_to_display(slug)

      {:ok,
       %{
         mode: "local",
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
           mode: "local",
           slug: slug,
           displayName: slug_to_display(slug),
           avatarUrl: nil,
           streams: [],
           videos: [],
           note:
             "Creator not found on local Tokend. Run seed-data on localhost:4101 (seed-nova is not on production tokend.tv)."
         }}

      {:error, reason} ->
        Logger.warning("[Tokend.Client] local catalog failed for #{slug}: #{inspect(reason)}")
        {:ok, Map.put(mock_catalog(slug), :mode, "mock-fallback")}
    end
  end

  defp fetch_local_live_status(slug) do
    base = api_base()

    case get_json("#{base}/api/v1/creators/#{URI.encode(slug)}/channel") do
      {:ok, body} ->
        data = body["data"] || %{}
        profile = data["profile"] || %{}
        stream = data["stream"] || %{}
        is_live = data["is_live"] == true

        {:ok,
         %{
           mode: "local",
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
           mode: "local",
           isLive: false,
           channelId: slug,
           displayName: slug_to_display(slug),
           error: "not_found_on_local_tokend"
         }}

      {:error, reason} ->
        Logger.warning("[Tokend.Client] local live status failed for #{slug}: #{inspect(reason)}")
        {:ok, Map.put(mock_live_status(slug), :mode, "mock-fallback")}
    end
  end

  defp get_json(url) do
    case Req.get(url, receive_timeout: 8_000, retry: false) do
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
      note: "Fixture from Tokend local seeds (dev-seed-nova-live). Not live on production tokend.tv."
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
    input
    |> String.trim()
    |> String.trim_leading("@")
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9_-]/, "")
    |> case do
      "" -> "seed-nova"
      slug -> slug
    end
  end

  defp slug_to_display(slug) do
    slug
    |> String.split(~r/[-_]/)
    |> Enum.map(&String.capitalize/1)
    |> Enum.join(" ")
  end

  defp present?(value) when is_binary(value), do: String.trim(value) != ""
  defp present?(_), do: false
end
