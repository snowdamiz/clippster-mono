import Config

# config/runtime.exs is executed for all environments, including
# during releases. It is executed after compilation and before the
# system starts, so it is typically used to load production configuration
# and secrets from environment variables or elsewhere. Do not define
# any compile-time configuration in here, as it won't be applied.
# The block below contains prod specific runtime configuration.

# Load .env file if it exists (for local development only)
# In production, env vars come from fly secrets
if config_env() != :prod do
  env_file = Path.join(File.cwd!(), ".env")

  if File.exists?(env_file) do
    try do
      env_vars = Dotenvy.source!(env_file)
      Enum.each(env_vars, fn {key, value} -> System.put_env(key, value) end)
    rescue
      _ -> :ok
    end
  end
end

# Google OAuth configuration (all environments)
google_client_id = System.get_env("GOOGLE_CLIENT_ID")
google_client_secret = System.get_env("GOOGLE_CLIENT_SECRET")

if google_client_id && google_client_secret do
  config :ueberauth, Ueberauth.Strategy.Google.OAuth,
    client_id: google_client_id,
    client_secret: google_client_secret
end

# Stripe configuration (all environments)
stripe_secret_key = System.get_env("STRIPE_SECRET_KEY")
stripe_webhook_secret = System.get_env("STRIPE_WEBHOOK_SECRET")

if stripe_secret_key do
  config :stripity_stripe,
    api_key: stripe_secret_key
end

# Frontend base URL used for redirects from server-driven browser flows (e.g. Stripe checkout)
frontend_base_url =
  System.get_env("FRONTEND_URL") ||
    if config_env() == :prod do
      "https://clippster.app"
    else
      "http://localhost:1420"
    end

stripe_success_url =
  System.get_env("STRIPE_SUCCESS_URL") || frontend_base_url <> "/stripe-success"

stripe_cancel_url = System.get_env("STRIPE_CANCEL_URL") || frontend_base_url <> "/stripe-cancel"

# Desktop checkout redirects return to a local Tauri callback server.
stripe_desktop_callback_base_url =
  System.get_env("STRIPE_DESKTOP_CALLBACK_BASE_URL") || "http://localhost:48277"

config :clippster_server, :frontend_base_url, frontend_base_url
config :clippster_server, :stripe_desktop_callback_base_url, stripe_desktop_callback_base_url

if config_env() == :prod do
  ensure_https_url = fn env_name, value ->
    case URI.parse(value || "") do
      %URI{scheme: "https", host: host} when is_binary(host) and host != "" ->
        :ok

      _ ->
        raise """
        #{env_name} must be an https URL in production.
        Current value: #{inspect(value)}
        """
    end
  end

  ensure_https_url.("FRONTEND_URL", frontend_base_url)
  ensure_https_url.("STRIPE_SUCCESS_URL", stripe_success_url)
  ensure_https_url.("STRIPE_CANCEL_URL", stripe_cancel_url)

  if is_nil(stripe_webhook_secret) or stripe_webhook_secret == "" do
    raise """
    environment variable STRIPE_WEBHOOK_SECRET is required in production.
    """
  end
end

# Store webhook secret in application config for access in controllers
config :clippster_server, :stripe,
  webhook_secret: stripe_webhook_secret,
  success_url: stripe_success_url,
  cancel_url: stripe_cancel_url

config :clippster_server, :allow_unverified_stripe_webhooks, config_env() != :prod

# Resend email configuration (all environments)
resend_api_key = System.get_env("RESEND_API_KEY")

if resend_api_key do
  config :clippster_server, ClippsterServer.Mailer,
    adapter: Resend.Swoosh.Adapter,
    api_key: resend_api_key
end

# JWT secret for token signing (REQUIRED in production)
jwt_secret = System.get_env("JWT_SECRET")

if config_env() == :prod and is_nil(jwt_secret) do
  raise """
  environment variable JWT_SECRET is missing.
  You can generate one by running: mix phx.gen.secret
  """
end

config :clippster_server,
  jwt_secret: jwt_secret || "dev_secret_key_change_in_production"

# Email auth configuration
config :clippster_server, :email_auth,
  from_email: System.get_env("EMAIL_FROM") || "noreply@clippster.app",
  app_name: "Clippster",
  verification_url_base: System.get_env("APP_URL") || "http://localhost:4000"

# Instagram API configuration (Instagram Business Login)
# redirect_uri should point to the server's callback endpoint
instagram_redirect_uri =
  System.get_env("INSTAGRAM_REDIRECT_URI") ||
    if config_env() == :prod do
      "https://#{System.get_env("PHX_HOST") || "api.clippster.app"}/api/auth/instagram/callback"
    else
      "http://localhost:4000/api/auth/instagram/callback"
    end

config :clippster_server, :instagram,
  app_id: System.get_env("INSTAGRAM_APP_ID"),
  app_secret: System.get_env("INSTAGRAM_APP_SECRET"),
  redirect_uri: instagram_redirect_uri

