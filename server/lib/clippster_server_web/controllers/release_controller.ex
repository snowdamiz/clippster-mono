defmodule ClippsterServerWeb.ReleaseController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.ReleaseService

  @doc """
  Returns the latest release information with platform-specific download URLs.
  This endpoint is cached server-side and returns instantly.
  """
  def latest(conn, _params) do
    case ReleaseService.get_latest_release() do
      {:ok, release} ->
        conn
        |> put_resp_header("cache-control", "public, max-age=300")
        |> json(release)

      {:error, _reason} ->
        conn
        |> put_status(:service_unavailable)
        |> json(%{
          error: "Unable to fetch release information",
          fallback_url: "https://github.com/snowdamiz/clippster-releases/releases/latest"
        })
    end
  end
end
