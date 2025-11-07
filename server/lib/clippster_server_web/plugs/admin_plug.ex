defmodule ClippsterServerWeb.AdminPlug do
  @moduledoc """
  Plug to ensure only admin users can access certain routes.
  """
  import Plug.Conn

  def init(opts), do: opts

  def call(conn, _opts) do
    if conn.assigns[:is_admin] do
      conn
    else
      conn
      |> put_status(403)
      |> Phoenix.Controller.json(%{error: "Admin access required"})
      |> halt()
    end
  end
end