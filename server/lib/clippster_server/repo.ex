defmodule ClippsterServer.Repo do
  use Ecto.Repo,
    otp_app: :clippster_server,
    adapter: Ecto.Adapters.Postgres
end
