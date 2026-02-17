defmodule ClippsterServerWeb.ModeratorPlug do
  @moduledoc """
  Plug to ensure the user is either an admin or a moderator.
  Used for routes that both admins and moderators can access.
  """

  import Plug.Conn
  import Phoenix.Controller

  def init(opts), do: opts

  def call(conn, _opts) do
    is_admin = conn.assigns[:is_admin] || false
    is_moderator = conn.assigns[:is_moderator] || false

    if is_admin or is_moderator do
      conn
    else
      conn
      |> put_status(:forbidden)
      |> json(%{error: "Admin or moderator access required"})
      |> halt()
    end
  end
end
