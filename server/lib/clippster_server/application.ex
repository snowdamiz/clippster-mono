defmodule ClippsterServer.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    # Load environment variables from .env file
    env_file = Path.join(File.cwd!(), ".env")
    
    if File.exists?(env_file) do
      try do
        # Load and parse .env file, then set each environment variable
        env_vars = Dotenvy.source!(env_file)
        Enum.each(env_vars, fn {key, value} -> System.put_env(key, value) end)
      rescue
        e -> IO.puts("[warning] Failed to load .env file: #{inspect(e)}")
      end
    end

    # Run migrations automatically on startup
    ClippsterServer.Release.migrate()

    children = [
      ClippsterServerWeb.Telemetry,
      ClippsterServer.Repo,
      {DNSCluster, query: Application.get_env(:clippster_server, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: ClippsterServer.PubSub},
      # Start Finch HTTP client
      {Finch, name: ClippsterFinch},
      # Start a worker by calling: ClippsterServer.Worker.start_link(arg)
      # {ClippsterServer.Worker, arg},
      # Wallet authentication challenge store
      ClippsterServer.Auth.ChallengeStore,
      # Price service for SOL/USD rates
      ClippsterServer.PriceService,
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
end
