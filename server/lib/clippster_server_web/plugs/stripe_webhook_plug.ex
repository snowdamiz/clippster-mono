defmodule ClippsterServerWeb.StripeWebhookPlug do
  @moduledoc """
  Custom body reader that caches the raw body for webhook signature verification.
  Used as body_reader option in Plug.Parsers.

  Currently caches for Stripe and Tokend partner webhooks. All other routes
  stream normally so large multipart uploads keep working.
  """

  @raw_body_paths MapSet.new([
                    "/api/stripe/webhook",
                    "/api/tokend/webhook"
                  ])

  @doc """
  Reads the body and caches it in conn.assigns for webhook signature verification.
  For non-webhook routes, delegates directly to Plug.Conn.read_body to allow
  multipart streaming (required for large file uploads).
  """
  def read_body(conn, opts) do
    if MapSet.member?(@raw_body_paths, conn.request_path) do
      case read_full_body(conn, opts, []) do
        {:ok, body, conn} ->
          conn = Plug.Conn.assign(conn, :raw_body, body)
          {:ok, body, conn}

        {:error, reason} ->
          {:error, reason}
      end
    else
      Plug.Conn.read_body(conn, opts)
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
