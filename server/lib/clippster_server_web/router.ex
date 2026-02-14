defmodule ClippsterServerWeb.Router do
  use ClippsterServerWeb, :router

  pipeline :api do
    plug(:accepts, ["json"])

    plug(CORSPlug,
      origin: &__MODULE__.cors_origins/0,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      headers: ["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
      max_age: 86400,
      credentials: true
    )
  end

  pipeline :api_auth do
    plug(:accepts, ["json"])

    plug(CORSPlug,
      origin: &__MODULE__.cors_origins/0,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      headers: ["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
      max_age: 86400,
      credentials: true
    )

    plug(ClippsterServerWeb.AuthPlug)
  end

  pipeline :api_admin do
    plug(:accepts, ["json"])

    plug(CORSPlug,
      origin: &__MODULE__.cors_origins/0,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
      headers: ["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
      max_age: 86400,
      credentials: true
    )

    plug(ClippsterServerWeb.AuthPlug)
    plug(ClippsterServerWeb.AdminPlug)
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
    pipe_through(:api)

    # Health check endpoints for Fly.io and load balancers
    get("/health", HealthController, :check)
    get("/health/deep", HealthController, :deep_check)

    # Handle OPTIONS requests for CORS preflight
    options("/*path", AuthController, :options)

    # Wallet authentication routes
    post("/auth/challenge", AuthController, :request_challenge)
    post("/auth/verify", AuthController, :verify_signature)

    # Google OAuth routes
    get("/auth/google", AuthController, :google_request)
    get("/auth/google/callback", AuthController, :google_callback)

    # Instagram OAuth routes (for Tauri desktop app)
    get("/auth/instagram/start", InstagramAuthController, :start_oauth)
    get("/auth/instagram/callback", InstagramAuthController, :oauth_callback)

    # User Instagram OAuth routes (for individual users/clippers)
    get("/auth/user-instagram/start", UserInstagramAuthController, :start_oauth)
    get("/auth/user-instagram/callback", UserInstagramAuthController, :oauth_callback)
    # The client obtains tokens via FB.login() and sends them to POST /social-accounts

    # X (Twitter) OAuth routes (for Tauri desktop app)
    get("/auth/twitter/start", TwitterAuthController, :start_oauth)
    get("/auth/twitter/callback", TwitterAuthController, :oauth_callback)

    # User X (Twitter) OAuth routes (for individual users/clippers)
    get("/auth/user-twitter/start", UserTwitterAuthController, :start_oauth)
    get("/auth/user-twitter/callback", UserTwitterAuthController, :oauth_callback)

    # Email authentication routes
    post("/auth/email/register", EmailAuthController, :register)
    post("/auth/email/verify-otp", EmailAuthController, :verify_otp)
    get("/auth/email/verify/:token", EmailAuthController, :verify_token)
    post("/auth/email/login", EmailAuthController, :login)
    post("/auth/email/resend-verification", EmailAuthController, :resend_verification)
    post("/auth/email/forgot-password", EmailAuthController, :forgot_password)
    post("/auth/email/reset-password", EmailAuthController, :reset_password)

    # Payment routes (public - pricing info)
    get("/pricing", PaymentController, :get_pricing)
    post("/payments/quote", PaymentController, :get_quote)
    post("/payments/confirm", PaymentController, :confirm_payment)

    # Stripe payment routes (webhook is public, no auth needed)
    post("/stripe/webhook", StripeController, :webhook)

    # Subscription tiers (public - for pricing display)
    get("/subscription/tiers", SubscriptionController, :get_tiers)

    # Metadata routes
    get("/metadata/:mint_id", MetadataController, :fetch)

    # Kick routes
    get("/kick/channels/:channel_slug", KickController, :get_channel)
    get("/kick/channels/:channel_slug/videos", KickController, :get_clips)

    # Organization invitation (public - for viewing invitation details)
    get("/invitations/:token", OrganizationController, :get_invitation)

    # Public settings/feature flags
    get("/settings/feature-flags", SettingsController, :get_feature_flags)
    get("/app-settings/free-tier-branding", SettingsController, :get_free_tier_branding)

    # App release info (for download buttons on landing page)
    get("/releases/latest", ReleaseController, :latest)

    # Waitlist signup (public)
    post("/waitlist", WaitlistController, :create)
  end

  # Protected routes (require authentication)
  scope "/api", ClippsterServerWeb do
    pipe_through(:api_auth)

    # Get current user info (refreshes user data from server)
    get("/auth/me", AuthController, :me)

    # User restrictions
    get("/user/restrictions", RestrictionController, :get_user_restrictions)

    # Credit balance (requires auth)
    get("/credits/balance", PaymentController, :get_balance)
    get("/credits/transactions", PaymentController, :get_transactions)

    # Subscription management (requires auth)
    get("/subscription/status", SubscriptionController, :get_status)
    post("/subscription/checkout", SubscriptionController, :create_checkout)
    post("/subscription/promo/validate", SubscriptionController, :validate_promo)
    post("/subscription/crypto-quote", SubscriptionController, :get_crypto_quote)
    post("/subscription/crypto-confirm", SubscriptionController, :confirm_crypto_payment)
    put("/subscription/tier", SubscriptionController, :change_tier)
    post("/subscription/pending-change/cancel", SubscriptionController, :cancel_pending_change)
    post("/subscription/cancel", SubscriptionController, :cancel)
    post("/subscription/deactivate", SubscriptionController, :deactivate_profile)
    get("/subscription/history", SubscriptionController, :history)

    # Beta code activation (requires auth)
    post("/beta/activate", BetaController, :activate)

    post("/clips/detect", ClipsController, :detect)
    post("/clips/detect-chunked", ClipsController, :detect_chunked)
    post("/clips/transcribe", ClipsController, :transcribe)

    # AI video generation routes
    post("/ai/generate-video", AIController, :generate_video)
    post("/ai/generate-video-streamed", AIController, :generate_video_streamed)
    post("/ai/compositions", AIController, :save_composition)
    get("/ai/compositions", AIController, :list_compositions)
    get("/ai/compositions/:id", AIController, :get_composition)
    delete("/ai/compositions/:id", AIController, :delete_composition)

    # AI reference analysis
    post("/ai/reference/analyze", AIChatController, :analyze_reference)

    # AI chat sessions (conversational video generation)
    post("/ai/chat/sessions", AIChatController, :create_session)
    get("/ai/chat/sessions/:id", AIChatController, :get_session)
    post("/ai/chat/sessions/:id/message", AIChatController, :send_message)
    post("/ai/chat/sessions/:id/generate", AIChatController, :trigger_generation)
    post("/ai/chat/sessions/:id/refine", AIChatController, :send_refinement)
    post("/ai/chat/sessions/:id/reference", AIChatController, :upload_reference)
    post("/ai/chat/sessions/:id/media-analysis", AIChatController, :upload_media_analysis)
    put("/ai/chat/sessions/:id/media", AIChatController, :update_media)

    # Speaker detection and framing strategy
    post("/clips/:clip_id/analyze-speakers", SpeakerDetectionController, :analyze)
    post("/clips/:clip_id/classify-video", SpeakerDetectionController, :classify)

    # Processing job management (for cancellation/refunds)
    get("/jobs/:job_id", ProcessingJobController, :show)
    post("/jobs/:job_id/cancel", ProcessingJobController, :cancel)
    post("/jobs/cancel-by-project", ProcessingJobController, :cancel_by_project)

    # Stripe checkout session creation (requires auth)
    post("/payments/stripe/create-session", StripeController, :create_checkout_session)

    # Bug report creation (requires authentication)
    post("/bug-reports", BugReportsController, :create)

    # Organization application management (requires authentication)
    post("/organization-applications", OrganizationApplicationController, :create)

    get(
      "/organization-applications/my-application",
      OrganizationApplicationController,
      :my_application
    )

    put("/organization-applications/:id", OrganizationApplicationController, :update)
    delete("/organization-applications/:id", OrganizationApplicationController, :delete_own)
    post("/organization-applications/:id/logo", OrganizationApplicationController, :upload_logo)

    # OAuth account linking routes
    post("/auth/link/google", AuthController, :link_google_account)

    # Account type selection (for new users)
    post("/account/type", OrganizationController, :set_account_type)

    # Organization management
    resources("/organizations", OrganizationController,
      only: [:index, :create, :show, :update, :delete]
    )

    post("/organizations/:id/logo", OrganizationController, :upload_logo)

    # Organization members
    get("/organizations/:organization_id/members", OrganizationController, :list_members)

    put(
      "/organizations/:organization_id/members/:user_id",
      OrganizationController,
      :update_member
    )

    patch(
      "/organizations/:organization_id/members/:user_id/account",
      OrganizationController,
      :update_member_account
    )

    delete(
      "/organizations/:organization_id/members/:user_id",
      OrganizationController,
      :remove_member
    )

    # Organization invitations
    get("/organizations/:organization_id/invitations", OrganizationController, :list_invitations)

    post(
      "/organizations/:organization_id/invitations",
      OrganizationController,
      :create_invitation
    )

    post(
      "/organizations/:organization_id/invitations/:id/resend",
      OrganizationController,
      :resend_invitation
    )

    delete(
      "/organizations/:organization_id/invitations/:id",
      OrganizationController,
      :cancel_invitation
    )

    post("/invitations/:token/accept", OrganizationController, :accept_invitation)

    # Create member account directly (admin creates account for user)
    post(
      "/organizations/:organization_id/create-member",
      OrganizationController,
      :create_member_account
    )

    # Organization credits
    get("/organizations/:organization_id/credits", OrganizationController, :get_credits)

    post(
      "/organizations/:organization_id/credits/allocate",
      OrganizationController,
      :allocate_credits
    )

    get("/organizations/:organization_id/transactions", OrganizationController, :get_transactions)

    # Organization restriction settings
    get(
      "/organizations/:id/restriction-settings",
      RestrictionController,
      :get_restriction_settings
    )

    put(
      "/organizations/:id/restriction-settings",
      RestrictionController,
      :update_restriction_settings
    )

    # Member restriction overrides
    get(
      "/organizations/:id/members/:user_id/restrictions",
      RestrictionController,
      :get_member_restrictions
    )

    put(
      "/organizations/:id/members/:user_id/restrictions",
      RestrictionController,
      :update_member_restrictions
    )

    # Organization payments (Stripe)
    post(
      "/organizations/:organization_id/payments/stripe/create-session",
      StripeController,
      :create_org_checkout_session
    )

    # Organization payments (Crypto/SOL)
    post("/organizations/:organization_id/payments/quote", PaymentController, :get_org_quote)

    post(
      "/organizations/:organization_id/payments/confirm",
      PaymentController,
      :confirm_org_payment
    )

    # Organization subscriptions
    get("/organizations/:id/subscription", OrganizationSubscriptionController, :show)
    get("/organizations/:id/subscription/tiers", OrganizationSubscriptionController, :tiers)
    post("/organizations/:id/subscription/promo/validate", OrganizationSubscriptionController, :validate_promo)
    post("/organizations/:id/subscription/checkout", OrganizationSubscriptionController, :checkout)
    post("/organizations/:id/subscription/addons/checkout", OrganizationSubscriptionController, :addon_checkout)
    post("/organizations/:id/subscription/cancel", OrganizationSubscriptionController, :cancel)
    post("/organizations/:id/subscription/crypto-quote", OrganizationSubscriptionController, :crypto_quote)
    post("/organizations/:id/subscription/crypto-confirm", OrganizationSubscriptionController, :crypto_confirm)

    # Organization assets
    get("/organizations/:organization_id/assets", OrganizationAssetController, :index)
    get("/organizations/:organization_id/assets/:id", OrganizationAssetController, :show)
    post("/organizations/:organization_id/assets", OrganizationAssetController, :create)
    put("/organizations/:organization_id/assets/:id", OrganizationAssetController, :update)
    delete("/organizations/:organization_id/assets/:id", OrganizationAssetController, :delete)

    # User's organization assets (for sync)
    get("/user/organization-assets", OrganizationAssetController, :user_assets)

    # Organization shared clips (admin endpoints)
    get("/organizations/:organization_id/shared-clips", SharedClipController, :index)
    get("/organizations/:organization_id/shared-clips/:id", SharedClipController, :show)
    post("/organizations/:organization_id/shared-clips", SharedClipController, :create)

    put(
      "/organizations/:organization_id/shared-clips/:id/branding",
      SharedClipController,
      :update_branding
    )

    delete("/organizations/:organization_id/shared-clips/:id", SharedClipController, :delete)
    get("/organizations/:organization_id/shared-clips/:id/stats", SharedClipController, :stats)

    # User's shared clips (member endpoints)
    get("/user/shared-clips", SharedClipController, :user_clips)
    post("/shared-clips/:id/mark-viewed", SharedClipController, :mark_viewed)
    post("/shared-clips/:id/mark-downloaded", SharedClipController, :mark_downloaded)
    post("/shared-clips/:id/post", SharedClipController, :mark_posted)

    # Organization creator profiles
    get(
      "/organizations/:organization_id/creator-profiles",
      OrganizationCreatorProfileController,
      :index
    )

    get(
      "/organizations/:organization_id/creator-profiles/:id",
      OrganizationCreatorProfileController,
      :show
    )

    post(
      "/organizations/:organization_id/creator-profiles",
      OrganizationCreatorProfileController,
      :create
    )

    put(
      "/organizations/:organization_id/creator-profiles/:id",
      OrganizationCreatorProfileController,
      :update
    )

    delete(
      "/organizations/:organization_id/creator-profiles/:id",
      OrganizationCreatorProfileController,
      :delete
    )

    post(
      "/organizations/:organization_id/creator-profiles/:id/image",
      OrganizationCreatorProfileController,
      :upload_image
    )

    # Creator profile platform links
    post(
      "/organizations/:organization_id/creator-profiles/:profile_id/platform-links",
      OrganizationCreatorProfileController,
      :add_platform_link
    )

    put(
      "/organizations/:organization_id/creator-profiles/:profile_id/platform-links/:link_id",
      OrganizationCreatorProfileController,
      :update_platform_link
    )

    delete(
      "/organizations/:organization_id/creator-profiles/:profile_id/platform-links/:link_id",
      OrganizationCreatorProfileController,
      :delete_platform_link
    )

    # Creator profile assignments
    get(
      "/organizations/:organization_id/creator-profiles/:profile_id/assignments",
      OrganizationCreatorProfileController,
      :list_assignments
    )

    post(
      "/organizations/:organization_id/creator-profiles/:profile_id/assignments",
      OrganizationCreatorProfileController,
      :create_assignments
    )

    delete(
      "/organizations/:organization_id/creator-profiles/:profile_id/assignments/:user_id",
      OrganizationCreatorProfileController,
      :delete_assignment
    )

    # User's assigned creator profiles
    get(
      "/user/assigned-creator-profiles",
      OrganizationCreatorProfileController,
      :user_assigned_profiles
    )

    # Instagram OAuth - exchange code for tokens (admin only)
    post("/auth/instagram/exchange", InstagramAuthController, :exchange_code)

    # Organization social accounts
    get("/organizations/:organization_id/social-accounts", SocialAccountController, :index)
    get("/organizations/:organization_id/social-accounts/:id", SocialAccountController, :show)
    post("/organizations/:organization_id/social-accounts", SocialAccountController, :create)
    put("/organizations/:organization_id/social-accounts/:id", SocialAccountController, :update)

    delete(
      "/organizations/:organization_id/social-accounts/:id",
      SocialAccountController,
      :delete
    )

    post(
      "/organizations/:organization_id/social-accounts/:id/refresh",
      SocialAccountController,
      :refresh_token
    )

    # Social account assignments
    get(
      "/organizations/:organization_id/social-accounts/:id/assignments",
      SocialAccountController,
      :list_assignments
    )

    post(
      "/organizations/:organization_id/social-accounts/:id/assignments",
      SocialAccountController,
      :assign
    )

    delete(
      "/organizations/:organization_id/social-accounts/:id/assignments/:user_id",
      SocialAccountController,
      :unassign
    )

    # User's assigned social accounts in an organization
    get(
      "/organizations/:organization_id/my-social-accounts",
      SocialAccountController,
      :my_accounts
    )

    # Post submissions
    get("/organizations/:organization_id/posts", PostSubmissionController, :index)

    get(
      "/organizations/:organization_id/posts/analytics",
      PostSubmissionController,
      :analytics_summary
    )

    get("/organizations/:organization_id/posts/:id", PostSubmissionController, :show)

    post(
      "/organizations/:organization_id/posts/upload-media",
      PostSubmissionController,
      :upload_media
    )

    post("/organizations/:organization_id/posts/publish", PostSubmissionController, :publish)
    put("/organizations/:organization_id/posts/:id", PostSubmissionController, :update)

    post(
      "/organizations/:organization_id/posts/:id/sync",
      PostSubmissionController,
      :sync_analytics
    )

    post(
      "/organizations/:organization_id/posts/:id/reset-override",
      PostSubmissionController,
      :reset_override
    )

    # Organization messaging
    get(
      "/organizations/:organization_id/messaging/conversations",
      MessagingController,
      :list_conversations
    )

    post(
      "/organizations/:organization_id/messaging/conversations/direct",
      MessagingController,
      :create_direct
    )

    post(
      "/organizations/:organization_id/messaging/conversations/group",
      MessagingController,
      :create_group
    )

    post(
      "/organizations/:organization_id/messaging/conversations/announcement",
      MessagingController,
      :create_announcement
    )

    get(
      "/organizations/:organization_id/messaging/unread",
      MessagingController,
      :get_unread_counts
    )

    # Conversation-specific endpoints
    get("/conversations/:id", MessagingController, :get_conversation)
    get("/conversations/:id/messages", MessagingController, :get_messages)
    post("/conversations/:id/messages", MessagingController, :send_message)
    put("/conversations/:id/messages/:message_id", MessagingController, :edit_message)
    delete("/conversations/:id/messages/:message_id", MessagingController, :delete_message)
    post("/conversations/:id/read", MessagingController, :mark_read)
    put("/conversations/:id/mute", MessagingController, :toggle_mute)
    post("/conversations/:id/participants", MessagingController, :add_participant)
    delete("/conversations/:id/participants/:user_id", MessagingController, :remove_participant)
    post("/conversations/:id/leave", MessagingController, :leave_conversation)
    delete("/conversations/:id", MessagingController, :delete_conversation)

    # User-level messaging endpoints
    get("/me/conversations", MessagingController, :list_all_conversations)
    get("/me/unread-count", MessagingController, :get_total_unread)
    post("/messaging/conversations/global-direct", MessagingController, :create_global_direct)
    # Analytics tracking (requires authentication)
    post("/analytics/track", AnalyticsController, :track)

    # ============================================================================
    # Campaigns - Public/Clipper Routes
    # ============================================================================

    # Campaign marketplace (browse active campaigns)
    get("/campaigns", CampaignController, :index)
    get("/campaigns/:id", CampaignController, :show)
    post("/campaigns/:id/apply", CampaignController, :apply)
    post("/campaigns/:id/submissions", CampaignController, :submit_clip)

    # User's campaigns and submissions
    get("/user/campaigns", CampaignController, :my_campaigns)

    get(
      "/user/campaigns/by-creator/:creator_profile_id",
      CampaignController,
      :campaigns_by_creator_profile
    )

    get("/user/submissions", CampaignController, :my_submissions)
    get("/user/earnings", CampaignController, :my_earnings)

    # Clipper social accounts (for campaigns)
    get("/user/social-accounts", ClipperProfileController, :list_social_accounts)
    post("/user/social-accounts", ClipperProfileController, :create_social_account)
    put("/user/social-accounts/:id", ClipperProfileController, :update_social_account)
    delete("/user/social-accounts/:id", ClipperProfileController, :delete_social_account)

    # Clipper payment methods (for campaigns)
    get("/user/payment-methods", ClipperProfileController, :list_payment_methods)
    post("/user/payment-methods", ClipperProfileController, :create_payment_method)
    put("/user/payment-methods/:id", ClipperProfileController, :update_payment_method)
    delete("/user/payment-methods/:id", ClipperProfileController, :delete_payment_method)

    # User social media posts (personal posting, not campaigns)
    post("/user/posts/upload-media", UserPostsController, :upload_media)
    post("/user/instagram/publish", UserPostsController, :publish)
    post("/user/twitter/publish", UserPostsController, :publish_twitter)
    get("/user/posts", UserPostsController, :index)
    get("/user/posts/analytics", UserPostsController, :analytics_summary)
    get("/user/posts/:id", UserPostsController, :show)
    post("/user/posts/:id/sync", UserPostsController, :sync_analytics)

    # ============================================================================
    # Social Media Scheduling
    # ============================================================================

    # Schedule a post for future publishing
    post("/social/schedule", SchedulingController, :schedule)

    # List user's scheduled posts
    get("/social/scheduled", SchedulingController, :index)

    # Get/update/cancel/retry a scheduled post
    get("/social/scheduled/:id", SchedulingController, :show)
    put("/social/scheduled/:id", SchedulingController, :update)
    post("/social/scheduled/:id/cancel", SchedulingController, :cancel)
    post("/social/scheduled/:id/retry", SchedulingController, :retry)

    # Organization scheduled posts (admin view)
    get(
      "/organizations/:organization_id/scheduled-posts",
      SchedulingController,
      :org_scheduled_posts
    )

    # External post submissions (link submissions)
    post(
      "/organizations/:organization_id/external-posts",
      SchedulingController,
      :submit_external_post
    )

    get(
      "/organizations/:organization_id/external-posts",
      SchedulingController,
      :list_external_posts
    )

    post(
      "/organizations/:organization_id/external-posts/:id/approve",
      SchedulingController,
      :approve_external_post
    )

    post(
      "/organizations/:organization_id/external-posts/:id/reject",
      SchedulingController,
      :reject_external_post
    )

    # Analytics sync (on-demand)
    post(
      "/organizations/:organization_id/sync-analytics",
      SchedulingController,
      :sync_org_analytics
    )

    # ============================================================================
    # Clipper Profiles - User's Own Profile
    # ============================================================================
    get("/user/clipper-profile", ClipperProfilesController, :show_own)
    put("/user/clipper-profile", ClipperProfilesController, :update_own)
    post("/user/clipper-profile/avatar", ClipperProfilesController, :upload_avatar)

    # Channel links
    get("/user/clipper-profile/channel-links", ClipperProfilesController, :list_channel_links)
    post("/user/clipper-profile/channel-links", ClipperProfilesController, :create_channel_link)

    put(
      "/user/clipper-profile/channel-links/:id",
      ClipperProfilesController,
      :update_channel_link
    )

    delete(
      "/user/clipper-profile/channel-links/:id",
      ClipperProfilesController,
      :delete_channel_link
    )

    # Portfolio clips
    get("/user/clipper-profile/portfolio-clips", ClipperProfilesController, :list_portfolio_clips)

    post(
      "/user/clipper-profile/portfolio-clips",
      ClipperProfilesController,
      :create_portfolio_clip
    )

    post(
      "/user/clipper-profile/portfolio-clips/upload",
      ClipperProfilesController,
      :upload_portfolio_clip
    )

    put(
      "/user/clipper-profile/portfolio-clips/:id",
      ClipperProfilesController,
      :update_portfolio_clip
    )

    delete(
      "/user/clipper-profile/portfolio-clips/:id",
      ClipperProfilesController,
      :delete_portfolio_clip
    )

    # ============================================================================
    # Clipper Directory - Public Profiles
    # ============================================================================
    get("/clippers", ClipperProfilesController, :index)
    get("/clippers/leaderboard", ClipperProfilesController, :leaderboard)
    get("/clippers/:slug", ClipperProfilesController, :show)
    post("/clippers/:slug/endorsements", ClipperProfilesController, :create_endorsement)

    # ============================================================================
    # Hiring Posts - Clipper Browsing
    # ============================================================================
    get("/hiring-posts", HiringController, :index)
    get("/hiring-posts/:id", HiringController, :show)
    post("/hiring-posts/:id/apply", HiringController, :apply)
    get("/user/hiring-applications", HiringController, :my_applications)

    # ============================================================================
    # Hiring Posts - Organization Management
    # ============================================================================
    get("/organizations/:organization_id/hiring-post", HiringController, :show_org_post)
    post("/organizations/:organization_id/hiring-post", HiringController, :save_org_post)
    delete("/organizations/:organization_id/hiring-post", HiringController, :delete_org_post)
    get("/organizations/:organization_id/hiring-post/applications", HiringController, :list_applications)

    post(
      "/organizations/:organization_id/hiring-post/applications/:app_id/accept",
      HiringController,
      :accept_application
    )

    post(
      "/organizations/:organization_id/hiring-post/applications/:app_id/reject",
      HiringController,
      :reject_application
    )

    # ============================================================================
    # Campaigns - Organization Management Routes
    # ============================================================================

    # Campaign CRUD
    get("/organizations/:organization_id/campaigns", CampaignController, :org_index)
    post("/organizations/:organization_id/campaigns", CampaignController, :create)
    put("/organizations/:organization_id/campaigns/:id", CampaignController, :update)
    delete("/organizations/:organization_id/campaigns/:id", CampaignController, :delete)
    post("/organizations/:organization_id/campaigns/:id/pause", CampaignController, :pause)
    post("/organizations/:organization_id/campaigns/:id/activate", CampaignController, :activate)
    post("/organizations/:organization_id/campaigns/:id/complete", CampaignController, :complete)

    # Campaign creator profiles
    get(
      "/organizations/:organization_id/campaigns/:id/creator-profiles",
      CampaignController,
      :list_creator_profiles
    )

    post(
      "/organizations/:organization_id/campaigns/:id/creator-profiles",
      CampaignController,
      :add_creator_profile
    )

    put(
      "/organizations/:organization_id/campaigns/:id/creator-profiles",
      CampaignController,
      :set_creator_profiles
    )

    delete(
      "/organizations/:organization_id/campaigns/:id/creator-profiles/:creator_profile_id",
      CampaignController,
      :remove_creator_profile
    )

    # Campaign participants
    get(
      "/organizations/:organization_id/campaigns/:id/participants",
      CampaignController,
      :list_participants
    )

    post(
      "/organizations/:organization_id/campaigns/:id/participants/:participant_id/approve",
      CampaignController,
      :approve_participant
    )

    post(
      "/organizations/:organization_id/campaigns/:id/participants/:participant_id/reject",
      CampaignController,
      :reject_participant
    )

    delete(
      "/organizations/:organization_id/campaigns/:id/participants/:participant_id",
      CampaignController,
      :remove_participant
    )

    # Campaign submissions (org view)
    get(
      "/organizations/:organization_id/campaign-submissions",
      CampaignController,
      :list_organization_submissions
    )

    get(
      "/organizations/:organization_id/campaigns/:id/submissions",
      CampaignController,
      :list_submissions
    )

    post(
      "/organizations/:organization_id/submissions/:submission_id/verify",
      CampaignController,
      :verify_submission
    )

    post(
      "/organizations/:organization_id/submissions/:submission_id/reject",
      CampaignController,
      :reject_submission
    )

    put(
      "/organizations/:organization_id/submissions/:submission_id/views",
      CampaignController,
      :update_views
    )

    # Campaign payments
    get(
      "/organizations/:organization_id/campaigns/:id/payments",
      CampaignController,
      :list_payments
    )

    post(
      "/organizations/:organization_id/submissions/:submission_id/pay",
      CampaignController,
      :create_payment
    )

    post(
      "/organizations/:organization_id/payments/:payment_id/complete",
      CampaignController,
      :complete_payment
    )
  end

  # Affiliate user routes (authenticated)
  scope "/api", ClippsterServerWeb do
    pipe_through(:api_auth)

    get("/affiliate/dashboard", AffiliateController, :my_dashboard)
    get("/affiliate/referrals", AffiliateController, :my_referrals)
    get("/affiliate/payouts", AffiliateController, :my_payouts)
    put("/affiliate/settings", AffiliateController, :update_settings)
  end

  # Admin-only routes
  scope "/api", ClippsterServerWeb do
    pipe_through(:api_admin)

    get("/admin/users", AdminController, :list_users)
    get("/admin/ai-usage", AdminController, :get_ai_usage_stats)
    get("/admin/analytics", AnalyticsController, :stats)
    post("/admin/users/:user_id/promote", AdminController, :promote_user)
    put("/admin/users/:user_id/credits", AdminController, :update_user_credits)

    # Admin subscription management
    post("/admin/users/:user_id/subscription", AdminController, :grant_subscription)
    put("/admin/users/:user_id/subscription/extend", AdminController, :extend_subscription)
    put("/admin/users/:user_id/subscription/tier", AdminController, :change_subscription_tier)
    post("/admin/users/:user_id/subscription/cancel", AdminController, :cancel_user_subscription)
    get("/admin/users/:user_id/subscription/history", AdminController, :get_subscription_history)

    # Admin organization management
    get("/admin/organizations", AdminController, :list_organizations)
    get("/admin/organizations/:organization_id/credits", AdminController, :get_org_credits)
    post("/admin/organizations/:organization_id/credits/add", AdminController, :add_org_credits)
    put("/admin/organizations/:organization_id/credits", AdminController, :set_org_credits)

    # Admin bug report management
    get("/admin/bug-reports", BugReportsController, :index)
    put("/admin/bug-reports/:id", BugReportsController, :update)
    delete("/admin/bug-reports/:id", BugReportsController, :delete)

    # Admin settings management
    get("/admin/settings", AdminController, :get_settings)
    put("/admin/settings/:key", AdminController, :update_setting)

    # Admin free tier branding
    get("/admin/free-tier-branding", AdminController, :get_free_tier_branding)
    put("/admin/free-tier-branding", AdminController, :save_free_tier_branding)

    # Admin beta codes management
    post("/admin/beta-codes/generate", AdminController, :generate_beta_codes)
    get("/admin/beta-codes", AdminController, :list_beta_codes)

    # Admin promo codes management
    get("/admin/promos", AdminController, :list_promos)
    get("/admin/promos/:id", AdminController, :get_promo)
    post("/admin/promos", AdminController, :create_promo)
    patch("/admin/promos/:id", AdminController, :update_promo)
    post("/admin/promos/:id/toggle", AdminController, :toggle_promo_active)

    # Admin waitlist management
    get("/admin/waitlist", WaitlistController, :index)

    # Admin affiliate management
    get("/admin/affiliates", AffiliateController, :list_affiliates)
    post("/admin/affiliates", AffiliateController, :create_affiliate)
    get("/admin/affiliates/overview", AffiliateController, :admin_overview)
    get("/admin/affiliates/payouts", AffiliateController, :pending_payouts)
    get("/admin/affiliates/:id", AffiliateController, :show_affiliate)
    put("/admin/affiliates/:id", AffiliateController, :update_affiliate)
    post("/admin/affiliates/:id/deactivate", AffiliateController, :deactivate)
    post("/admin/affiliates/:id/activate", AffiliateController, :activate)
    post("/admin/affiliates/:id/payout", AffiliateController, :record_payout)

    # Admin organization application management
    get("/admin/organization-applications", OrganizationApplicationController, :index)

    put(
      "/admin/organization-applications/:id/approve",
      OrganizationApplicationController,
      :approve
    )

    put("/admin/organization-applications/:id/reject", OrganizationApplicationController, :reject)
    delete("/admin/organization-applications/:id", OrganizationApplicationController, :delete)
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
      pipe_through([:fetch_session, :protect_from_forgery])

      live_dashboard("/dashboard", metrics: ClippsterServerWeb.Telemetry)
      forward("/mailbox", Plug.Swoosh.MailboxPreview)
    end
  end
end
