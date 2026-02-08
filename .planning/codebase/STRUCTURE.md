# Codebase Structure

**Analysis Date:** 2026-01-27

## Directory Layout

```
clippster-mono/
├── client/                      # Vue 3 Tauri desktop application
│   ├── src/
│   │   ├── components/          # Reusable Vue components
│   │   ├── composables/         # Reusable composition functions
│   │   ├── pages/               # Top-level page components
│   │   ├── stores/              # Pinia state management
│   │   ├── services/            # API clients and business logic
│   │   │   └── database/        # SQLite CRUD operations
│   │   ├── router/              # Vue Router configuration
│   │   ├── layouts/             # Layout wrapper components
│   │   ├── types/               # TypeScript interfaces
│   │   ├── config/              # App configuration
│   │   ├── constants/           # Constant values
│   │   ├── utils/               # Utility functions
│   │   ├── directives/          # Custom Vue directives
│   │   ├── workers/             # Web Workers
│   │   ├── App.vue              # Root component
│   │   ├── main.ts              # App entry point
│   │   ├── style.css            # Global Tailwind styles
│   │   └── fonts.css            # Font definitions
│   ├── src-tauri/               # Rust Tauri backend
│   │   ├── src/                 # Rust source code
│   │   ├── capabilities/        # Tauri capability files
│   │   ├── icons/               # App icons
│   │   └── migrations/          # SQLite migrations
│   ├── public/                  # Static assets
│   ├── dist/                    # Build output
│   ├── package.json             # Dependencies
│   ├── vite.config.ts           # Vite build config
│   └── tsconfig.json            # TypeScript config
│
├── server/                      # Elixir Phoenix API server
│   ├── lib/
│   │   ├── clippster_server/    # Domain logic (contexts)
│   │   │   ├── accounts/        # User authentication schemas
│   │   │   ├── organizations/   # Organization & member schemas
│   │   │   ├── campaigns/       # Campaign management
│   │   │   ├── social/          # Social media integration
│   │   │   ├── ai/              # AI service integrations
│   │   │   ├── subscriptions/   # Subscription management
│   │   │   ├── messaging/       # In-app messaging
│   │   │   ├── analytics/       # Analytics tracking
│   │   │   ├── application.ex   # OTP application startup
│   │   │   ├── repo.ex          # Ecto repository
│   │   │   └── [context].ex     # Context module files
│   │   └── clippster_server_web/# HTTP & WebSocket layer
│   │       ├── controllers/     # HTTP endpoint handlers
│   │       ├── plugs/           # Middleware (auth, admin, CORS)
│   │       ├── router.ex        # Route definitions
│   │       ├── messaging_channel.ex  # WebSocket channel
│   │       ├── progress_channel.ex   # Build progress channel
│   │       └── endpoint.ex      # Phoenix endpoint config
│   ├── priv/
│   │   ├── repo/migrations/     # Database migrations
│   │   └── gettext/             # Internationalization strings
│   ├── test/                    # Test files
│   ├── config/                  # Mix configuration
│   ├── mix.exs                  # Mix dependencies
│   └── _build/                  # Build artifacts (generated)
│
├── landing/                     # React landing page
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── context/             # React context (state)
│   │   ├── hooks/               # Custom React hooks
│   │   └── App.tsx
│   └── package.json
│
├── scripts/                     # Build and utility scripts
│   └── setup-binaries.mjs       # Tauri binary setup
│
├── docs/                        # Documentation
│
├── .planning/                   # GSD planning documents
│   ├── codebase/                # Codebase analysis (this dir)
│   ├── phases/                  # Implementation phases
│   └── ...
│
├── .husky/                      # Git hooks (Prettier)
├── .github/                     # GitHub workflows
├── package.json                 # Monorepo root scripts
├── .prettierrc                  # Code formatting config
└── README.md
```

## Directory Purposes

