# CLAUDE.md

This file provides guidance to AI agents when working with code in this repository.

## Project Overview

**Clippster** is a desktop application for automated long-form to short-form video clip generation and editing. Built as a Tauri + Phoenix monorepo, it combines AI-powered video processing with professional timeline editing, wallet/OAuth authentication, and team collaboration features for content creators and organizations.

## Monorepo Structure

```
clippster-mono/
├── client/               # Tauri + Vue 3 desktop app (TypeScript)
│   ├── src/             # Vue application (pages, components, stores)
│   ├── src-tauri/       # Rust Tauri backend
│   └── package.json     # Frontend dependencies
├── server/              # Phoenix API server (Elixir)
│   ├── lib/             # Elixir application code
│   ├── config/          # Configuration files
│   └── priv/repo/       # Database migrations & seeds
├── landing/             # Vue 3 landing page (separate app)
├── scripts/             # Build and setup scripts
└── docs/                # Project documentation
```

## Technology Stack

**Frontend:**
- Tauri 2.x (desktop framework), Vue 3 + TypeScript, Vite
- Tailwind CSS v4, Pinia (state management)
- Radix Vue + Reka UI (component libraries)
- Solana Web3.js, Phoenix channels (WebSocket)

**Backend:**
- Phoenix 1.8, Ecto 3.13, PostgreSQL
- JWT (Joken), ED25519 (wallet signatures)
- Stripe (payments), ExAws S3 (Cloudflare R2 storage)
- OAuth (Google), Instagram/Twitter APIs

**Desktop:**
- SQLite (local storage via Tauri SQL plugin)
- FFmpeg (bundled binary for video processing)
- HLS.js, LiveKit (livestream features)

## Development Commands

### Quick Start
```bash
# Start full stack (Phoenix + Tauri)
yarn dev

# Individual services
yarn server           # Phoenix API (localhost:4000)
yarn client           # Vue dev server (localhost:1420)
yarn tauri            # Tauri desktop app
yarn landing          # Landing page (localhost:5173)

# Setup from scratch
yarn install:all      # Install all dependencies
cd server && mix setup  # Create & migrate database
```

### Backend (Elixir/Phoenix)
```bash
cd server

# Database operations
mix ecto.create
mix ecto.migrate
mix ecto.reset

# Testing & quality
mix test
mix precommit         # Compile, format, test
```

### Frontend (Vue/Tauri)
```bash
cd client

# Development
yarn dev              # Vite dev server
yarn tauri dev        # Tauri desktop app

# Build & quality
yarn build            # Production build
yarn format           # Prettier formatting
yarn type-check       # TypeScript validation
```

## Core Features & Architecture

### Authentication System
- **Multiple Auth Methods**: Solana wallet (ED25519), Google OAuth, email/password
- **Challenge-Response**: Wallet auth uses cryptographic challenges to prevent replay attacks
- **JWT Tokens**: 7-day expiration with secure token management
- **Account Types**: Personal, organization owners, organization members
- **Admin System**: First user becomes admin, can manage users/settings/beta codes

### User Account System
Users can authenticate via:
1. Solana wallet signature verification
2. Google OAuth (auto-verified email)
3. Email/password with OTP verification

Account types: `personal`, `organization` (owner), or member of organization(s).

### Organizations & Team Collaboration
Organizations enable team-based content creation workflows:
- **Members**: Invite users, assign roles with permissions
- **Shared Assets**: Organization-wide fonts, images, audio, watermarks
- **Creator Profiles**: Shared social media profiles for content creation
- **Clip Distribution**: Share clips with team members via messaging
- **Social Accounts**: Manage Instagram/Twitter accounts for scheduling
- **Campaigns**: Create clipping campaigns for team members
- **Credits**: Organization credit pools with member allocations
- **Applications**: Public application system for teams to recruit

### Clipping Campaigns System
Organizations can create campaigns where clippers compete:
- **Campaign Setup**: Define budget, creator profiles, deadlines
- **Submissions**: Clippers submit clips for review
- **Payments**: CPM/CPC based on performance metrics
- **Leaderboard**: Track top performers with badges
- **Analytics**: View submission metrics and engagement

