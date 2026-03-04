defmodule ClippsterServerWeb.RateLimit do
  @moduledoc """
  Rate limiting plug backed by PostgreSQL.
  Uses an atomic INSERT ... ON CONFLICT upsert so the counter is shared
  across all nodes and requires no external dependencies.
  """
  import Plug.Conn
  import Phoenix.Controller

  alias ClippsterServer.Repo

  def init(opts) do
    %{
      max_requests: Keyword.get(opts, :max_requests, 10),
      window_seconds: Keyword.get(opts, :window_seconds, 3600),
      identifier: Keyword.get(opts, :identifier, :ip)
    }
  end

  def call(conn, opts) do
    identifier = get_identifier(conn, opts.identifier)
    now = System.system_time(:second)
    # Align window_start to the window boundary (e.g. every 3600s)
    window_start = div(now, opts.window_seconds) * opts.window_seconds
    key = "rate_limit:#{identifier}"

    {:ok, %{rows: [[count]]}} =
      Repo.query(
        """
        INSERT INTO rate_limit_counters (key, window_start, count)
        VALUES ($1, $2, 1)
        ON CONFLICT (key, window_start)
          DO UPDATE SET count = rate_limit_counters.count + 1
        RETURNING count
        """,
        [key, window_start]
      )

    if count <= opts.max_requests do
      conn
    else
      retry_after = opts.window_seconds - rem(now - window_start, opts.window_seconds)

      conn
      |> put_status(:too_many_requests)
      |> json(%{
        success: false,
        error: "Too many requests. Please try again later.",
        retry_after: retry_after
      })
      |> halt()
    end
  end

  defp get_identifier(conn, :ip) do
    case get_req_header(conn, "x-forwarded-for") do
      [ip | _] -> ip
      [] -> to_string(:inet.ntoa(conn.remote_ip))
    end
  end

  defp get_identifier(conn, :user_id) do
    conn.assigns[:current_user_id] || get_identifier(conn, :ip)
  end
end
