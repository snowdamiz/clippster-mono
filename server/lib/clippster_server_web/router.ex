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

  pipeline :api_admin do
    plug :accepts, ["json"]
    plug ClippsterServerWeb.AuthPlug
    plug ClippsterServerWeb.AdminPlug
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

    # Google OAuth routes
    get "/auth/google", AuthController, :google_request
    get "/auth/google/callback", AuthController, :google_callback

    # Email authentication routes
    post "/auth/email/register", EmailAuthController, :register
    post "/auth/email/verify-otp", EmailAuthController, :verify_otp
    get "/auth/email/verify/:token", EmailAuthController, :verify_token
    post "/auth/email/login", EmailAuthController, :login
    post "/auth/email/resend-verification", EmailAuthController, :resend_verification
    post "/auth/email/forgot-password", EmailAuthController, :forgot_password
    post "/auth/email/reset-password", EmailAuthController, :reset_password

    # Payment and credit routes
    get "/pricing", PaymentController, :get_pricing
    get "/credits/balance", PaymentController, :get_balance
    post "/payments/quote", PaymentController, :get_quote
    post "/payments/confirm", PaymentController, :confirm_payment

    # Stripe payment routes (webhook is public, no auth needed)
    post "/stripe/webhook", StripeController, :webhook

    # Metadata routes
    get "/metadata/:mint_id", MetadataController, :fetch

    # Kick routes
    get "/kick/channels/:channel_slug/videos", KickController, :get_clips

    # Organization invitation (public - for viewing invitation details)
    get "/invitations/:token", OrganizationController, :get_invitation
  end

  # Protected routes (require authentication)
  scope "/api", ClippsterServerWeb do
    pipe_through :api_auth

    # Get current user info (refreshes user data from server)
    get "/auth/me", AuthController, :me

    post "/clips/detect", ClipsController, :detect
    post "/clips/detect-chunked", ClipsController, :detect_chunked
    post "/clips/transcribe", ClipsController, :transcribe

    # Speaker detection and framing strategy
    post "/clips/:clip_id/analyze-speakers", SpeakerDetectionController, :analyze
    post "/clips/:clip_id/classify-video", SpeakerDetectionController, :classify

    # Processing job management (for cancellation/refunds)
    get "/jobs/:job_id", ProcessingJobController, :show
    post "/jobs/:job_id/cancel", ProcessingJobController, :cancel
    post "/jobs/cancel-by-project", ProcessingJobController, :cancel_by_project

    # Stripe checkout session creation (requires auth)
    post "/payments/stripe/create-session", StripeController, :create_checkout_session

    # Bug report creation (requires authentication)
    post "/bug-reports", BugReportsController, :create

    # OAuth account linking routes
    post "/auth/link/google", AuthController, :link_google_account

    # Account type selection (for new users)
    post "/account/type", OrganizationController, :set_account_type

    # Organization management
    resources "/organizations", OrganizationController, only: [:index, :create, :show, :update, :delete]

    # Organization members
    get "/organizations/:organization_id/members", OrganizationController, :list_members
    put "/organizations/:organization_id/members/:user_id", OrganizationController, :update_member
    patch "/organizations/:organization_id/members/:user_id/account", OrganizationController, :update_member_account
    delete "/organizations/:organization_id/members/:user_id", OrganizationController, :remove_member

    # Organization invitations
    get "/organizations/:organization_id/invitations", OrganizationController, :list_invitations
    post "/organizations/:organization_id/invitations", OrganizationController, :create_invitation
    post "/organizations/:organization_id/invitations/:id/resend", OrganizationController, :resend_invitation
    delete "/organizations/:organization_id/invitations/:id", OrganizationController, :cancel_invitation
    post "/invitations/:token/accept", OrganizationController, :accept_invitation

    # Create member account directly (admin creates account for user)
    post "/organizations/:organization_id/create-member", OrganizationController, :create_member_account

    # Organization credits
    get "/organizations/:organization_id/credits", OrganizationController, :get_credits
    post "/organizations/:organization_id/credits/allocate", OrganizationController, :allocate_credits
    get "/organizations/:organization_id/transactions", OrganizationController, :get_transactions

    # Organization payments (Stripe)
    post "/organizations/:organization_id/payments/stripe/create-session", StripeController, :create_org_checkout_session

    # Organization payments (Crypto/SOL)
    post "/organizations/:organization_id/payments/quote", PaymentController, :get_org_quote
    post "/organizations/:organization_id/payments/confirm", PaymentController, :confirm_org_payment

    # Organization assets
    get "/organizations/:organization_id/assets", OrganizationAssetController, :index
    get "/organizations/:organization_id/assets/:id", OrganizationAssetController, :show
    post "/organizations/:organization_id/assets", OrganizationAssetController, :create
    put "/organizations/:organization_id/assets/:id", OrganizationAssetController, :update
    delete "/organizations/:organization_id/assets/:id", OrganizationAssetController, :delete

    # User's organization assets (for sync)
    get "/user/organization-assets", OrganizationAssetController, :user_assets
  end

  # Admin-only routes
  scope "/api", ClippsterServerWeb do
    pipe_through :api_admin

    get "/admin/users", AdminController, :list_users
    get "/admin/ai-usage", AdminController, :get_ai_usage_stats
    post "/admin/users/:user_id/promote", AdminController, :promote_user
    put "/admin/users/:user_id/credits", AdminController, :update_user_credits

    # Admin organization management
    get "/admin/organizations", AdminController, :list_organizations
    get "/admin/organizations/:organization_id/credits", AdminController, :get_org_credits
    post "/admin/organizations/:organization_id/credits/add", AdminController, :add_org_credits
    put "/admin/organizations/:organization_id/credits", AdminController, :set_org_credits

    # Admin bug report management
    get "/admin/bug-reports", BugReportsController, :index
    put "/admin/bug-reports/:id", BugReportsController, :update
    delete "/admin/bug-reports/:id", BugReportsController, :delete
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