### Clipper Profiles
Professional profiles for content creators:
- **Portfolio**: Showcase best clips with thumbnails
- **Social Links**: Kick, Twitch, YouTube, Twitter, Instagram
- **Performance Metrics**: Leaderboard ranking, total views, response time
- **Badges**: Achievement badges for performance milestones
- **Endorsements**: Recommendations from organizations
- **Campaign Participation**: Browse and join campaigns

### Messaging System
Real-time messaging via Phoenix channels:
- **Conversations**: Organization-scoped or direct messages
- **Participants**: Multi-user conversations
- **Read Status**: Track message read state per user
- **WebSocket**: Real-time message delivery
- **Clip Sharing**: Share clips directly in conversations

### Social Media Integration
- **Instagram**: OAuth flow, post scheduling, analytics sync
- **Twitter**: API integration for posting
- **Account Management**: Token encryption, auto-refresh
- **Scheduled Posts**: Queue content for future publishing
- **Analytics**: Track post performance and views

### Video Processing Pipeline
1. **Import**: YouTube, Twitch, Kick URLs or local files
2. **Transcription**: Whisper API for accurate speech-to-text
3. **AI Analysis**: OpenRouter API for content detection
4. **Chunked Processing**: Efficient handling of long videos
5. **Timeline Editor**: Professional multi-track editing interface
6. **Export**: Multiple formats for social platforms

### Timeline Editor (`client/src/components/Timeline.vue`)
Sophisticated video editing interface (2,300+ lines):
- Multi-track timeline with drag-and-drop segments
- Real-time transcript synchronization
- Cut tool, resize handles, collision detection
- Keyboard shortcuts (arrows, X, J, Backspace)
- Zoom/pan controls, multi-segment selection
- Visual feedback for constraints and overlaps

### Credits & Billing
- **Credit System**: Pay-per-use for AI processing
- **Stripe Integration**: Subscription plans (Starter, Creator, Pro)
- **Promo Codes**: Discount codes with usage limits
- **Organization Credits**: Shared credit pools for teams
- **Transaction History**: Detailed credit usage logs

### Livestream Features
- **DVR Recording**: Record livestreams from Kick/Twitch
- **Real-time Monitoring**: Track multiple streams
- **Clip Detection**: AI-powered highlight detection during streams
- **HLS Playback**: Smooth video playback with hls.js
- **LiveKit Integration**: Multi-participant stream support

## Database Schema (Key Tables)

**Users:**
- Authentication: `wallet_address`, `email`, `password_hash`, `provider` (wallet/google/email)
- Profile: `name`, `avatar_url`, `email_verified`
- Account: `account_type` (personal/organization), `owned_organization_id`
- Subscription: `subscription_status`, `subscription_tier`, `stripe_subscription_id`
- Admin: `is_admin`, `beta_activated`

**Organizations:**
- Basic: `name`, `description`, `logo_url`, `owner_id`
- Settings: `restrict_*` fields for permission control
- Credits: Organization-level credit management

**Organization Members:**
- Membership: `organization_id`, `user_id`, `role`
- Permissions: `can_*` fields for fine-grained access control
- Credits: `allocated_credits` for member limits

**Campaigns:**
- Details: `title`, `description`, `creator_profile_ids`, `budget_sol`
- Payment: `payment_model` (cpm/cpc), `rates`, `total_paid_cents`
- Metrics: `total_views`, `total_clicks`, `total_submissions`

**Social Accounts:**
- Platform: `platform` (instagram/twitter), `organization_id`
- Auth: `access_token` (encrypted), `refresh_token`, `expires_at`
- Identity: `platform_user_id`, `username`, `profile_picture_url`

**Conversations & Messages:**
- Messaging: `conversation_id`, `sender_id`, `content`, `read_status`
- Organization-scoped or direct messages

## API Endpoints (Key Routes)

