defmodule ClippsterServer.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      ClippsterServerWeb.Telemetry,
      ClippsterServer.Repo,
      {DNSCluster, query: Application.get_env(:clippster_server, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: ClippsterServer.PubSub},
      # Start a worker by calling: ClippsterServer.Worker.start_link(arg)
      # {ClippsterServer.Worker, arg},
      # Wallet authentication challenge store
      ClippsterServer.Auth.ChallengeStore,
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
