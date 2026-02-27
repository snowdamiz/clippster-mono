defmodule ClippsterServerWeb.AuthPlug do
  @moduledoc """
  Plug to handle JWT authentication for protected routes.
  """
  import Plug.Conn
  alias ClippsterServer.Auth.TokenGenerator
  alias ClippsterServer.Accounts

  def init(opts), do: opts

  def call(conn, _opts) do
    auth_header = get_req_header(conn, "authorization")
    path = conn.request_path

    case auth_header do
      ["Bearer " <> token] ->
        IO.puts("[AuthPlug] #{path} - Token received (#{String.length(token)} chars)")
        verify_token(conn, token)

      [] ->
        IO.puts("[AuthPlug] #{path} - No Authorization header!")

        conn
        |> put_status(401)
        |> Phoenix.Controller.json(%{error: "Authentication required"})
        |> halt()

      other ->
        IO.puts("[AuthPlug] #{path} - Invalid header format: #{inspect(other)}")

        conn
        |> put_status(401)
        |> Phoenix.Controller.json(%{error: "Authentication required"})
        |> halt()
    end
  end

  defp verify_token(conn, token) do
    case TokenGenerator.verify_token(token) do
      {:ok, claims} ->
        user_id = claims["user_id"]

        # Load the full user record
        case Accounts.get_user(user_id) do
          nil ->
            # User doesn't exist (was deleted or invalid user_id)
            conn
            |> put_status(401)
            |> Phoenix.Controller.json(%{error: "User not found"})
            |> halt()

          user ->
            # Add user info to conn assigns
            conn
            |> assign(:current_user_id, user_id)
            |> assign(:current_user, user)
            |> assign(:current_wallet_address, claims["wallet_address"])
            |> assign(:is_admin, user.is_admin)
            |> assign(:is_moderator, user.is_moderator)
            |> assign(:is_restricted, user.is_restricted)
            |> assign(:current_user_claims, claims)
        end

      {:error, _reason} ->
        conn
        |> put_status(401)
        |> Phoenix.Controller.json(%{error: "Invalid or expired token"})
        |> halt()
    end
  end
end
