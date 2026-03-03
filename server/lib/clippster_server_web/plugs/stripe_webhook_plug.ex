defmodule ClippsterServerWeb.StripeWebhookPlug do
  @moduledoc """
  Custom body reader that caches the raw body for Stripe webhook signature verification.
  Used as body_reader option in Plug.Parsers.
  """

  @doc """
  Reads the body and caches it in conn.assigns for Stripe webhook verification.
  For non-Stripe routes, delegates directly to Plug.Conn.read_body to allow
  multipart streaming (required for large file uploads).
  """
  def read_body(conn, opts) do
    # Ensure we pass through the length option from Plug.Parsers (200MB limit)
    read_opts = Keyword.put_new(opts, :length, 200_000_000)
    
    if conn.request_path == "/api/stripe/webhook" do
      case read_full_body(conn, read_opts, []) do
        {:ok, body, conn} ->
          conn = Plug.Conn.assign(conn, :raw_body, body)
          {:ok, body, conn}

        {:error, reason} ->
          {:error, reason}
      end
    else
      Plug.Conn.read_body(conn, read_opts)
    end
  end

  defp read_full_body(conn, opts, acc) do
    case Plug.Conn.read_body(conn, opts) do
      {:ok, chunk, conn} ->
        {:ok, IO.iodata_to_binary([acc, chunk]), conn}

      {:more, chunk, conn} ->
        read_full_body(conn, opts, [acc, chunk])

      {:error, reason} ->
        {:error, reason}
    end
  end
end
