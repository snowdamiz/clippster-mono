defmodule ClippsterServer.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  # Large Whisper uploads need a long TLS idle/send timeout. 30s closes mid-upload
  # of ~10MB bodies and surfaces as "socket closed" from Lemonfox.
  @lemonfox_transport_opts [versions: [:"tlsv1.2"], timeout: 300_000]
  @default_transport_opts [timeout: 30_000]

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
         "https://api.lemonfox.ai" => [
           # HTTP/1.1 is more reliable than H2 for large multipart audio uploads.
           protocols: [:http1],
           count: 4,
           size: 5,
           # Avoid stale keep-alives that Lemonfox closes mid-request.
           conn_max_idle_time: 10_000,
           conn_opts: [
             transport_opts: @lemonfox_transport_opts
           ]
         ],
         # Default pool for other requests (OpenRouter, etc.)
         :default => [
           size: 10,
           count: 2,
           conn_max_idle_time: 60_000,
           conn_opts: [
             transport_opts: @default_transport_opts
           ]
         ]
       }},
      # Start a worker by calling: ClippsterServer.Worker.start_link(arg)
      # {ClippsterServer.Worker, arg},
      # Wallet authentication challenge store
      ClippsterServer.Auth.ChallengeStore,
      # Price service for SOL/USD rates
      ClippsterServer.PriceService,
      # Social media analytics sync worker
      ClippsterServer.Social.AnalyticsSyncWorker,
      # Post For Me connection session cleanup worker
      ClippsterServer.Social.PostForMeConnectionSessionCleanupWorker,
      # Scheduled post publishing worker
      ClippsterServer.Social.ScheduledPostWorker,
      # Shared clips cleanup worker (deletes expired clips daily)
      ClippsterServer.Organizations.SharedClipCleanupWorker,
      # Free tier monthly credit grant worker
      ClippsterServer.Workers.FreeTierCreditWorker,
      # Release info cache for landing page downloads
      ClippsterServer.ReleaseService,
      # Clipper profile workers
      ClippsterServer.ClipperProfiles.LeaderboardWorker,
      ClippsterServer.ClipperProfiles.BadgeWorker,
      ClippsterServer.ClipperProfiles.ResponseTimeWorker,
      # Campaign submission view sync worker
      ClippsterServer.Campaigns.SubmissionViewSyncWorker,
      # Campaign completion worker (marks expired campaigns as completed)
      ClippsterServer.Campaigns.CampaignCompletionWorker,
      # News poller for breaking news feed
      ClippsterServer.News.NewsPoller,
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
