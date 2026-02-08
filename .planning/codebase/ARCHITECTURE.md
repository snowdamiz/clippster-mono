# Architecture

**Analysis Date:** 2026-01-27

## Pattern Overview

**Overall:** Multi-tier monorepo architecture with separated frontend (Vue 3 Tauri desktop) and backend (Elixir Phoenix web framework). Client-side state management via Pinia stores. Server-side context modules for domain logic. Real-time communication via WebSocket channels.

**Key Characteristics:**
- Monorepo with three independent applications: client (Tauri desktop app), server (Phoenix API), landing page
- Frontend: Vue 3 composition API with Pinia state management and SQLite local database
- Backend: Elixir domain-driven architecture with context modules organizing business logic
- Data synchronization: REST API + WebSocket channels for real-time updates
- Authentication: Multi-provider (wallet, Google OAuth, email) with token-based authorization
- Database: PostgreSQL on backend, SQLite locally on client for offline-first capabilities

## Layers

**Presentation Layer (Client):**
- Purpose: User interface, state management, local data persistence
- Location: `client/src/`
- Contains: Vue components, pages, layouts, composables (reusable logic hooks)
- Depends on: Local SQLite database, API services, Pinia stores
- Used by: Desktop users via Tauri wrapper

**Service Layer (Client):**
- Purpose: API communication, external integrations, business logic utilities
- Location: `client/src/services/`
- Contains: API clients (campaignApi.ts, clipperProfilesApi.ts, socialAccountsApi.ts), socket handlers, file operations
- Depends on: Axios for HTTP, Phoenix channels for WebSocket, database services
- Used by: Components and composables

**Database Layer (Client):**
- Purpose: Local data persistence and querying
- Location: `client/src/services/database/`
- Contains: SQLite table operations, project/clip/media CRUD, transcript management
- Depends on: Tauri SQL plugin for database access
- Used by: Services and composables for local state

**Composable Layer (Client):**
- Purpose: Shared, reusable reactive logic
- Location: `client/src/composables/`
- Contains: Audio/video operations, livestream monitoring, playback engines, timeline rendering
- Depends on: Services, database, stores
- Used by: Components via Vue 3 composition API

**Store Layer (Client):**
- Purpose: Global application state management
- Location: `client/src/stores/`
- Contains: Auth state, livestream status, messaging, platform detection, permissions
- Depends on: API services for synchronization
- Used by: Components, composables

**Web API Layer (Server):**
- Purpose: HTTP endpoint definitions and request handling
- Location: `server/lib/clippster_server_web/controllers/`
- Contains: 40+ controllers handling auth, clips, campaigns, organizations, payments
- Depends on: Router definitions, context modules
- Used by: External clients (Tauri frontend, landing page)

**WebSocket Layer (Server):**
- Purpose: Real-time bidirectional communication
- Location: `server/lib/clippster_server_web/messaging_channel.ex`, `progress_channel.ex`
- Contains: Channel handlers for messaging and clip build progress
- Depends on: Phoenix Socket, PubSub
- Used by: Client for real-time updates

**Context Layer (Server):**
- Purpose: Domain-driven business logic and database queries
- Location: `server/lib/clippster_server/`
- Contains: Modules like Accounts, Organizations, Campaigns, Social, Subscriptions
- Depends on: Database schemas (Ecto), external services (Stripe, OpenRouter)
- Used by: Controllers, other contexts

**Schema Layer (Server):**
- Purpose: Data model definitions and validations
- Location: Embedded in context module directories (e.g., `server/lib/clippster_server/organizations/`)
- Contains: Ecto schemas with changesets for validation
- Depends on: Ecto ORM, database migrations
- Used by: Context modules for CRUD operations

**Worker Layer (Server):**
- Purpose: Background job processing
- Location: `server/lib/clippster_server/` (cleanup workers, token refresh workers, sync workers)
- Contains: Recurring tasks for analytics sync, token refresh, shared clip cleanup, leaderboard updates
- Depends on: Oban job queue (or GenServer), context modules
- Used by: Application supervisor for startup

## Data Flow

**User Authentication Flow:**

1. Client requests challenge from server (`/api/auth/challenge`)
2. Server returns nonce
3. Client signs with wallet/OAuth provider or email credentials
4. Client sends verification to server (`/api/auth/verify` or `/api/auth/login`)
5. Server validates signature/credentials and returns JWT token + user data
6. Client stores token in auth store and sets database user context
7. Client performs initial sync of user data from server

**Project & Clip Creation Flow:**

1. User creates project in client UI
2. Client stores project in local SQLite database immediately (optimistic)
3. User imports media (video/audio) → stored in local database
4. Client extracts transcript/detects clips using local services or via API
5. Clip data persists to local database
6. On demand, client builds video file via server `/api/clips/build` endpoint
7. Server processes build request asynchronously
8. Build completion sent to client via WebSocket progress channel
9. Client receives update, displays result

**Livestream Monitoring Flow:**

1. User connects to livestream via URL or API credentials
2. Client monitors stream via HLS/RTMP using `useLivestreamViewer.ts`
3. Segments processed via `useLivestreamSegmentProcessing.ts`
4. Clip detection runs on segments
5. Detected clips saved to local database
6. Build requests sent to server
7. Completed clips available for download/sharing

**Social Media Posting Flow:**

1. Client prepares clip for publishing
2. Sends to server via `/api/social/post` with target platform
3. Server handles authentication with social platform
4. Video file uploaded via platform API
5. Post metadata stored in organization social accounts
6. Scheduled posts queued for later publishing

**State Management:**

