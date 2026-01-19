# Clippster

A desktop application for automated long-form to short-form video clip generation and editing. Built as a Tauri + Phoenix monorepo, Clippster combines AI-powered video processing with professional timeline editing, multi-platform authentication, and team collaboration features for content creators and organizations.

## Overview

**Clippster** transforms how creators produce short-form content by automating clip detection from long-form videos, VODs, and livestreams. With a professional timeline editor featuring frame-accurate playback, AI-powered transcription and analysis, and seamless social media integration, Clippster accelerates content creation workflows for individual creators and teams.

**Key Capabilities:**
- Frame-accurate video playback engine with Rust-based decoding
- Multi-participant livestream recording with audio mixing
- Organization-based team collaboration with campaigns
- Professional clipper profiles and leaderboards
- Real-time messaging and clip distribution

## Architecture

This monorepo contains three main applications:

- **`client/`** - Tauri + Vue 3 desktop application (frontend)
- **`server/`** - Phoenix API backend (Elixir/Erlang)
- **`landing/`** - React + TypeScript marketing landing page

### Technology Stack

**Frontend (Client):**
- Tauri 2.x - Desktop application framework
- Vue 3 + TypeScript - Modern UI framework with Composition API
- Vite - Fast build tool and dev server
- Tailwind CSS v4 - Utility-first styling
- Pinia - State management
- Radix Vue + Reka UI - Headless component libraries
- Solana Web3.js - Wallet authentication
- Phoenix Channels - WebSocket real-time communication
- HLS.js - Livestream video playback

**Backend (Server):**
- Phoenix 1.8 - Modern Elixir web framework
- Ecto 3.13 - Database ORM and query layer
- PostgreSQL - Primary database (50+ migrations)
- Bandit 1.5 - High-performance HTTP server
- JWT (Joken) - Token-based authentication
- ED25519 - Solana wallet signature verification
- Stripe - Payment processing and subscriptions
- ExAws S3 - Cloudflare R2 storage integration
- OAuth (Google) - Third-party authentication
- Instagram/Twitter APIs - Social media integration

**Desktop Runtime:**
- Rust (Tauri backend) - Native system integration with WGPU video renderer
- SQLite - Local storage via Tauri SQL plugin (clippster_v25.db)
- FFmpeg - Bundled binary for video/audio processing (see `docs/FFMPEG_SETUP_WINDOWS.md`)
- LiveKit Client - Multi-participant livestream support
- Frame Decoder - Rust-based frame-accurate video decoding with LRU cache

**Landing Page:**
- React + TypeScript
- Vite + Tailwind CSS v4
- React Compiler enabled

## Quick Start

### Prerequisites

- Node.js (v18+)
- Yarn package manager
- Elixir 1.15+ and Erlang/OTP 25+
- PostgreSQL 12+
- Rust and Cargo (for Tauri development)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd clippster

# Install all dependencies (client + server + landing)
yarn install:all

# Or install dependencies individually
cd client && yarn install
cd ../server && mix deps.get
cd ../landing && yarn install
```

### Development

```bash
# Start both server and Tauri desktop app (recommended)
yarn dev

# Start individual services
yarn server      # Phoenix API server only (localhost:4000)
yarn client      # Vue development server only (localhost:1420)
yarn tauri       # Tauri desktop app only
yarn landing     # Landing page development server
```

### Build Commands

```bash
# Build Vue frontend
yarn build

# Build Tauri desktop application
cd client && yarn tauri build

# Build landing page
cd landing && yarn build
```

## Project Structure

```
clippster/
├── client/                    # Tauri + Vue desktop application
│   ├── src/                  # Vue application source
│   ├── src-tauri/            # Rust Tauri backend
│   ├── package.json          # Frontend dependencies
│   └── README.md             # Client-specific documentation
├── server/                    # Phoenix API server
│   ├── lib/                  # Elixir application code
│   ├── config/               # Configuration files
│   ├── priv/repo/            # Database migrations
│   └── README.md             # Server-specific documentation
├── landing/                   # React + TypeScript marketing landing page
│   ├── src/                  # Landing page source
│   ├── package.json          # Landing page dependencies
│   └── README.md             # Landing page documentation
├── scripts/                   # Build and setup scripts
│   └── setup-binaries.js     # FFmpeg and binary setup
├── .husky/                    # Git hooks
├── .gitignore                 # Git ignore rules
├── package.json               # Root monorepo scripts
└── README.md                  # This file
```

## Available Scripts

### Root Level Scripts

```bash
# Development
yarn dev              # Start server + Tauri app concurrently
yarn server           # Start Phoenix API server
yarn client           # Start Vue development server
yarn tauri            # Start Tauri desktop app
yarn landing          # Start landing page dev server

# Setup
yarn setup:binaries   # Download FFmpeg and required binaries
yarn install:all      # Install all project dependencies