**`client/src/components/`:**
- Purpose: Reusable Vue 3 SFC (Single File Component) library
- Contains: UI components (Button, Input, Dialog, Card), feature components (ClipEditorDialog, ProjectDialog), layout components (TitleBar, DashboardSidebar)
- Key files: `clip-editor/` (editor UI), `organization/` (org management UI), `ui/` (primitive components), `messaging/` (chat UI)
- Subdirectories: `clip-editor/` (14 components for video editing interface), `organization/` (org dashboard pages), `ui/` (Radix Vue + Reka UI based primitives)

**`client/src/composables/`:**
- Purpose: Reusable reactive logic hooks following Vue 3 Composition API patterns
- Contains: Hooks for media operations (audio/video), livestream monitoring, state management, timeline interactions
- Key files: `useAudioMixer.ts` (audio track mixing), `useLivestreamViewer.ts` (HLS playback + monitoring), `useTimelineRenderer.ts` (timeline visualization), `clip-editor/` (40+ clip editor specific hooks)
- Subdirectories: `clip-editor/` (hooks for clip editor: playhead, zoom, tool state, selection, preview)

**`client/src/services/`:**
- Purpose: API integration, external service clients, and business logic utilities
- Contains: API clients for backend endpoints, socket handlers for WebSocket, file operations, integration with external platforms
- Key files: `api.ts` (base Axios instance), `campaignApi.ts` (campaign endpoints), `socialAccountsApi.ts` (social platform auth/publish), `messagingSocket.ts` (WebSocket connection)
- Subdirectories: `database/` (SQLite CRUD layer with 35+ table operations), `commands/` (clip editor command pattern for undo/redo)

**`client/src/services/database/`:**
- Purpose: SQLite database access layer, bridging Tauri SQL plugin to app logic
- Contains: CRUD operations for all local entities (projects, clips, media, transcripts, settings)
- Key files: `core.ts` (database initialization, user context), `clips.ts`, `projects.ts`, `transcripts.ts`, `video-editor-edits.ts`, `livestream-monitoring.ts`
- Pattern: Each file exports functions like `createClip()`, `getClipsByProjectId()`, `updateClip()`, `deleteClip()`

**`client/src/stores/`:**
- Purpose: Global state management using Pinia
- Contains: State, getters, actions for auth, livestream, messaging, organization, permissions
- Key files: `auth.js` (user + token + organization), `livestream.ts` (stream monitoring state), `messaging.ts` (chat messages), `platform.ts` (OS detection)
- Pattern: Each store uses Pinia `defineStore()` with `state()`, `getters`, `actions`

**`client/src/pages/`:**
- Purpose: Top-level route components (one per main page)
- Contains: Full-page components that render content for specific routes
- Key files: `VideoEditor.vue` (project list + editor), `Projects.vue`, `Clips.vue`, `LiveClip.vue`, `CampaignsPage.vue`
- Structure: Each page typically includes nested child components from `components/` and uses composables

**`client/src/layouts/`:**
- Purpose: Page wrapper layouts providing navigation and common UI
- Contains: DashboardLayout (sidebar + header), minimal layout variants
- Key file: `DashboardLayout.vue` (main app container with sidebar, used by most routes)

**`client/src/types/`:**
- Purpose: TypeScript type definitions
- Contains: Shared interfaces, type aliases for domain models
- Key files: Type definitions for Clip, Project, User, Organization (mirroring backend schemas)

**`client/src/router/`:**
- Purpose: Vue Router configuration defining all app routes
- Key file: `router/index.ts` (route definitions with lazy-loaded page components)
- Pattern: Routes organized by feature (projects, clips, video-editor, organizations, etc.)

**`server/lib/clippster_server/`:**
- Purpose: Business logic organized by domain (DDD - Domain Driven Design)
- Contains: Context modules (one per domain) that group related CRUD and business logic
- Key directories:
  - `accounts/` → User authentication, email verification, password reset
  - `organizations/` → Org creation, member management, credits
  - `campaigns/` → Campaign creation, submission management, scoring
  - `social/` → Social platform auth, analytics sync, post publishing
  - `subscriptions/` → Stripe integration, tier management, renewals
  - `ai/` → AI API integrations (OpenRouter, LemonFox Whisper, ElevenLabs)
  - `analytics/` → Event tracking, analytics aggregation

