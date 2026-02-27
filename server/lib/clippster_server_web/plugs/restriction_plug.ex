defmodule ClippsterServerWeb.RestrictionPlug do
  @moduledoc """
  Plug to enforce platform-level user restrictions.
  Restricted users can only access read-only endpoints.
  """

  import Plug.Conn
  import Phoenix.Controller

  # Read-only endpoints that restricted users can access
  @allowed_paths [
    "/api/auth/me",
    "/api/credits/balance",
    "/api/auth/logout"
  ]

  def init(opts), do: opts

  def call(conn, _opts) do
    user = conn.assigns[:current_user]
    is_restricted = user && user.is_restricted

    if is_restricted do
      # Allow GET requests to read-only endpoints
      if conn.method == "GET" and path_allowed?(conn.request_path) do
        conn
      else
        # Block all mutation requests
        conn
        |> put_status(:forbidden)
        |> json(%{
          error: "Account restricted",
          message:
            "Your account has been restricted. Reason: #{user.restricted_reason || "No reason provided"}",
          is_restricted: true,
          restricted_at: user.restricted_at,
          restricted_reason: user.restricted_reason
        })
        |> halt()
      end
    else
      conn
    end
  end

  defp path_allowed?(path) do
    Enum.any?(@allowed_paths, fn allowed_path ->
      String.starts_with?(path, allowed_path)
    end)
  end
end