### Authentication
- `POST /api/auth/challenge` - Get wallet challenge
- `POST /api/auth/verify` - Verify wallet signature → JWT
- `GET /api/auth/google` - Google OAuth
- `POST /api/auth/email/register` - Email registration
- `POST /api/auth/email/login` - Email login

### Organizations
- `GET /api/organizations` - List user's organizations
- `POST /api/organizations` - Create organization
- `POST /api/organizations/:id/members` - Invite member
- `GET /api/organizations/:id/assets` - List assets
- `POST /api/organizations/:id/assets` - Upload asset

### Campaigns
- `GET /api/campaigns` - List campaigns
- `POST /api/campaigns` - Create campaign
- `POST /api/campaigns/:id/submissions` - Submit clip
- `GET /api/campaigns/:id/leaderboard` - Get leaderboard

### Social Media
- `POST /api/social-accounts` - Add social account
- `POST /api/scheduled-posts` - Schedule post
- `GET /api/scheduled-posts` - List scheduled posts

### Messaging
- WebSocket: `/socket/messaging` - Real-time messaging
- `GET /api/messaging/conversations` - List conversations
- `POST /api/messaging/send` - Send message

### Admin
- `GET /api/admin/users` - List all users
- `POST /api/admin/users/:id/promote` - Promote to admin
- `GET /api/admin/beta-codes` - Manage beta codes
- `GET /api/admin/analytics` - View analytics

## State Management (Pinia Stores)

**Auth Store** (`client/src/stores/auth.js`):
- User session, JWT token management
- Login/logout, wallet/email/OAuth flows
- User info: `user`, `token`, `isAuthenticated`

**Platform Store** (`client/src/stores/platform.ts`):
- Platform-specific data (Kick, Twitch, etc.)
- Channel info, stream status

**Messaging Store** (`client/src/stores/messaging.ts`):
- Real-time messaging state
- Conversations, messages, WebSocket connection

**Livestream Store** (`client/src/stores/livestream.ts`):
- Livestream monitoring and DVR recording
- Active streams, recording status

**Permissions Store** (`client/src/stores/permissions.ts`):
- Organization member permissions
- Feature flags and access control

## Frontend Architecture

### Pages Structure
- **Admin**: `/admin/*` - Admin dashboard, users, analytics, settings
- **Organization**: `/organization/*` - Team management, campaigns, assets
- **Clipper**: `/clipper/*` - Profile, leaderboard, campaigns
- **Content**: `/clips`, `/projects`, `/prompts` - Content management
- **Messaging**: `/messages` - Team communication
- **Social**: Organization social account management

### Key Components
- `Timeline.vue` - Professional video timeline editor
- `ClipsTab.vue` - Clip management interface
- `VideoEditor.vue` - Advanced video editing page
- UI components in `components/ui/` - Radix Vue-based design system

### Composables
Reusable logic in `client/src/composables/`:
- `useChunkedClipDetection.ts` - AI clip detection
- `useProgressSocket.ts` - WebSocket progress tracking
- `useOrganization.ts` - Organization context
- `useSubscription.ts` - Subscription management
- `useCreditBalance.ts` - Credit tracking
- `useWallet.ts` - Wallet integration
- `useVideoPlayer.ts` - Video playback control

### Services
API clients in `client/src/services/`:
- `api.ts` - Base API client with auth
- `organizationsApi.ts` - Organization endpoints
- `campaignApi.ts` - Campaign endpoints
- `messagingSocket.ts` - WebSocket messaging
- `schedulingApi.ts` - Post scheduling
- Database services in `database/` - SQLite operations

## Backend Architecture

### Contexts (Business Logic)
- `ClippsterServer.Accounts` - User management
- `ClippsterServer.Organizations` - Organization operations
- `ClippsterServer.Campaigns` - Campaign system
- `ClippsterServer.ClipperProfiles` - Clipper profiles
- `ClippsterServer.Messaging` - Real-time messaging
- `ClippsterServer.Social` - Social media integration
- `ClippsterServer.Credits` - Credit management
- `ClippsterServer.AI` - AI processing (Whisper, OpenRouter)

