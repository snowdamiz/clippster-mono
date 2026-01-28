# External Integrations

**Analysis Date:** 2026-01-27

## APIs & External Services

**Blockchain/Cryptocurrency:**
- Solana - Web3 blockchain network
  - SDK: `@solana/web3.js` (client) + custom Node.js bindings (server)
  - Auth: `SOLANA_RPC_URL` environment variable
  - Purpose: Blockchain transactions, wallet integration
  - Server packages: `@120356aa/pulsekit-sdk`, `@metaplex-foundation/umi`, `@metaplex-foundation/umi-bundle-defaults`

- Alchemy - Blockchain API platform
  - SDK: Custom integration via `req` HTTP client
  - Auth: `ALCHEMY_API_KEY`, `ALCHEMY_ENDPOINT` environment variables
  - Purpose: Enhanced blockchain data and transaction management

**Video Streaming & Communication:**
- LiveKit - Real-time video/audio platform
  - SDK: `livekit-client` 2.9.1 (client)
  - Configuration: Environment variable based
  - Purpose: Live streaming and video conferencing capabilities
  - Location: `client/src` components

**AI & Language Models:**
- OpenRouter - LLM aggregation platform
  - SDK: Custom integration via Elixir `req` HTTP client
  - Auth: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` environment variables
  - Implementation: `server/lib/clippster_server/ai/openrouter_api.ex`
  - Purpose: AI-powered clip generation and content analysis

- Whisper API - Speech-to-text service
  - SDK: Custom integration via Elixir `req` HTTP client
  - Auth: `WHIPSER_API_KEY` environment variable
  - Implementation: `server/lib/clippster_server/ai/whisper_api.ex`
  - Purpose: Audio transcription for videos

- Google Vision API - Image and video analysis
  - SDK: Custom integration via Elixir HTTP client
  - Auth: `GOOGLE_VISION_API_KEY` environment variable
  - Implementation: `server/lib/clippster_server/ai/vision_api.ex`
  - Purpose: Visual content analysis for clip generation

- Replicate - AI model inference platform
  - SDK: Custom integration
  - Auth: `REPLICATE_API_TOKEN` environment variable
  - Purpose: Additional AI model access

**Payment Processing:**
- Stripe - Payment platform
  - SDK: `stripity_stripe` 3.2 (Elixir)
  - Auth: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` environment variables
  - Implementation: `server/lib/clippster_server_web/controllers/stripe_controller.ex`
  - Webhook handler: `server/lib/clippster_server_web/plugs/stripe_webhook_plug.ex`
  - Configuration: `server/config/runtime.exs` (lines 35-48)
  - Purpose: Subscription billing and payment processing
  - Endpoints: POST `/api/subscriptions/checkout`, POST `/api/stripe/webhook`

**Email & Communication:**
- Resend - Email delivery service
  - SDK: `resend` 0.4 (Elixir via Swoosh adapter)
  - Auth: `RESEND_API_KEY` environment variable
  - Implementation: `server/config/runtime.exs` (lines 50-57)
  - Configuration: Swoosh adapter integration
  - Purpose: Transactional email delivery

**Social Media Platforms:**
- Instagram - Social network
  - SDK: Custom integration via graph API
  - Auth: `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `INSTAGRAM_REDIRECT_URI` environment variables
  - Implementation: `server/lib/clippster_server/social/platforms/instagram.ex`
  - Controller: `server/lib/clippster_server_web/controllers/user_instagram_auth_controller.ex`
  - Configuration: `server/config/runtime.exs` (lines 78-91)
  - Purpose: Content publishing, account authentication
  - Callback: `POST /api/auth/instagram/callback`

- Twitter/X - Social network (read-only analytics)
  - SDK: twitterapi.io (custom integration)
  - Auth: `TWITTER_API_IO_KEY` environment variable
  - Implementation: `server/lib/clippster_server/social/platforms/twitter.ex`
  - Purpose: Tweet analytics and read-only access
  - Configuration: `server/config/runtime.exs` (lines 97-99)

**Error Tracking & Monitoring:**
- PulseKit - Error tracking and event monitoring
  - SDK: `pulsekit` 1.0 (Elixir)
  - Auth: `PULSEKIT_CLIPPSTER_SERVER_KEY` environment variable
  - Endpoint: `PULSEKIT_ENDPOINT` (default: https://pulsekit.fly.dev)
  - Configuration: `server/config/runtime.exs` (lines 101-110)
  - Purpose: Application monitoring and error tracking

## Data Storage

**Databases:**
- PostgreSQL - Primary relational database
  - Connection: `DATABASE_URL` environment variable (Ecto connection string)
  - ORM: Ecto 3.13
  - Client: `postgrex` adapter
  - Deployment: Fly.io PostgreSQL cluster
  - Configuration: `server/config/runtime.exs` (production config at lines 163-189)
  - Migration location: `server/priv/repo/migrations/`

- SQLite (Local) - Desktop app local storage
  - Client SDK: `@tauri-apps/plugin-sql` ~2
  - Purpose: Local data caching in desktop application

**File Storage:**
- Cloudflare R2 - S3-compatible object storage
  - Service: Cloudflare Workers R2
  - SDK: `ex_aws` 2.5, `ex_aws_s3` 2.5, `hackney` 1.20 (Elixir)
  - Auth: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` environment variables
  - Bucket: `R2_BUCKET_NAME` environment variable (default: "clippster-org-assets")
  - Public URL: `R2_PUBLIC_URL` environment variable
  - TLS Config: Custom Hackney SSL options in `server/config/runtime.exs` (lines 122-148)
  - Implementation: `server/lib/clippster_server/storage.ex`
  - Purpose: Persistent storage for organization assets and media