# Social token encryption key (must be base64-encoded 32-byte key)
config :clippster_server,
  social_token_encryption_key: System.get_env("SOCIAL_TOKEN_ENCRYPTION_KEY")

# Twitter API configuration (twitterapi.io - read-only API for tweet analytics)
config :clippster_server, :twitter, api_key: System.get_env("TWITTER_API_IO_KEY")

# X (Twitter) OAuth 2.0 configuration (official X API for posting)
config :clippster_server, :twitter_oauth,
  client_id: System.get_env("TWITTER_CLIENT_ID"),
  client_secret: System.get_env("TWITTER_CLIENT_SECRET"),
  redirect_uri: System.get_env("TWITTER_REDIRECT_URI")

# Social provider mode switch:
# - legacy: current direct platform integrations only
# - post_for_me: Post For Me only
# - dual: write to both, legacy remains read source during rollout
social_provider_mode =
  (System.get_env("SOCIAL_PROVIDER_MODE") || "legacy")
  |> String.trim()
  |> String.downcase()

social_provider_mode =
  if social_provider_mode in ["legacy", "post_for_me", "dual"],
    do: social_provider_mode,
    else: "legacy"

post_for_me_timeout_ms =
  case Integer.parse(System.get_env("POST_FOR_ME_TIMEOUT_MS") || "") do
    {value, _} when value > 0 -> value
    _ -> 30_000
  end

post_for_me_max_retries =
  case Integer.parse(System.get_env("POST_FOR_ME_MAX_RETRIES") || "") do
    {value, _} when value > 0 -> value
    _ -> 3
  end

post_for_me_connect_session_ttl_seconds =
  case Integer.parse(System.get_env("POST_FOR_ME_CONNECT_SESSION_TTL_SECONDS") || "") do
    {value, _} when value > 0 -> value
    _ -> 900
  end

post_for_me_callback_url =
  System.get_env("POST_FOR_ME_CALLBACK_URL") ||
    if config_env() == :prod do
      "https://#{System.get_env("PHX_HOST") || "api.clippster.app"}/api/auth/postforme/callback"
    else
      "http://localhost:4000/api/auth/postforme/callback"
    end

config :clippster_server, :social_provider_mode, social_provider_mode

config :clippster_server, :post_for_me,
  api_key: System.get_env("POST_FOR_ME_API_KEY"),
  base_url: System.get_env("POST_FOR_ME_BASE_URL") || "https://api.postforme.dev",
  timeout_ms: post_for_me_timeout_ms,
  max_retries: post_for_me_max_retries,
  callback_url: post_for_me_callback_url,
  project_id: System.get_env("POST_FOR_ME_PROJECT_ID"),
  connect_session_ttl_seconds: post_for_me_connect_session_ttl_seconds

# Freesound API (sound effects search proxy)
config :clippster_server, :freesound, api_key: System.get_env("FREESOUND_API_KEY")

# PulseKit error tracking and event monitoring
pulsekit_key = System.get_env("PULSEKIT_CLIPPSTER_SERVER_KEY")
pulsekit_endpoint = System.get_env("PULSEKIT_ENDPOINT") || "https://pulsekit.fly.dev"

if pulsekit_key do
  config :pulsekit,
    endpoint: pulsekit_endpoint,
    api_key: pulsekit_key,
    environment: config_env() |> to_string()
end

# Cloudflare R2 storage configuration (for organization assets)
r2_account_id = System.get_env("R2_ACCOUNT_ID")

config :clippster_server, :r2,
  account_id: r2_account_id,
  access_key_id: System.get_env("R2_ACCESS_KEY_ID"),
  secret_access_key: System.get_env("R2_SECRET_ACCESS_KEY"),
  bucket_name: System.get_env("R2_BUCKET_NAME") || "clippster-org-assets",
  public_url: System.get_env("R2_PUBLIC_URL")

# ExAws configuration for Cloudflare R2 with proper TLS settings
# Hackney needs specific SSL options to work with Cloudflare
if r2_account_id do
  r2_host = String.to_charlist("#{r2_account_id}.r2.cloudflarestorage.com")

  config :ex_aws, :hackney_opts,
    follow_redirect: true,
    connect_timeout: 60_000,
    recv_timeout: 60_000,
    # TLS settings for Cloudflare R2
    ssl_options: [
      # Use TLS 1.2 for broad compatibility (works on Windows)
      versions: [:"tlsv1.2"],
      # Server Name Indication - CRITICAL for Cloudflare
      server_name_indication: r2_host,
      # Use CA certificates from certifi for proper certificate validation
      cacertfile: :certifi.cacertfile(),
      # Enable proper certificate verification
      verify: :verify_peer,
      # Certificate chain verification depth
      depth: 3,
      # Proper hostname verification for OTP 21+
      customize_hostname_check: [
        match_fun: :public_key.pkix_verify_hostname_match_fun(:https)
      ]
    ]
end

# ## Using releases
#
# If you use `mix release`, you need to explicitly enable the server
# by passing the PHX_SERVER=true when you start it:
#
#     PHX_SERVER=true bin/clippster_server start
#
# Alternatively, you can use `mix phx.gen.release` to generate a `bin/server`
# script that automatically sets the env var above.
if System.get_env("PHX_SERVER") do
  config :clippster_server, ClippsterServerWeb.Endpoint, server: true
