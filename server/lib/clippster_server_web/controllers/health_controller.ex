defmodule ClippsterServerWeb.HealthController do
  @moduledoc """
  Health check endpoint for Fly.io and load balancers.
  """
  use ClippsterServerWeb, :controller

  @doc """
  Simple health check endpoint.
  Returns 200 OK if the server is running.
  Optionally checks database connectivity.
  """
  def check(conn, _params) do
    # Basic health check - just confirms the server is running
    json(conn, %{
      status: "ok",
      timestamp: DateTime.utc_now() |> DateTime.to_iso8601()
    })
  end

  @doc """
  Deep health check that also verifies database connectivity.
  Use this for more thorough health monitoring.
  """
  def deep_check(conn, _params) do
    db_status = check_database()

    status = if db_status == :ok, do: "ok", else: "degraded"
    http_status = if db_status == :ok, do: 200, else: 503

    conn
    |> put_status(http_status)
    |> json(%{
      status: status,
      timestamp: DateTime.utc_now() |> DateTime.to_iso8601(),
      checks: %{
        database: db_status == :ok
      }
    })
  end

  defp check_database do
    try do
      # Simple query to check database connectivity
      ClippsterServer.Repo.query("SELECT 1")
      :ok
    rescue
      _ -> :error
    end
  end
end