**`server/lib/clippster_server_web/controllers/`:**
- Purpose: HTTP request handlers
- Contains: 40+ controllers, one per resource type
- Key files: `auth_controller.ex` (login/signup), `clips_controller.ex` (clip CRUD), `campaigns_controller.ex`, `organization_controller.ex`, `social_accounts_controller.ex`
- Pattern: Each controller has `create`, `show`, `update`, `delete`, `list` actions

**`server/lib/clippster_server_web/`:**
- Purpose: Web interface layer (HTTP + WebSocket)
- Contains:
  - `router.ex` → Pipeline definitions, scope blocks, route list
  - `endpoint.ex` → Phoenix endpoint config (plug middleware, socket handler)
  - `plugs/` → Custom middleware (`AuthPlug.ex`, `AdminPlug.ex`, CORS)
  - `messaging_channel.ex` → WebSocket channel for in-app chat
  - `progress_channel.ex` → WebSocket channel for build progress updates

**`server/priv/repo/migrations/`:**
- Purpose: Database schema version history
- Contains: Timestamped Ecto migration files
- Pattern: Each file defines schema changes (create_table, add_column, create_index)

**`client/src-tauri/src/`:**
- Purpose: Rust backend for Tauri desktop app
- Contains: Native operations (file I/O, system calls), FFmpeg integration for video encoding
- Handles: Desktop-specific functionality that Vue cannot access

**`client/src-tauri/migrations/`:**
- Purpose: SQLite schema initialization
- Contains: Initial schema definition for local database

**`scripts/`:**
- Purpose: Build automation and utilities
- Key file: `setup-binaries.mjs` (downloads FFmpeg and other binaries for CI/CD)

## Key File Locations

**Entry Points:**

- `client/src/main.ts`: Vue 3 app initialization, Pinia setup, router mount
- `server/lib/clippster_server/application.ex`: OTP supervision tree, worker startup
- `client/src/App.vue`: Root Vue component wrapping all routes

**Configuration:**

- `client/vite.config.ts`: Build tool config (Vite + Vue plugin)
- `server/config/config.exs`: Elixir application config
- `client/tsconfig.json`: TypeScript compiler options
- `.prettierrc`: Code formatting rules (monorepo-wide)

**Core Logic:**

- `client/src/services/api.ts`: Base HTTP client setup with error handling
- `server/lib/clippster_server/organizations.ex`: Organization domain logic (400+ lines)
- `server/lib/clippster_server/campaigns.ex`: Campaign domain logic (600+ lines)
- `client/src/composables/useTimelineRenderer.ts`: Timeline visualization
- `client/src/composables/useLivestreamViewer.ts`: Livestream playback + monitoring

**Testing:**

- `server/test/`: Elixir tests for contexts and controllers
- No dedicated client test directory; tests co-located conceptually (not yet implemented)

**Database:**

- `server/priv/repo/migrations/`: All schema changes (50+ migrations)
- `client/src/services/database/types.ts`: TypeScript interfaces for SQLite tables

## Naming Conventions

**Files:**

- **Vue components**: PascalCase.vue (e.g., `ClipEditorDialog.vue`, `DashboardLayout.vue`)
- **Composables**: camelCase with `use` prefix, e.g., `useTimelineRenderer.ts`, `useLivestreamViewer.ts`
- **Services**: camelCase, usually API-named (e.g., `campaignApi.ts`, `socialAccountsApi.ts`)
- **Database modules**: kebab-case, table-based (e.g., `clip-detection.ts`, `organization-assets.ts`)
- **Elixir modules**: snake_case.ex files, CamelCase module names (e.g., `organizations.ex` contains `ClippsterServer.Organizations`)
- **Migrations**: Timestamp + snake_case description (e.g., `20260115190334_create_promo_codes.exs`)