**Caching:**
- Cachex - In-memory cache
  - Library: `cachex` 3.6
  - Usage: Session/token caching, rate limiting
  - Configuration: Application-level caching

## Authentication & Identity

**OAuth Providers:**
- Google OAuth - Account authentication
  - Strategy: Ueberauth + `ueberauth_google` 0.10
  - Auth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` environment variables
  - Configuration: `server/config/config.exs` (lines 43-46) and `server/config/runtime.exs` (lines 25-33)
  - Purpose: User authentication via Google account

**Custom Authentication:**
- JWT Tokens - Wallet-based authentication
  - Library: `joken` 2.6
  - Signing: `ed25519` 1.4 (Solana wallet signature verification)
  - Secret: `JWT_SECRET` environment variable
  - Encoding: `base58` 0.1.0
  - Configuration: `server/config/runtime.exs` (lines 59-70)
  - Purpose: Wallet address-based authentication without password

- Email Authentication - Password-based auth
  - Hashing: `pbkdf2_elixir` 2.0 (pure Elixir, no native dependencies)
  - Configuration: `server/config/runtime.exs` (lines 72-76)
  - Purpose: Traditional email/password authentication

**Token Encryption:**
- Social Token Encryption - Secure credential storage
  - Encryption Key: `SOCIAL_TOKEN_ENCRYPTION_KEY` environment variable (base64-encoded 32-byte key)
  - Purpose: Encrypt OAuth tokens for Instagram/Twitter account integration

## CI/CD & Deployment

**Hosting:**
- Fly.io - Primary deployment platform
  - Deployment tokens: `FLY_SERVER_TOKEN`, `FLY_LANDING_TOKEN`
  - Environment: Production (DNS cluster, load balancing)
  - Database: Fly PostgreSQL
  - Configuration: `server/config/runtime.exs` production config

**Build & Development:**
- GitHub Actions - CI/CD pipeline (configured but details in `.github/`)
- Husky - Git hooks for pre-commit checks
- Lint-staged - Pre-commit linting

## Environment Configuration

**Required Environment Variables:**

*Critical for Production:*
- `JWT_SECRET` - JWT signing key (must be generated via `mix phx.gen.secret`)
- `DATABASE_URL` - PostgreSQL connection string (format: `ecto://USER:PASS@HOST/DATABASE`)
- `SECRET_KEY_BASE` - Phoenix secret key (generated via `mix phx.gen.secret`)

*API & Services:*
- `STRIPE_SECRET_KEY` - Stripe API secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signature secret
- `RESEND_API_KEY` - Resend email API key
- `OPENROUTER_API_KEY` - OpenRouter LLM API key
- `OPENROUTER_MODEL` - OpenRouter model to use
- `WHIPSER_API_KEY` - Whisper speech-to-text API key
- `GOOGLE_VISION_API_KEY` - Google Vision API key
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `INSTAGRAM_APP_ID` - Instagram app ID
- `INSTAGRAM_APP_SECRET` - Instagram app secret
- `INSTAGRAM_REDIRECT_URI` - Instagram OAuth redirect URL

*Blockchain:*
- `SOLANA_RPC_URL` - Solana RPC endpoint URL
- `ALCHEMY_API_KEY` - Alchemy blockchain API key
- `ALCHEMY_ENDPOINT` - Alchemy endpoint URL
- `PAYMENT_ADDRESS` - SOL payment address

*Storage:*
- `R2_ACCOUNT_ID` - Cloudflare R2 account ID
- `R2_ACCESS_KEY_ID` - R2 access key
- `R2_SECRET_ACCESS_KEY` - R2 secret access key
- `R2_BUCKET_NAME` - R2 bucket name
- `R2_PUBLIC_URL` - R2 public URL base

*Monitoring:*
- `PULSEKIT_CLIPPSTER_SERVER_KEY` - PulseKit API key
- `PULSEKIT_ENDPOINT` - PulseKit endpoint (default: https://pulsekit.fly.dev)

*Client:*
- `VITE_API_URL` - API server URL (development: `http://localhost:4000`, production: `https://clippster-server.fly.dev`)

**Secrets Location:**
- Local development: `.env` file (not committed, use `.env.example` as template)
- Server `.env`: `server/.env` (Git-ignored)
- Server `.env.example`: `server/.env.example` (committed, documents required vars)
- Client `.env`: `client/.env` (Git-ignored)
- Client `.env.example`: `client/.env.example` (committed template)
- Production: Fly.io secrets management (`fly secrets set KEY=VALUE`)

## Webhooks & Callbacks

**Incoming Webhooks:**
- Stripe Webhook - Payment events
  - Endpoint: `POST /api/stripe/webhook`
  - Handler: `server/lib/clippster_server_web/controllers/stripe_controller.ex`
  - Events: `checkout.session.completed`, `invoice.payment_succeeded`, subscription updates
  - Verification: HMAC signature validation via `STRIPE_WEBHOOK_SECRET`
  - Middleware: `server/lib/clippster_server_web/plugs/stripe_webhook_plug.ex`

- Instagram OAuth Callback
  - Endpoint: `POST /api/auth/instagram/callback`
  - Handler: `server/lib/clippster_server_web/controllers/user_instagram_auth_controller.ex`
  - Purpose: OAuth token exchange for Instagram Business account access

**Outgoing Webhooks/Events:**
- PulseKit - Event tracking
  - Sends: Application errors, user events, performance metrics
  - Endpoint: Configured via `PULSEKIT_ENDPOINT`

- Email Notifications via Resend
  - User verification emails
  - Subscription confirmations
  - Password resets
  - Invitation emails (organization)

---

*Integration audit: 2026-01-27*
