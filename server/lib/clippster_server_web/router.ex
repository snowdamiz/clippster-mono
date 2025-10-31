defmodule ClippsterServerWeb.Router do
  use ClippsterServerWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
    plug CORSPlug,
      origin: &__MODULE__.cors_origins/0,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      headers: ["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
      max_age: 86400
  end

  pipeline :api_auth do
    plug :accepts, ["json"]
    plug ClippsterServerWeb.AuthPlug
    plug CORSPlug,
      origin: &__MODULE__.cors_origins/0,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      headers: ["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
      max_age: 86400
  end

  # Define CORS origins as a function to handle regex properly
  def cors_origins do
    [
      "tauri://localhost",
      "http://localhost:5173",
      "http://localhost:1420",
      ~r/http:\/\/localhost:\d+/
    ]
  end

  scope "/api", ClippsterServerWeb do
    pipe_through :api

    # Handle OPTIONS requests for CORS preflight
    options "/*path", AuthController, :options

    # Wallet authentication routes
    post "/auth/challenge", AuthController, :request_challenge
    post "/auth/verify", AuthController, :verify_signature

    # Payment and credit routes
    get "/pricing", PaymentController, :get_pricing
    get "/credits/balance", PaymentController, :get_balance
    post "/payments/quote", PaymentController, :get_quote
    post "/payments/confirm", PaymentController, :confirm_payment
  end

  # Protected routes (require authentication)
  scope "/api", ClippsterServerWeb do
    pipe_through :api_auth

    post "/clips/detect", ClipsController, :detect
  end

  # Enable LiveDashboard and Swoosh mailbox preview in development
  if Application.compile_env(:clippster_server, :dev_routes) do
    # If you want to use the LiveDashboard in production, you should put
    # it behind authentication and allow only admins to access it.
    # If your application does not have an admins-only section yet,
    # you can use Plug.BasicAuth to set up some basic authentication
    # as long as you are also using SSL (which you should anyway).
    import Phoenix.LiveDashboard.Router

    scope "/dev" do
      pipe_through [:fetch_session, :protect_from_forgery]

      live_dashboard "/dashboard", metrics: ClippsterServerWeb.Telemetry
      forward "/mailbox", Plug.Swoosh.MailboxPreview
    end
  end
end
