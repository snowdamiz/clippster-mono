defmodule ClippsterServerWeb.BetaController do
  use ClippsterServerWeb, :controller

  alias ClippsterServer.BetaCodes
  alias ClippsterServer.AppSettings

  @doc """
  Activates a user's account using a beta code.
  Requires authentication.
  """
  def activate(conn, %{"code" => code}) do
    user_id = conn.assigns.current_user_id

    # Check if beta mode is even enabled
    unless AppSettings.is_beta_mode_enabled?() do
      json(conn, %{
        success: true,
        message: "Beta mode is not enabled, no activation needed"
      })
    else
      case BetaCodes.validate_and_use_code(code, user_id) do
        {:ok, _beta_code} ->
          json(conn, %{
            success: true,
            message: "Account successfully activated for beta access"
          })

        {:error, :invalid_code} ->
          conn
          |> put_status(400)
          |> json(%{success: false, error: "Invalid or already used beta code"})

        {:error, :not_found} ->
          conn
          |> put_status(404)
          |> json(%{success: false, error: "User not found"})

        {:error, reason} ->
          conn
          |> put_status(500)
          |> json(%{success: false, error: "Failed to activate: #{inspect(reason)}"})
      end
    end
  end

  def activate(conn, _params) do
    conn
    |> put_status(400)
    |> json(%{success: false, error: "Missing required parameter: code"})
  end

  @doc """
  Verifies a beta code for landing page access (public endpoint).
  Does not consume the code, only checks validity and records verification.
  """
  def verify_code(conn, %{"code" => code}) do
    # Get IP address from connection
    ip_address = get_ip_address(conn)

    case BetaCodes.verify_code_for_landing(code, ip_address) do
      {:ok, _beta_code} ->
        json(conn, %{valid: true})

      {:error, _reason} ->
        json(conn, %{valid: false})
    end
  end

  def verify_code(conn, _params) do
    conn
    |> put_status(400)
    |> json(%{success: false, error: "Missing required parameter: code"})
  end

  defp get_ip_address(conn) do
    case Plug.Conn.get_req_header(conn, "x-forwarded-for") do
      [ip | _] -> ip
      [] -> to_string(:inet.ntoa(conn.remote_ip))
    end
  end
end
