# Technology Stack

**Analysis Date:** 2026-01-27

## Languages

**Primary:**
- TypeScript 5.6.2 - Client (Vue.js frontend)
- Elixir 1.15 - Server (Phoenix backend)
- JavaScript - Landing page and monorepo scripts

**Secondary:**
- Rust - Desktop app (Tauri)

## Runtime

**Environment:**
- Node.js (Client and monorepo tooling)
- Erlang/OTP (Elixir/Phoenix server runtime)

**Package Managers:**
- Yarn - Client, landing, and monorepo (primary)
- npm - Fallback support
- Mix - Elixir/Phoenix dependency management

**Lockfiles:**
- `yarn.lock` (monorepo)
- `package-lock.json` (server Node.js dependencies)

## Frameworks

**Core Web Frameworks:**
- Vue.js 3.5.13 - Client frontend
- Phoenix 1.8.0 - Server API
- React 19.2.0 - Landing page
- Tauri 2.x - Desktop application wrapper

**UI Frameworks:**
- Tailwind CSS 4.1.16 - Utility-first styling (client and landing)
- Radix Vue 1.9.17 - Headless component library (client)
- Reka UI 2.6.0 - Additional UI components (client)
- Lucide Vue Next 0.548.0 - Icon library (client)
- Lucide React 0.555.0 - Icon library (landing)

**Testing & Development:**
- Vitest - Test runner (configured but not explicitly shown in package.json)
- Jest - Testing framework (available)
- Vite 6.0.3 - Build tool and dev server (client)
- Vite 7.2.4 - Build tool and dev server (landing)

**Build & Code Quality:**
- Vue TSC 2.1.10 - TypeScript type checking for Vue
- Prettier 3.6.2 - Code formatter
- ESLint 9.39.1 - Linting (landing)
- Credo 1.7 - Linting for Elixir (server, dev-only)
- Knip 5.81.0 - Unused code detection (client, dev-only)
- Madge 8.0.0 - Circular dependency analysis (client, dev-only)

## Key Dependencies

**Client Frontend:**
- `@tauri-apps/api` 2.x - Desktop integration
- `@tauri-apps/plugin-sql` ~2 - Local database via Tauri
- `@tauri-apps/plugin-global-shortcut` 2.3.1 - Global keyboard shortcuts
- `@tauri-apps/plugin-updater` 2.9.0 - Auto-update system
- `@tauri-apps/plugin-dialog` ~2.5.0 - Native file/message dialogs
- `@tauri-apps/plugin-process` 2.3.1 - Process control
- `@tauri-apps/plugin-opener` 2 - Open links/files
- `axios` 1.7.9 - HTTP client for API calls
- `pinia` 2.3.0 - State management
- `vue-router` 4 - Client routing
- `phoenix` 1.8.1 - WebSocket client (for Phoenix channels)
- `livekit-client` 2.9.1 - Real-time video/audio communication
- `hls.js` 1.6.15 - HLS video streaming
- `md-editor-v3` 6.1.0 - Markdown editor component
- `@solana/web3.js` 1.98.4 - Solana blockchain integration

**Server (Phoenix/Elixir):**
- `phoenix` 1.8.0 - Web framework
- `phoenix_ecto` 4.5 - Ecto integration with Phoenix
- `ecto_sql` 3.13 - SQL adapter for Ecto ORM
- `postgrex` - PostgreSQL adapter
- `bandit` 1.5 - HTTP server adapter
- `swoosh` 1.16 - Email library
- `resend` 0.4 - Email delivery provider
- `req` 0.5 - HTTP client
- `joken` 2.6 - JWT token handling
- `ed25519` 1.4 - Ed25519 signing for wallet auth
- `base58` 0.1.0 - Base58 encoding
- `cachex` 3.6 - In-memory caching
- `cors_plug` 3.0 - CORS middleware
- `httpoison` 2.2 - HTTP client for Stripe/price fetching
- `finch` 0.19 - HTTP client
- `dotenvy` 0.8.0 - Environment variable loading
- `ueberauth` 0.10 - Authentication framework
- `ueberauth_google` 0.10 - Google OAuth strategy
- `stripity_stripe` 3.2 - Stripe API client
- `pbkdf2_elixir` 2.0 - Password hashing
- `ex_aws` 2.5 - AWS SDK for Elixir
- `ex_aws_s3` 2.5 - AWS S3/Cloudflare R2 support
- `sweet_xml` 0.7 - XML parsing
- `hackney` 1.20 - HTTP client with TLS support
- `certifi` 2.12 - SSL/TLS certificates
- `pulsekit` 1.0 - Error tracking and event monitoring

**Landing Page:**
- `react` 19.2.0 - UI framework
- `react-dom` 19.2.0 - React rendering
- `react-router-dom` 7.11.0 - Routing
- `framer-motion` 12.23.25 - Animation library

**Monorepo Utilities:**
- `concurrently` 9.1.2 - Run multiple commands concurrently
- `husky` 9.1.7 - Git hooks
- `lint-staged` 16.2.6 - Run linters on staged files
- `magic-string` 0.30.17 - String manipulation utility

## Configuration

**Environment:**
- `.env` files for local development (client, server)
- `config/config.exs` - Phoenix static configuration
- `config/dev.exs` - Development environment (Phoenix)
- `config/runtime.exs` - Runtime configuration loading from environment variables
- Fly.io environment variables for production deployment

**Key Environment Variables (Server):**
- `JWT_SECRET` - JWT signing key
- `DATABASE_URL` - PostgreSQL connection string
- `VITE_API_URL` - Client API endpoint
- `STRIPE_SECRET_KEY` - Stripe API key
- `RESEND_API_KEY` - Resend email API key
- `ALCHEMY_API_KEY`, `ALCHEMY_ENDPOINT` - Alchemy blockchain API
- `SOLANA_RPC_URL` - Solana RPC endpoint
- `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` - OpenRouter LLM
- `REPLICATE_API_TOKEN` - Replicate AI API
- `WHIPSER_API_KEY` - Whisper speech-to-text
- `GOOGLE_VISION_API_KEY` - Google Vision API
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - Google OAuth
- `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` - Instagram API
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` - Cloudflare R2
- `RESEND_API_KEY` - Resend email provider

**Build Configuration:**
- `vite.config.ts` - Client build configuration (Vite + Tauri)
- `vite.config.ts` - Landing build configuration
- `tsconfig.json` - TypeScript configuration (client)
- `tailwind.config.js` - Tailwind CSS configuration
- `postcss.config.js` - PostCSS configuration
- `mix.exs` - Phoenix/Elixir project configuration

## Platform Requirements

**Development:**
- Node.js (LTS recommended)
- Elixir 1.15+
- Erlang/OTP compatible with Elixir
- PostgreSQL (for local database)
- Git

**Production:**
- Fly.io (primary deployment platform)
- PostgreSQL database (managed)
- Cloudflare R2 (object storage)
- External API keys for third-party services

**Desktop Application (Tauri):**
- Rust toolchain (for building Tauri)
- Platform-specific build tools (Xcode on macOS, MSVC on Windows, build-essential on Linux)

---

*Stack analysis: 2026-01-27*