**Directories:**

- **Feature directories**: kebab-case (e.g., `clip-editor/`, `organization/`, `video-editor/`)
- **Layer directories**: snake_case or descriptive (e.g., `services/`, `stores/`, `composables/`)
- **Elixir contexts**: plural kebab-case mirroring module name (e.g., `organizations/` → `ClippsterServer.Organizations`)

**Functions/Variables:**

- **Client**: camelCase for functions, variables, constants
- **Server**: snake_case for Elixir functions, PascalCase for module/struct names

## Where to Add New Code

**New Feature (e.g., New Content Type):**

1. **Backend:**
   - Create new context module: `server/lib/clippster_server/[feature]/`
   - Define schema: `server/lib/clippster_server/[feature]/[model].ex`
   - Implement CRUD: `server/lib/clippster_server/[feature].ex`
   - Add controller: `server/lib/clippster_server_web/controllers/[feature]_controller.ex`
   - Add routes: `server/lib/clippster_server_web/router.ex` (in appropriate pipeline scope)
   - Add migration: `server/priv/repo/migrations/[timestamp]_[description].exs`

2. **Frontend:**
   - Add API client: `client/src/services/[feature]Api.ts`
   - Add page: `client/src/pages/[Feature].vue`
   - Add route: `client/src/router/index.ts`
   - Add store if needed: `client/src/stores/[feature].ts`
   - Add database layer if local storage needed: `client/src/services/database/[feature].ts`

**New Component:**

- Location: `client/src/components/[feature]/[ComponentName].vue`
- If reusable across features: `client/src/components/ui/[ComponentName].vue`
- Always use:
  - `<script setup lang="ts">` with TypeScript
  - Scoped styles with component prefix
  - Props and emits explicitly typed

**New Composable:**

- Location: `client/src/composables/use[FeatureName].ts`
- If clip-editor specific: `client/src/composables/clip-editor/use[FeatureName].ts`
- Pattern:
  ```typescript
  export function use[Feature]() {
    const state = ref(initialValue);
    const action = () => { /* reactive updates */ };
    return { state, action };
  }
  ```

**New Database Operation (Client):**

- Location: `client/src/services/database/[table-name].ts`
- Pattern:
  ```typescript
  export async function create[Entity](data: CreateParams): Promise<[Entity]>;
  export async function get[Entity]ById(id: number): Promise<[Entity]>;
  export async function update[Entity](id: number, data: UpdateParams): Promise<void>;
  export async function delete[Entity](id: number): Promise<void>;
  ```

**New Store:**

- Location: `client/src/stores/[feature].ts`
- Pattern: Use Pinia `defineStore()` with `state()`, `getters`, `actions`

**New Utility:**

- Shared helpers: `client/src/utils/[feature].ts`
- Formatters/validators: `client/src/utils/[category].ts`
- Type helpers: `client/src/types/helpers.ts`

## Special Directories

**`client/src-tauri/`:**
- Purpose: Rust/Tauri native backend
- Generated: Yes (Tauri generates parts of this)
- Committed: Yes (source code committed, build artifacts in .gitignore)

**`server/_build/`:**
- Purpose: Elixir build artifacts
- Generated: Yes (Mix creates on `mix compile`)
- Committed: No (.gitignore)

**`client/dist/`:**
- Purpose: Built Vue app output
- Generated: Yes (`vite build`)
- Committed: No (.gitignore)

**`.planning/codebase/`:**
- Purpose: GSD analysis documents
- Generated: No (manually created by analysis agent)
- Committed: Yes (tracked in version control for team reference)

**`server/deps/`:**
- Purpose: Elixir dependencies
- Generated: Yes (`mix deps.get`)
- Committed: No (.gitignore), use lock file (mix.lock)

**`client/node_modules/`:**
- Purpose: JavaScript dependencies
- Generated: Yes (`yarn install`)
- Committed: No (.gitignore), use lock file (yarn.lock)

---

*Structure analysis: 2026-01-27*