- **Auth State**: Pinia `useAuthStore` holds user, token, organization data. Persisted across sessions via localStorage.
- **Local Clip Data**: SQLite database `clippster_v25.db` holds all projects, clips, media. Survives app closure.
- **Real-time Updates**: WebSocket channels push progress updates, new messages, clip build status.
- **Organization Data**: Cached in stores, synchronized on user action (load organization page).
- **UI State**: Stores like `liveStatus`, `livestream` hold UI-specific reactive state (playback state, segment data).

## Key Abstractions

**Clip Object:**
- Purpose: Represents a video segment for editing/publishing
- Examples: `client/src/services/database/clips.ts`, `server/lib/clippster_server/campaigns.ex`
- Pattern: Decomposed into Clip (metadata) + ClipSegment (timeline segments) + ClipVersion (edit history) + ClipBuild (render output)

**Project:**
- Purpose: Container for source media and generated clips
- Examples: `client/src/services/database/projects.ts`, `client/src/pages/VideoEditor.vue`
- Pattern: Project → source media files → transcript → detected clips or manual clips

**Organization:**
- Purpose: Multi-user container with shared assets, credits, social accounts
- Examples: `server/lib/clippster_server/organizations.ex`, `client/src/pages/organization/`
- Pattern: Organization → members (with roles) → shared clips, assets, social accounts; organization credits distributed to members

**Timeline:**
- Purpose: Visual representation of media and edits in editor
- Examples: `client/src/composables/useTimelineRenderer.ts`, `client/src/components/clip-editor/ClipEditorTimeline.vue`
- Pattern: Timeline segments (video/audio/text/stickers) with position/duration, rendered with waveforms and scrubber

**Build Queue:**
- Purpose: Async video rendering pipeline
- Examples: `client/src/services/database/clip-build.ts`, server build endpoint
- Pattern: Clip marked as "building" → sent to server → FFmpeg processes → file stored → WebSocket notifies client

**Platform Integration:**
- Purpose: Abstract social media platform differences
- Examples: `server/lib/clippster_server/social.ex` (Twitch, Instagram, TikTok, YouTube)
- Pattern: Per-platform auth flows, publish APIs, scheduling logic unified in context module

## Entry Points

**Client Entry:**
- Location: `client/src/main.ts`
- Triggers: App launch (Tauri invokes)
- Responsibilities: Vue app initialization, router setup, Pinia store, database init, auth check

**Server Entry:**
- Location: `server/lib/clippster_server/application.ex`
- Triggers: Mix release boot (Phoenix startup)
- Responsibilities: Supervision tree, workers, database connection pool, HTTP endpoint listener

**Web Router (Server):**
- Location: `server/lib/clippster_server_web/router.ex`
- Triggers: HTTP request received
- Responsibilities: Route matching, pipeline selection (auth/admin plugs), controller delegation

**API Endpoints (Server):**
- Location: `server/lib/clippster_server_web/controllers/`
- Examples: `auth_controller.ex`, `clips_controller.ex`, `campaigns_controller.ex`
- Pattern: Controller receives routed request → calls context module → returns JSON response

**WebSocket Channels (Server):**
- Location: `server/lib/clippster_server_web/messaging_channel.ex`, `progress_channel.ex`
- Triggers: Client connects to `/socket` with channel topic
- Responsibilities: Bidirectional event handling, broadcast to subscribers

**UI Routes (Client):**
- Location: `client/src/router/index.ts`
- Examples: `/projects`, `/video-editor`, `/clips`, `/live-clip`, `/organizations`
- Pattern: Route → Layout (DashboardLayout) → Page component (lazy-loaded)

## Error Handling

**Strategy:** Multi-layer error containment with user-facing toast notifications.

**Patterns:**

- **API Errors**: Service layer catches HTTP errors, wraps in result objects with error strings. Components check result.error and display Toast.
- **Database Errors**: Database functions throw on SQL errors. Caught by composables, often with fallback (empty state).
- **Validation Errors**: Server changesets return structured validation errors. Client displays field-level errors in forms.
- **WebSocket Errors**: Channel handlers respond with error tuple. Client reconnects on disconnect.
- **Business Logic Errors**: Contexts return `{:error, reason}` tuples. Controllers respond with appropriate HTTP status.

## Cross-Cutting Concerns

**Logging:**

- **Client**: Console.log statements in composables, services. Accessible via browser dev tools.
- **Server**: Elixir Logger module. Development shows logs in terminal. Production logs to standard output (captured by Fly.io).

**Validation:**

- **Client**: Vue form components validate input on change/blur. Database schema enforces constraints.
- **Server**: Ecto changesets define required fields, formats, relationships. Validation errors returned to client.

**Authentication:**

- **Client**: Auth store manages JWT token. Composable `useAuthStore` checks isAuthenticated before operations.
- **Server**: `AuthPlug` middleware validates token and attaches user to connection. `AdminPlug` further restricts to admin role.
- **Session**: Tokens expire server-side. Client refreshes token before expiry or handles 401 with re-login.

**Authorization:**

- **Organization Scope**: Operations check user is organization member with required role (member/manager/owner).
- **Resource Ownership**: Clips/projects owned by org verified before CRUD.
- **Data Isolation**: Database queries scoped by organization or user ID automatically.

**State Synchronization:**

- **Optimistic Updates**: Client updates UI immediately, syncs to server in background.
- **WebSocket Sync**: Real-time updates (build completion, new messages) broadcast via channels.
- **Periodic Refresh**: Some data (credits, social accounts) refreshed on page load or interval.

---

*Architecture analysis: 2026-01-27*
