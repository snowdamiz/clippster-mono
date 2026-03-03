defmodule ClippsterServerWeb.SafeParsers do
  @moduledoc """
  Wraps Plug.Parsers to catch RequestTooLargeError and return a proper
  JSON 413 response instead of raising an exception. This preserves
  CORS headers already set by CORSPlug on the conn.
  """
  @behaviour Plug

  @parsers_opts [
    parsers: [
      :urlencoded,
      # Multipart gets its own 500MB limit for large video uploads.
      # Note: body_reader is NOT used by MULTIPART — it uses Plug.Conn directly.
      {:multipart, length: 500_000_000, read_length: 10_000_000, read_timeout: 300_000},
      :json
    ],
    pass: ["*/*"],
    json_decoder: Phoenix.json_library(),
    # 20MB default for JSON/urlencoded bodies
    length: 20_000_000,
    # Capture raw body for Stripe webhooks
    body_reader: {ClippsterServerWeb.StripeWebhookPlug, :read_body, []}
  ]

  @impl true
  def init(_opts), do: Plug.Parsers.init(@parsers_opts)

  @impl true
  def call(conn, opts) do
    Plug.Parsers.call(conn, opts)
  rescue
    Plug.Parsers.RequestTooLargeError ->
      conn
      |> Plug.Conn.put_resp_content_type("application/json")
      |> Plug.Conn.send_resp(413, Jason.encode!(%{
        success: false,
        error: "File too large. Maximum upload size is 500MB."
      }))
      |> Plug.Conn.halt()
  end
end
