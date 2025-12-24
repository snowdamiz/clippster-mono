import Config

# Configures Swoosh API Client
config :swoosh, api_client: Swoosh.ApiClient.Req

# Disable Swoosh Local Memory Storage
config :swoosh, local: false

# Do not print debug messages in production
config :logger, level: :info

# Production settings:
# - Don't load .env file (use fly secrets instead)
# - Don't auto-migrate on startup (use release_command in fly.toml)
config :clippster_server,
  load_dotenv: false,
  auto_migrate: false

# Runtime production configuration, including reading
# of environment variables, is done on config/runtime.exs.