end

if config_env() == :prod do
  database_url =
    System.get_env("DATABASE_URL") ||
      raise """
      environment variable DATABASE_URL is missing.
      For example: ecto://USER:PASS@HOST/DATABASE
      """

  # Ensure we connect to the primary for read-write operations (Fly MPG)
  # This prevents "read_only_sql_transaction" errors when connecting to replicas
  database_url =
    if String.contains?(database_url, "target_session_attrs") do
      database_url
    else
      separator = if String.contains?(database_url, "?"), do: "&", else: "?"
      database_url <> separator <> "target_session_attrs=read-write"
    end

  maybe_ipv6 = if System.get_env("ECTO_IPV6") in ~w(true 1), do: [:inet6], else: []

  config :clippster_server, ClippsterServer.Repo,
    # ssl: true,
    url: database_url,
    pool_size: String.to_integer(System.get_env("POOL_SIZE") || "10"),
    # For machines with several cores, consider starting multiple pools of `pool_size`
    # pool_count: 4,
    socket_options: maybe_ipv6

  # The secret key base is used to sign/encrypt cookies and other secrets.
  # A default value is used in config/dev.exs and config/test.exs but you
  # want to use a different value for prod and you most likely don't want
  # to check this value into version control, so we use an environment
  # variable instead.
  secret_key_base =
    System.get_env("SECRET_KEY_BASE") ||
      raise """
      environment variable SECRET_KEY_BASE is missing.
      You can generate one by calling: mix phx.gen.secret
      """

  host = System.get_env("PHX_HOST") || "example.com"
  port = String.to_integer(System.get_env("PORT") || "4000")

  config :clippster_server, :dns_cluster_query, System.get_env("DNS_CLUSTER_QUERY")

  config :clippster_server, ClippsterServerWeb.Endpoint,
    url: [host: host, port: 443, scheme: "https"],
    http: [
      # Enable IPv6 and bind on all interfaces.
      # Set it to  {0, 0, 0, 0, 0, 0, 0, 1} for local network only access.
      # See the documentation on https://hexdocs.pm/bandit/Bandit.html#t:options/0
      # for details about using IPv6 vs IPv4 and loopback vs public addresses.
      ip: {0, 0, 0, 0, 0, 0, 0, 0},
      port: port
    ],
    secret_key_base: secret_key_base,
    # Allow WebSocket connections from Tauri desktop app
    check_origin: [
      "//clippster-server.fly.dev",
      "//api.clippster.app",
      # Landing app origins (production web app)
      "//clippster.app",
      "//www.clippster.app",
      # Tauri custom protocol
      "tauri://localhost",
      "https://tauri.localhost",
      "http://tauri.localhost",
      # Tauri localhost plugin (production desktop origin uses random loopback port)
      "//localhost",
      "//127.0.0.1"
    ]

  # ## SSL Support
  #
  # To get SSL working, you will need to add the `https` key
  # to your endpoint configuration:
  #
  #     config :clippster_server, ClippsterServerWeb.Endpoint,
  #       https: [
  #         ...,
  #         port: 443,
  #         cipher_suite: :strong,
  #         keyfile: System.get_env("SOME_APP_SSL_KEY_PATH"),
  #         certfile: System.get_env("SOME_APP_SSL_CERT_PATH")
  #       ]
  #
  # The `cipher_suite` is set to `:strong` to support only the
  # latest and more secure SSL ciphers. This means old browsers
  # and clients may not be supported. You can set it to
  # `:compatible` for wider support.
  #
  # `:keyfile` and `:certfile` expect an absolute path to the key
  # and cert in disk or a relative path inside priv, for example
  # "priv/ssl/server.key". For all supported SSL configuration
  # options, see https://hexdocs.pm/plug/Plug.SSL.html#configure/1
  #
  # We also recommend setting `force_ssl` in your config/prod.exs,
  # ensuring no data is ever sent via http, always redirecting to https:
  #
  #     config :clippster_server, ClippsterServerWeb.Endpoint,
  #       force_ssl: [hsts: true]
  #
  # Check `Plug.SSL` for all available options in `force_ssl`.

  # ## Configuring the mailer
  #
  # In production you need to configure the mailer to use a different adapter.
  # Here is an example configuration for Mailgun:
  #
  #     config :clippster_server, ClippsterServer.Mailer,
  #       adapter: Swoosh.Adapters.Mailgun,
  #       api_key: System.get_env("MAILGUN_API_KEY"),
  #       domain: System.get_env("MAILGUN_DOMAIN")
  #
  # Most non-SMTP adapters require an API client. Swoosh supports Req, Hackney,
  # and Finch out-of-the-box. This configuration is typically done at
  # compile-time in your config/prod.exs:
  #
  #     config :swoosh, :api_client, Swoosh.ApiClient.Req
  #
  # See https://hexdocs.pm/swoosh/Swoosh.html#module-installation for details.
end
