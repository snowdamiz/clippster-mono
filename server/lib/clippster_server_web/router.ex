defmodule ClippsterServerWeb.Router do
  use ClippsterServerWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
    plug CORSPlug, origin: ["tauri://localhost", "http://localhost:5173", "http://localhost:*"]
  end

  scope "/api", ClippsterServerWeb do
    pipe_through :api

    # Wallet authentication routes
    post "/auth/challenge", AuthController, :request_challenge
    post "/auth/verify", AuthController, :verify_signature
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