# Code Quality
yarn format           # Format client code
yarn format:check     # Check code formatting
yarn type-check       # Type check Vue application
```

### Environment Configuration

#### Development URLs
- **Frontend**: http://localhost:1420
- **Backend API**: http://localhost:4000
- **Landing Page**: http://localhost:5173 (development)

#### Database
- **Development**: PostgreSQL on localhost:5432
- **Credentials**: postgres/postgres
- **Database**: clippster_server_dev

#### Environment Variables

Required for server:
- `JWT_SECRET` - JWT token signing secret
- `DOMAIN` - Application domain (defaults to "localhost")

Optional:
- `PAYMENT_ADDRESS` - Solana wallet for payments
- `ALCHEMY_API_KEY` - Alchemy price service API key
- `SOLANA_RPC_URL` - Custom Solana RPC endpoint

## Key Features

### Video Processing & AI
- **Multi-Platform Import**: YouTube, Twitch, Kick URLs or local video files
- **AI Clip Detection**: Automated highlight detection using OpenRouter API with chunked processing for long videos
- **Whisper Transcription**: Accurate speech-to-text with word-level timestamps
- **Professional Timeline Editor**: Multi-track editing with drag-and-drop, cut tool, keyboard shortcuts, collision detection, and undo/redo system
- **Frame-Accurate Playback**: Rust-based frame decoder with LRU cache (200 frames), predictive prefetching, and canvas rendering for seamless playback
- **Unified Track Rendering**: Text, stickers, watermarks, audio, and effects rendered via unified track system with keyframe animation
- **Export for Social**: Multiple format presets optimized for TikTok, Instagram, YouTube Shorts

### Livestream Features
- **DVR Recording**: Capture livestreams from Kick, Twitch, YouTube with HLS segmentation and atomic segment writes
- **Real-time Monitoring**: Track multiple streams simultaneously with auto-recording
- **Live Clip Detection**: AI-powered highlight detection during active streams
- **LiveKit Integration**: Multi-participant stream support with audio mixing for all tracks
- **Guest Handling**: Automatic main broadcaster detection and multi-track audio capture for PumpFun streams with guests

### Organizations & Team Collaboration
- **Shared Workspaces**: Team-based content creation with member roles and permissions
- **Organization Assets**: Shared fonts, images, audio, watermarks accessible to all members
- **Clip Distribution**: Share clips with team members via real-time messaging
- **Credit Pools**: Organization-level credits with member allocations
- **Public Applications**: Recruit team members through public application system

### Clipping Campaigns
- **Campaign Management**: Organizations create campaigns with budgets, deadlines, and creator profiles
- **Clipper Competition**: Submit clips for review with CPM/CPC performance-based payments
- **Leaderboard System**: Track top performers with achievement badges and endorsements
- **Analytics Dashboard**: View submission metrics, views, clicks, and engagement

### Clipper Profiles
- **Professional Portfolios**: Showcase best clips with thumbnails and performance metrics
- **Social Integration**: Link Kick, Twitch, YouTube, Twitter, Instagram profiles
- **Performance Tracking**: Leaderboard rankings, total views, response time statistics
- **Campaign Discovery**: Browse and join available campaigns

### Social Media Integration
- **Instagram OAuth**: Complete flow with post scheduling and analytics sync
- **Twitter API**: Automated posting and content scheduling
- **Account Management**: Encrypted token storage with auto-refresh
- **Scheduled Posts**: Queue content for future publishing across platforms

### Authentication System
- **Multiple Methods**: Solana wallet (ED25519), Google OAuth, or email/password
- **Challenge-Response**: Cryptographic challenges prevent replay attacks
- **JWT Tokens**: 7-day expiration with secure session management
- **Account Types**: Personal accounts, organization owners, or organization members

### Real-time Messaging
- **Team Communication**: Organization-scoped conversations via Phoenix channels
- **Multi-User Support**: Group conversations with read status tracking
- **Clip Sharing**: Share clips directly in conversations
- **WebSocket Delivery**: Instant message delivery and presence updates

### Credits & Billing
- **Stripe Integration**: Subscription plans (Starter, Creator, Pro)
- **Pay-Per-Use Credits**: Usage-based billing for AI processing
- **Discount Codes**: Promotional codes with usage limits
- **Transaction History**: Detailed credit usage logs and analytics

## Development Workflow

### Code Quality & Testing

```bash
# Backend
cd server
mix test                 # Run tests
mix precommit            # Format, compile, test
mix format               # Format code

# Frontend
cd client
yarn type-check          # TypeScript validation
yarn format              # Format code
yarn format:check        # Check formatting
```

**Code Quality Tools:**
- Pre-commit hooks (Husky + lint-staged)
- Prettier (Vue/TypeScript)
- Mix Format (Elixir)
- TypeScript static type checking

## Security

- **Authentication**: JWT tokens, ED25519 signatures, OAuth verification, challenge-response flow
- **CORS**: Configured for Tauri origins (`tauri://`, `https://tauri.localhost`)
- **Input Validation**: Ecto changesets validate all inputs
- **Token Encryption**: Social account tokens encrypted at rest
- **Asset Scoping**: File access restricted to app data directory

## Build and Deployment

