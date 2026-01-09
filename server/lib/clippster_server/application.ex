defmodule ClippsterServer.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    # Load environment variables from .env file in development only
    # In production (Fly.io), env vars come from fly secrets
    if Application.get_env(:clippster_server, :load_dotenv, false) do
      load_dotenv()
    end

    # Run migrations automatically on startup in dev only
    # In production, migrations are run via release_command in fly.toml
    if Application.get_env(:clippster_server, :auto_migrate, false) do
      ClippsterServer.Release.migrate()
    end

    children = [
      ClippsterServerWeb.Telemetry,
      ClippsterServer.Repo,
      {DNSCluster, query: Application.get_env(:clippster_server, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: ClippsterServer.PubSub},
      # Start Finch HTTP client with optimized settings for reliability
      {Finch,
        name: ClippsterFinch,
        pools: %{
          # Use HTTP/1.1 for Whisper API - more reliable for large file uploads
          # and avoids HTTP/2 connection reuse issues (Mint.TransportError :closed)
          "https://api.lemonfox.ai" => [
            protocols: [:http1],
            # Multiple pools for better isolation (if one pool has issues, others still work)
            count: 4,
            # Connections per pool
            size: 5,
            # Close idle connections after 30 seconds to prevent server-side closure
            # Most servers close idle connections after 60-120s, so 30s is safe
            conn_max_idle_time: 30_000,
            conn_opts: [
              # Connection establishment timeout
              transport_opts: [timeout: 30_000]
            ]
          ],
          # Default pool for other requests (OpenRouter, etc.)
          :default => [
            size: 10,
            count: 2,
            conn_max_idle_time: 60_000,
            conn_opts: [
              transport_opts: [timeout: 30_000]
            ]
          ]
        }
      },
      # Start a worker by calling: ClippsterServer.Worker.start_link(arg)
      # {ClippsterServer.Worker, arg},
      # Wallet authentication challenge store
      ClippsterServer.Auth.ChallengeStore,
      # Price service for SOL/USD rates
      ClippsterServer.PriceService,
      # Social media analytics sync worker
      ClippsterServer.Social.AnalyticsSyncWorker,
      # Social media token refresh worker
      ClippsterServer.Social.TokenRefreshWorker,
      # Shared clips cleanup worker (deletes expired clips daily)
      ClippsterServer.Organizations.SharedClipCleanupWorker,
      # Release info cache for landing page downloads
      ClippsterServer.ReleaseService,
      # Start to serve requests, typically the last entry
      ClippsterServerWeb.Endpoint
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: ClippsterServer.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    ClippsterServerWeb.Endpoint.config_change(changed, removed)
    :ok
  end

  # Load environment variables from .env file
  defp load_dotenv do
    env_file = Path.join(File.cwd!(), ".env")

    if File.exists?(env_file) do
      try do
        env_vars = Dotenvy.source!(env_file)
        Enum.each(env_vars, fn {key, value} -> System.put_env(key, value) end)
      rescue
        e -> IO.puts("[warning] Failed to load .env file: #{inspect(e)}")
      end
    end
  end
end
