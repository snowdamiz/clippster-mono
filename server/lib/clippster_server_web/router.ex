defmodule ClippsterServerWeb.Router do
  use ClippsterServerWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
    plug CORSPlug,
      origin: &__MODULE__.cors_origins/0,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      headers: ["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
      max_age: 86400,
      credentials: true
  end

  pipeline :api_auth do
    plug :accepts, ["json"]
    plug CORSPlug,
      origin: &__MODULE__.cors_origins/0,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      headers: ["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
      max_age: 86400,
      credentials: true
    plug ClippsterServerWeb.AuthPlug
  end

  pipeline :api_admin do
    plug :accepts, ["json"]
    plug CORSPlug,
      origin: &__MODULE__.cors_origins/0,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      headers: ["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
      max_age: 86400,
      credentials: true
    plug ClippsterServerWeb.AuthPlug
    plug ClippsterServerWeb.AdminPlug
  end

  # Define CORS origins - must be specific origins (not "*") when Authorization header is used
  # as the browser treats requests with Authorization as credentialed requests
  def cors_origins do
    [
      "tauri://localhost",
      "https://tauri.localhost",
      "http://tauri.localhost",
      "http://localhost:5173",
      "http://localhost:1420",
      "http://localhost:4000",
      # Landing page
      "https://clippster.app",
      "https://www.clippster.app",
      # Match any localhost port
      ~r/^http:\/\/localhost:\d+$/,
      # Match Tauri custom protocols
      ~r/^tauri:\/\//,
      ~r/^https?:\/\/tauri\./
    ]
  end

  scope "/api", ClippsterServerWeb do
    pipe_through :api

    # Health check endpoints for Fly.io and load balancers
    get "/health", HealthController, :check
    get "/health/deep", HealthController, :deep_check

    # Handle OPTIONS requests for CORS preflight
    options "/*path", AuthController, :options

    # Wallet authentication routes
    post "/auth/challenge", AuthController, :request_challenge
    post "/auth/verify", AuthController, :verify_signature

    # Google OAuth routes
    get "/auth/google", AuthController, :google_request
    get "/auth/google/callback", AuthController, :google_callback

    # Instagram OAuth routes (for Tauri desktop app)
    get "/auth/instagram/start", InstagramAuthController, :start_oauth
    get "/auth/instagram/callback", InstagramAuthController, :oauth_callback
    # The client obtains tokens via FB.login() and sends them to POST /social-accounts

    # Email authentication routes
    post "/auth/email/register", EmailAuthController, :register
    post "/auth/email/verify-otp", EmailAuthController, :verify_otp
    get "/auth/email/verify/:token", EmailAuthController, :verify_token
    post "/auth/email/login", EmailAuthController, :login
    post "/auth/email/resend-verification", EmailAuthController, :resend_verification
    post "/auth/email/forgot-password", EmailAuthController, :forgot_password
    post "/auth/email/reset-password", EmailAuthController, :reset_password

    # Payment routes (public - pricing info)
    get "/pricing", PaymentController, :get_pricing
    post "/payments/quote", PaymentController, :get_quote
    post "/payments/confirm", PaymentController, :confirm_payment

    # Stripe payment routes (webhook is public, no auth needed)
    post "/stripe/webhook", StripeController, :webhook

    # Subscription tiers (public - for pricing display)
    get "/subscription/tiers", SubscriptionController, :get_tiers

    # Metadata routes
    get "/metadata/:mint_id", MetadataController, :fetch

    # Kick routes
    get "/kick/channels/:channel_slug/videos", KickController, :get_clips

    # Organization invitation (public - for viewing invitation details)
    get "/invitations/:token", OrganizationController, :get_invitation

    # Public settings/feature flags
    get "/settings/feature-flags", SettingsController, :get_feature_flags

    # App release info (for download buttons on landing page)
    get "/releases/latest", ReleaseController, :latest
  end

  # Protected routes (require authentication)
  scope "/api", ClippsterServerWeb do
    pipe_through :api_auth

    # Get current user info (refreshes user data from server)
    get "/auth/me", AuthController, :me

    # Credit balance (requires auth)
    get "/credits/balance", PaymentController, :get_balance
    get "/credits/transactions", PaymentController, :get_transactions

    # Subscription management (requires auth)
    get "/subscription/status", SubscriptionController, :get_status
    post "/subscription/checkout", SubscriptionController, :create_checkout
    post "/subscription/crypto-quote", SubscriptionController, :get_crypto_quote
    post "/subscription/crypto-confirm", SubscriptionController, :confirm_crypto_payment
    post "/subscription/cancel", SubscriptionController, :cancel
    get "/subscription/history", SubscriptionController, :history

    # Beta code activation (requires auth)
    post "/beta/activate", BetaController, :activate

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

    # Organization creator profiles
    get "/organizations/:organization_id/creator-profiles", OrganizationCreatorProfileController, :index
    get "/organizations/:organization_id/creator-profiles/:id", OrganizationCreatorProfileController, :show
    post "/organizations/:organization_id/creator-profiles", OrganizationCreatorProfileController, :create
    put "/organizations/:organization_id/creator-profiles/:id", OrganizationCreatorProfileController, :update
    delete "/organizations/:organization_id/creator-profiles/:id", OrganizationCreatorProfileController, :delete
    post "/organizations/:organization_id/creator-profiles/:id/image", OrganizationCreatorProfileController, :upload_image

    # Creator profile platform links
    post "/organizations/:organization_id/creator-profiles/:profile_id/platform-links", OrganizationCreatorProfileController, :add_platform_link
    put "/organizations/:organization_id/creator-profiles/:profile_id/platform-links/:link_id", OrganizationCreatorProfileController, :update_platform_link
    delete "/organizations/:organization_id/creator-profiles/:profile_id/platform-links/:link_id", OrganizationCreatorProfileController, :delete_platform_link

    # Creator profile assignments
    get "/organizations/:organization_id/creator-profiles/:profile_id/assignments", OrganizationCreatorProfileController, :list_assignments
    post "/organizations/:organization_id/creator-profiles/:profile_id/assignments", OrganizationCreatorProfileController, :create_assignments
    delete "/organizations/:organization_id/creator-profiles/:profile_id/assignments/:user_id", OrganizationCreatorProfileController, :delete_assignment

    # User's assigned creator profiles
    get "/user/assigned-creator-profiles", OrganizationCreatorProfileController, :user_assigned_profiles

    # Instagram OAuth - exchange code for tokens (admin only)
    post "/auth/instagram/exchange", InstagramAuthController, :exchange_code

    # Organization social accounts
    get "/organizations/:organization_id/social-accounts", SocialAccountController, :index
    get "/organizations/:organization_id/social-accounts/:id", SocialAccountController, :show
    post "/organizations/:organization_id/social-accounts", SocialAccountController, :create
    put "/organizations/:organization_id/social-accounts/:id", SocialAccountController, :update
    delete "/organizations/:organization_id/social-accounts/:id", SocialAccountController, :delete
    post "/organizations/:organization_id/social-accounts/:id/refresh", SocialAccountController, :refresh_token

    # Social account assignments
    get "/organizations/:organization_id/social-accounts/:id/assignments", SocialAccountController, :list_assignments
    post "/organizations/:organization_id/social-accounts/:id/assignments", SocialAccountController, :assign
    delete "/organizations/:organization_id/social-accounts/:id/assignments/:user_id", SocialAccountController, :unassign

    # User's assigned social accounts in an organization
    get "/organizations/:organization_id/my-social-accounts", SocialAccountController, :my_accounts

    # Post submissions
    get "/organizations/:organization_id/posts", PostSubmissionController, :index
    get "/organizations/:organization_id/posts/analytics", PostSubmissionController, :analytics_summary
    get "/organizations/:organization_id/posts/:id", PostSubmissionController, :show
    post "/organizations/:organization_id/posts/publish", PostSubmissionController, :publish
    put "/organizations/:organization_id/posts/:id", PostSubmissionController, :update
    post "/organizations/:organization_id/posts/:id/sync", PostSubmissionController, :sync_analytics
    post "/organizations/:organization_id/posts/:id/reset-override", PostSubmissionController, :reset_override
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

    # Admin settings management
    get "/admin/settings", AdminController, :get_settings
    put "/admin/settings/:key", AdminController, :update_setting

    # Admin beta codes management
    post "/admin/beta-codes/generate", AdminController, :generate_beta_codes
    get "/admin/beta-codes", AdminController, :list_beta_codes
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
