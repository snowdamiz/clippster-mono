defmodule ClippsterServerWeb.AuthPlug do
  @moduledoc """
  Plug to handle JWT authentication for protected routes.
  """
  import Plug.Conn
  alias ClippsterServer.Auth.TokenGenerator

  def init(opts), do: opts

  def call(conn, _opts) do
    conn
    |> get_req_header("authorization")
    |> case do
      ["Bearer " <> token] -> verify_token(conn, token)
      _ ->
        conn
        |> put_status(401)
        |> Phoenix.Controller.json(%{error: "Authentication required"})
        |> halt()
    end
  end

  defp verify_token(conn, token) do
    case TokenGenerator.verify_token(token) do
      {:ok, claims} ->
        # Add user info to conn assigns
        conn
        |> assign(:current_user_id, claims["user_id"])
        |> assign(:current_wallet_address, claims["wallet_address"])
        |> assign(:is_admin, claims["is_admin"])
        |> assign(:current_user_claims, claims)

      {:error, _reason} ->
        conn
        |> put_status(401)
        |> Phoenix.Controller.json(%{error: "Invalid or expired token"})
        |> halt()
    end
  end
end