```bash
# Development
yarn dev

# Production builds
cd client && yarn tauri build    # Desktop app
cd server && MIX_ENV=prod mix release    # Server

# Production setup
# - Use environment variables for secrets
# - Configure production database
# - Set JWT_SECRET and Stripe keys
# - Use reverse proxy for SSL
```

## OTA Updates

Clippster uses Tauri's official updater plugin to deliver **mandatory updates**. Users must install updates before they can use the app.

### How Updates Work

1. Push to `release` branch triggers GitHub Actions
2. CI builds and signs artifacts for all platforms
3. `latest.json` manifest is uploaded to GitHub Releases
4. App checks for updates on startup and blocks until updated

### Triggering a Release

```bash
# 1. Update version in client/src-tauri/tauri.conf.json
# 2. Push to release branch
git checkout release
git merge main
git push origin release

# 3. GitHub Actions builds and creates draft release
# 4. Review and publish the release manually
```

### Required GitHub Secrets

| Secret | Purpose |
|--------|---------|
| `TAURI_SIGNING_PRIVATE_KEY` | Signs update artifacts (required) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Decrypts private key (if encrypted) |
| `APPLE_ID` | macOS notarization (optional) |
| `APPLE_PASSWORD` | macOS notarization (optional) |
| `APPLE_TEAM_ID` | macOS notarization (optional) |
| `WINDOWS_CERTIFICATE` | Windows code signing (optional) |
| `WINDOWS_CERTIFICATE_PASSWORD` | Windows code signing (optional) |

### Generating Signing Keys

```bash
cd client
npx tauri signer generate -w ~/.tauri/clippster.key
# Copy public key to tauri.conf.json "plugins.updater.pubkey"
# Set private key as TAURI_SIGNING_PRIVATE_KEY secret
```

For detailed documentation, see [docs/completed/OTA-UPDATES.md](docs/completed/OTA-UPDATES.md).

## Documentation Index

### Component Documentation
- **[AGENTS.md](AGENTS.md)** - Comprehensive guide for AI agents and developers (v0.1.46, updated Jan 2026)
- **[Client README](client/README.md)** - Tauri + Vue 3 desktop application documentation
- **[Server README](server/README.md)** - Phoenix API backend documentation
- **[Landing README](landing/README.md)** - React + TypeScript landing page

### Setup Guides
- **[FFmpeg Setup (Windows)](docs/FFMPEG_SETUP_WINDOWS.md)** - Windows development environment setup for video rendering

### Completed Features
- **[OTA Updates](docs/completed/OTA-UPDATES.md)** - Over-the-air update system implementation
- **[Clipper Profiles](docs/completed/Clipper_Profiles_Implementation.md)** - Professional clipper profile system
- **[Clipping Campaigns](docs/completed/Clipping_Campaigns_System_Implementation.md)** - Campaign system for organizations
- **[Organization Features](docs/completed/organization-d0862a25.plan.md)** - Team collaboration implementation
- **[Instagram Integration](docs/completed/INSTAGRAM_COMPLETE_FLOW_CHART.md)** - OAuth flow and post scheduling
- **[Twitter Integration](docs/completed/Twitter_Integration_Plan.md)** - Twitter API integration
- **[Messaging System](docs/completed/ORG_CLIP_DISTRIBUTION_AND_CHAT_PLAN.md)** - Real-time team communication
- **[Livestream Features](docs/completed/LIVESTREAM_WATCH_PLAN.md)** - DVR recording and monitoring
- **[Subscription System](docs/completed/SUBSCRIPTION_PLAN.md)** - Stripe integration and billing
- **[Video Editor Enhancements](docs/completed/Video_Editor_Enhancements.md)** - Timeline editor features
- **[Undo/Redo System](docs/completed/Undo_Redo_Implementation_Plan.md)** - Command pattern implementation

### Future Plans
- **[Video Editor Playback Optimization](docs/future/Video_Editor_Playback_Optimization_Plan.md)** - Tiered optimization plan (proxy videos, WebGL canvas, WebCodecs API)
- **[GPU Pipeline Optimization](docs/future/GPU_PIPELINE_OPTIMIZATION.md)** - Hardware-accelerated video processing
- **[CapCut-Style Thumbnails](docs/future/CAPCUT_STYLE_VIDEO_THUMBNAILS_PLAN.md)** - Enhanced timeline thumbnails with sprite sheets

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and code quality checks
5. Submit a pull request

### Code Standards
- Follow Prettier configuration for frontend code
- Use Mix Format for Elixir code
- Write tests for new features
- Update documentation as needed

## Support

- **Quick Reference**: See [AGENTS.md](AGENTS.md) for comprehensive development guide
- **Documentation**: See [Documentation Index](#documentation-index) above for detailed feature docs
- **Component Docs**: See [client/README.md](client/README.md), [server/README.md](server/README.md), [landing/README.md](landing/README.md)
- **Issues**: Report bugs and feature requests via GitHub issues

## License

[Add your license information here]

## Related Technologies

- [Tauri Documentation](https://tauri.app/)
- [Phoenix Framework](https://www.phoenixframework.org/)
- [Vue 3 Documentation](https://vuejs.org/)
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/)
- [Tailwind CSS](https://tailwindcss.com/)