### Controllers
Located in `server/lib/clippster_server_web/controllers/`:
- Pattern: Create controller → Define routes in `router.ex`
- Use `AuthPlug` for protected routes
- Use `AdminPlug` for admin-only routes

### WebSocket Channels
- `ProgressChannel` - AI processing progress
- `MessagingChannel` - Real-time messaging

### Background Workers
- `TokenRefreshWorker` - Social account token refresh
- `AnalyticsSyncWorker` - Sync Instagram analytics
- `ScheduledPostWorker` - Process scheduled posts
- `LeaderboardWorker` - Update clipper leaderboard
- `BadgeWorker` - Award performance badges

## Configuration

### Environment Variables
**Server:**
- `JWT_SECRET` - JWT signing key (required)
- `DOMAIN` - App domain (default: "localhost")
- `STRIPE_SECRET_KEY` - Stripe payments
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - OAuth
- `R2_*` - Cloudflare R2 storage config
- `OPENROUTER_API_KEY` - AI processing
- `PULSEKIT_API_KEY` - Error tracking

**Client:**
- Tauri app config in `client/src-tauri/tauri.conf.json`
- SQLite database: `clippster_v25.db`

### Development URLs
- Frontend: `http://localhost:1420`
- Backend: `http://localhost:4000`
- Database: PostgreSQL `localhost:5432` (postgres/postgres)

## Common Development Patterns

### Adding New API Endpoints
1. Define schema in `lib/clippster_server/{context}/{schema}.ex`
2. Add context functions in `lib/clippster_server/{context}.ex`
3. Create controller in `lib/clippster_server_web/controllers/`
4. Add route in `router.ex` with appropriate pipeline

### Adding Frontend Pages
1. Create page in `client/src/pages/{name}.vue`
2. Add route in `client/src/router/index.ts`
3. Add auth guard if needed
4. Update navigation in `client/src/config/navigation.ts`

### Database Migrations
```bash
cd server
mix ecto.gen.migration add_field_to_table
# Edit migration file in priv/repo/migrations/
mix ecto.migrate
```

### Working with Organizations
Most features are organization-scoped:
- Check `organization_id` in queries
- Verify member permissions via `permissions` store
- Use `useOrganization()` composable for context

## Testing & Quality

### Backend
```bash
cd server
mix test                    # Run test suite
mix precommit              # Full pre-commit checks
mix format                 # Format code
```

### Frontend
```bash
cd client
yarn type-check            # TypeScript validation
yarn format                # Prettier formatting
yarn format:check          # Check formatting
```

## Security Considerations

- **Authentication**: JWT tokens, ED25519 signatures, OAuth verification
- **CORS**: Configured for Tauri origins (`tauri://`, `https://tauri.localhost`)
- **Token Encryption**: Social account tokens encrypted at rest
- **Input Validation**: Ecto changesets validate all inputs
- **CSP**: Content Security Policy configured in Tauri
- **Asset Scoping**: File access restricted to app data directory

## Deployment & Updates

### OTA Updates
- Tauri updater plugin with signed artifacts
- GitHub releases for distribution
- Update check on app launch
- See `docs/completed/OTA-UPDATES.md`

### Build Commands
```bash
# Desktop app production build
cd client && yarn tauri build

# Server production
cd server && MIX_ENV=prod mix release
```

## Troubleshooting Tips

1. **Database issues**: `cd server && mix ecto.reset`
2. **Frontend build errors**: Clear `client/dist` and rebuild
3. **Tauri errors**: Check `src-tauri/Cargo.toml` dependencies
4. **WebSocket issues**: Verify Phoenix channels are running
5. **Auth issues**: Check JWT token in browser DevTools

## Additional Documentation

- Main README: `/README.md`
- Client docs: `/client/README.md`
- Server docs: `/server/README.md`
- Feature docs: `/docs/completed/*.md`
- Future plans: `/docs/future/*.md`

---

**Current Version**: v0.1.46 (Tauri app)
**Database**: PostgreSQL with 50+ migrations
**Last Updated**: January 2026
