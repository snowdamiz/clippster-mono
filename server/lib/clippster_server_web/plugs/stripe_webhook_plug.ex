defmodule ClippsterServerWeb.StripeWebhookPlug do
  @moduledoc """
  Custom body reader that caches the raw body for Stripe webhook signature verification.
  Used as body_reader option in Plug.Parsers.
  """

  @doc """
  Reads the body and caches it in conn.assigns for Stripe webhook verification.
  For all other paths, delegates directly to Plug.Conn.read_body/2 so that
  multipart uploads are streamed and parsed correctly by Plug.Parsers.
  """
  def read_body(%{request_path: "/api/stripe/webhook"} = conn, opts) do
    case read_full_body(conn, opts, []) do
      {:ok, body, conn} ->
        conn = Plug.Conn.assign(conn, :raw_body, body)
        {:ok, body, conn}

      {:error, reason} ->
        {:error, reason}
    end
  end

  def read_body(conn, opts) do
    Plug.Conn.read_body(conn, opts)
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
