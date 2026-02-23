defmodule ClippsterServerWeb.RateLimit do
  @moduledoc """
  Rate limiting plug to prevent brute force attacks on public endpoints.
  Uses ETS for in-memory rate limit tracking.
  """
  import Plug.Conn
  import Phoenix.Controller

  @table_name :rate_limit_table

  def init(opts) do
    # Create ETS table if it doesn't exist
    case :ets.whereis(@table_name) do
      :undefined ->
        :ets.new(@table_name, [:set, :public, :named_table])
      _ ->
        :ok
    end

    %{
      max_requests: Keyword.get(opts, :max_requests, 10),
      window_seconds: Keyword.get(opts, :window_seconds, 3600),
      identifier: Keyword.get(opts, :identifier, :ip)
    }
  end

  def call(conn, opts) do
    identifier = get_identifier(conn, opts.identifier)
    key = {identifier, :beta_verify}
    now = System.system_time(:second)

    case :ets.lookup(@table_name, key) do
      [] ->
        # First request
        :ets.insert(@table_name, {key, now, 1})
        conn

      [{^key, window_start, count}] ->
        if now - window_start > opts.window_seconds do
          # Window expired, reset
          :ets.insert(@table_name, {key, now, 1})
          conn
        else
          if count >= opts.max_requests do
            # Rate limit exceeded
            conn
            |> put_status(:too_many_requests)
            |> json(%{
              success: false,
              error: "Too many requests. Please try again later.",
              retry_after: opts.window_seconds - (now - window_start)
            })
            |> halt()
          else
            # Increment counter
            :ets.insert(@table_name, {key, window_start, count + 1})
            conn
          end
        end
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
