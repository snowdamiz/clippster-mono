defmodule ClippsterServerWeb.StripeRedirectController do
  use ClippsterServerWeb, :controller

  def success(conn, _params) do
    frontend_base_url =
      Application.get_env(:clippster_server, :frontend_base_url, "https://clippster.app")

    html = """
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Payment Successful</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0b0c; color: #f4f4f5; margin: 0; min-height: 100vh; display: grid; place-items: center; }
          .card { width: min(92vw, 540px); border: 1px solid #27272a; background: #111114; border-radius: 14px; padding: 24px; text-align: center; }
          h1 { color: #22c55e; margin: 0 0 10px; font-size: 1.5rem; }
          p { color: #a1a1aa; margin: 0 0 18px; line-height: 1.5; }
          a { color: #38bdf8; text-decoration: none; }
        </style>
      </head>
      <body>
        <main class="card">
          <h1>Payment Successful</h1>
          <p>Your payment has been received. You can close this tab and return to the app.</p>
          <p><a href="#{frontend_base_url}">Back to Clippster</a></p>
        </main>
      </body>
    </html>
    """

    conn
    |> put_resp_content_type("text/html")
    |> send_resp(200, html)
  end

  def cancel(conn, _params) do
    frontend_base_url =
      Application.get_env(:clippster_server, :frontend_base_url, "https://clippster.app")

    html = """
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Payment Cancelled</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b0b0c; color: #f4f4f5; margin: 0; min-height: 100vh; display: grid; place-items: center; }
          .card { width: min(92vw, 540px); border: 1px solid #27272a; background: #111114; border-radius: 14px; padding: 24px; text-align: center; }
          h1 { color: #f59e0b; margin: 0 0 10px; font-size: 1.5rem; }
          p { color: #a1a1aa; margin: 0 0 18px; line-height: 1.5; }
          a { color: #38bdf8; text-decoration: none; }
        </style>
      </head>
      <body>
        <main class="card">
          <h1>Payment Cancelled</h1>
          <p>No charge was made. You can close this tab and try again.</p>
          <p><a href="#{frontend_base_url}">Back to Clippster</a></p>
        </main>
      </body>
    </html>
    """

    conn
    |> put_resp_content_type("text/html")
    |> send_resp(200, html)
  end
end
