defmodule ClippsterServerWeb.StripeWebhookPlug do
  @moduledoc """
  Custom body reader that caches the raw body for Stripe webhook signature verification.
  Used as body_reader option in Plug.Parsers.
  """

  @doc """
  Reads the body and caches it in conn.assigns for Stripe webhook verification.
  """
  def read_body(conn, opts) do
    {:ok, body, conn} = Plug.Conn.read_body(conn, opts)
    
    # Cache raw body for webhook endpoints that need signature verification
    conn = if conn.request_path in ["/api/stripe/webhook", "/api/webhooks/lemonsqueezy"] do
      Plug.Conn.assign(conn, :raw_body, body)
    else
      conn
    end
    
    {:ok, body, conn}
  end
end
