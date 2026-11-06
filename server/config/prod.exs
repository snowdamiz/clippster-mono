import Config

# Configures Swoosh API Client
config :swoosh, api_client: Swoosh.ApiClient.Req

# Disable Swoosh Local Memory Storage
config :swoosh, local: false

# Do not print debug messages in production
config :logger, level: :info

# Production settings:
# - Don't load .env file (the Cloudflare Worker's secrets and vars are the container's environment)
# - Don't auto-migrate on startup (server/cloudflare/worker.mjs runs migrations before each start)
config :clippster_server,
  load_dotenv: false,
  auto_migrate: false

# Runtime production configuration, including reading
# of environment variables, is done on config/runtime.exs.
