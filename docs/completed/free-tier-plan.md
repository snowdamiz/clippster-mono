# Free Tier Plan

Implement a free tier for new accounts with daily-resetting limits (60 AI credits, 5 clip builds, 1 editor export, 2 VOD downloads), a mandatory admin-configured watermark + outro burned into all output, and the AI Video Creator fully restricted.

---

## Current State

- **New accounts** get 60 free credits once (`accounts.ex` lines 97-98, 149-150, 308-309) — never resets
- **Credits** are server-side in Postgres (`user_credits` table), managed by `Credits` context
- **Subscription gate** (`useSubscriptionGate.ts`) blocks features for users without active subscriptions
- **Clip builds** initiated via `build_clip_from_segments` Tauri command from `Projects.vue`
- **Editor exports** go through `RendererManager.exportProject()` → `export_video_editor_project` Tauri command
- **VOD downloads** go through `useDownloads.ts` → `download_kick_vod` / `download_twitch_vod` Tauri commands
- **AI Video Creator** at `/ai-video` → `AIVideoCreator.vue` — currently gated by subscription
- **Watermark system** exists in creator profiles (`ProfileDialog.vue`) with per-ratio position/scale/opacity
- **Admin settings** page (`AdminSettings.vue`) currently has feature flags only

---

## Design Decisions

| Decision | Choice |
|---|---|
| Action limit storage | **Client-side SQLite** — resets at midnight EST daily |
| Credit limit storage | **Server-side** (credits already in Postgres) — daily reset via API call or on-demand check |
| Stacking | **No stacking** — at midnight EST, replenish only what was used (e.g., used 5 of 60 credits → add 5 back to 60) |
| Free tier detection | `subscription_status === 'none'` and not admin/org-created |
| Watermark + outro config | Admin panel, same UI as creator profile `ProfileDialog.vue` |
| Watermark storage | Server-side `app_settings` table (fetched once, cached locally) |
| AI Video Creator | **Completely blocked** for free tier |
| AI detection credits | **60 credits daily** (not 0) — free tier users CAN use AI detection within their daily credit allowance |

---

## Phase 1: Free Tier Usage Tracking

### 1A. Client-side: New SQLite table `free_tier_usage`

Tracks clip builds, editor exports, and VOD downloads.

```sql
CREATE TABLE IF NOT EXISTS free_tier_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  action_type TEXT NOT NULL,  -- 'clip_build' | 'editor_export' | 'vod_download'
  used_at TEXT NOT NULL,
  reset_date TEXT NOT NULL     -- YYYY-MM-DD in EST
);
```

### 1B. Server-side: Daily credit reset for free tier

Credits live in Postgres (`user_credits.hours_remaining`). The daily reset logic:

- **On `GET /credits/balance`**: If user is free tier, check if credits need resetting:
  - Store `free_tier_last_reset_date` on the user record (new column) or in `app_settings`
  - If `last_reset_date` < today (EST), calculate `credits_used = 60 - hours_remaining`, replenish `min(credits_used, 60)` back to cap at 60, update `last_reset_date`
  - This is lazy/on-demand — no cron job needed
- **Keep the initial 60-credit grant** in `accounts.ex` for new accounts (it seeds the starting balance)
- **Cap**: Credits can never exceed 60 for free tier users (prevents accumulation from other sources)

### 1C. New composable: `useFreeTierLimits.ts`

- **`isFreeTier`** — computed: true when user has no subscription, not admin, not org-created
- **`getUsageToday(actionType)`** — count SQLite rows where `reset_date` = today (EST)
- **`canPerformAction(actionType)`** — checks count < limit
- **`recordUsage(actionType)`** — inserts a row
- **`resetIfNewDay()`** — deletes rows with `reset_date` < today (EST), called on app startup
- **Limits**: `{ clip_build: 5, editor_export: 1, vod_download: 2 }`
- Exposes remaining counts as reactive refs

### 1D. Integrate gates into existing flows

| Flow | File | Integration Point |
|---|---|---|
| Clip build | `Projects.vue` → `onFolderBuildClip()` | Check `canPerformAction('clip_build')` before `invoke('build_clip_from_segments')`, record on success |
| Editor export | `ExportButton.vue` → export handler | Check `canPerformAction('editor_export')` before export, record on success |
| VOD download | `StreamVods.vue` → `handleDownloadClip()` / download flow | Check `canPerformAction('vod_download')` before `startDownload()`, record on success |
| AI Video Creator | `AIVideoCreator.vue` or router guard | **Completely block** — show "Premium only" message + button to `/pricing` |

When limit is reached → show `FreeTierLimitDialog` with reset time and upgrade CTA.

### 1E. Premium-only pages (blocked entirely for free tier)

These routes show a full-page "Premium Only" message with an "Upgrade" button → `/pricing`. Implemented via a **router guard** that checks `isFreeTier` and a reusable `PremiumOnlyPage.vue` component.

| Route | Page | File |
|---|---|---|
| `/ai-video` | AI Video Creator | `AIVideoCreator.vue` |
| `/campaigns` | Campaigns Marketplace | `CampaignsPage.vue` |
| `/clipper-profile` | Clipper Profile (view/create) | `ClipperProfilePage.vue` |
| `/clipper-profile/edit` | Clipper Profile Edit | `ClipperProfileEditPage.vue` |
| `/clippers` | Clipper Directory | `ClipperDirectoryPage.vue` |
| `/clippers/leaderboard` | Leaderboard | `ClipperLeaderboardPage.vue` |
| `/clippers/:slug` | Public Clipper Profile | `ClipperPublicProfilePage.vue` |
| `/messages` | Messaging | `Messages.vue` |
| `/calendar` | Content Calendar | `ContentCalendar.vue` |
| `/assets` | Assets | `Assets.vue` |
| `/prompts` | Prompts | `Prompts.vue` |

**Implementation**: Add `meta: { requiresPremium: true }` to these routes in `router/index.ts`, then add a `beforeEach` guard that redirects free tier users to a `/premium-required` route (or renders `PremiumOnlyPage.vue` inline).

### 1F. Free tier feature restrictions (within allowed pages)

These features are **visible but locked** — show "Premium only" badge/overlay with upgrade CTA:

| Feature | File | Restriction |
|---|---|---|
| Creator profile watermark/intro/outro | `ProfileDialog.vue` → "Default Assets" section | Disable watermark, intro, outro selectors; show "Premium" lock overlay |
| Build dialog add-ons | `ClipBuildSettingsDialog.vue` → "Add-ons" step (intro/outro) | Hide/skip the "Add-ons" step entirely; force `intro: null, outro: null` |
| Build dialog watermark | `ClipBuildSettingsDialog.vue` → `watermarkSettings` prop | Pass `null` watermark; admin free-tier watermark is injected automatically instead |
| Video Editor (OpenCut) | `ExportButton.vue` / editor route | Allowed to use editor, but export is rate-limited (1/day) |

### 1G. Keep free features

- **Livestream watching** — no gate changes
- **Manual clipping** (creating clips without AI) — free, only *building* counts against limit
- **AI detection** — allowed within 60 daily credits
- **Creator profiles** — can create/edit profiles, but watermark/intro/outro asset config is locked

---

## Phase 2: Admin Watermark & Outro Configuration

### 2A. Server: `app_settings` entries

- `free_tier_watermark_image_url` — URL to watermark image (R2/S3)
- `free_tier_watermark_settings` — JSON with per-ratio position/scale/opacity (same format as creator profile)
- `free_tier_outro_video_url` — URL to outro video
- `free_tier_outro_duration` — duration in seconds

### 2B. Server: API endpoints

- `GET /api/settings/free-tier-branding` — public, returns watermark + outro config
- `PUT /api/admin/settings/free-tier-branding` — admin-only, updates config
- `POST /api/admin/settings/free-tier-branding/upload` — admin-only, uploads assets to R2

### 2C. Admin UI: New section in `AdminSettings.vue`

Below existing feature flags:
- **Watermark image** picker (upload + preview)
- **Watermark position** per aspect ratio (reuse `WatermarkPositionPicker`)
- **Outro video** picker (upload + preview)
- Same patterns as `ProfileDialog.vue` asset section

### 2D. Client: `useFreeTierBranding.ts`

- Fetches branding config on app startup, caches in memory + localStorage
- Downloads watermark image and outro video to local temp files for FFmpeg
- Exposes `watermarkSettings`, `outroSettings`, `isConfigured`

---

## Phase 3: Burn Watermark & Outro into Free Tier Output

### 3A. Clip builds (`build_clip_from_segments`)

In `Projects.vue`, when `isFreeTier`:
- Pass free-tier watermark as `clip_watermarks` param → existing `ClipWatermarkSettings` + `build_clip_watermark_overlay_filter` handles it (no Rust changes)
- Pass outro as `outro_path` / `outro_duration` (already supported by orchestrator)

### 3B. Editor exports (`export_video_editor_project`)

In `RendererManager.exportProject()`, when free tier:
- Inject watermark into `branding_watermark` field of `TauriExportConfig`
- Inject outro into `outro_path` / `outro_duration`
- Already handled by `video_editor_export.rs` — no Rust changes

### 3C. VOD downloads

In `useDownloads.ts` → `startDownload()`, when free tier:
- Pass watermark via `creatorWatermarkSettings` parameter
- For outro: add post-download FFmpeg step via new Tauri command

### 3D. New Rust command for VOD post-processing

```rust
#[tauri::command]
pub async fn apply_free_tier_branding(
    app: tauri::AppHandle,
    input_path: String,
    output_path: String,
    watermark_path: Option<String>,
    watermark_settings: Option<String>,  // JSON
    outro_path: Option<String>,
    outro_duration: Option<f64>,
) -> Result<(), String>
```

FFmpeg overlay watermark + concatenate outro onto downloaded VOD.

---

## Phase 4: UI Polish

### 4A. Free tier indicator
- "Free" badge in sidebar/header
- Remaining daily limits widget (e.g., "3/5 clips · 58/60 credits")

### 4B. `FreeTierLimitDialog.vue`
- Shows which limit was hit, reset time (midnight EST), upgrade CTA
- Consistent with `SubscriptionGate.vue` styling

### 4C. AI Video Creator block
- Route guard or component-level check in `AIVideoCreator.vue`
- Shows "Upgrade to access AI Video Creator" with pricing CTA

### 4D. Subscription flow
- New accounts see pricing page → subscribe or skip to free tier
- "Skip" = no subscription, user enters as free tier
- Existing `/pricing` page for later upgrades

---

## Files to Modify

### Server (Elixir)
- `server/lib/clippster_server/credits.ex` — add free-tier daily reset logic (lazy, on balance check)
- `server/lib/clippster_server_web/controllers/payment_controller.ex` — integrate reset into `get_balance`
- `server/lib/clippster_server_web/controllers/settings_controller.ex` — new free-tier branding endpoints
- `server/lib/clippster_server_web/router.ex` — add routes
- `server/priv/repo/migrations/` — add `free_tier_last_reset_date` column to users table

### Client (TypeScript/Vue)
- **New**: `client/src/composables/useFreeTierLimits.ts` — action usage tracking + `isFreeTier` computed
- **New**: `client/src/composables/useFreeTierBranding.ts` — branding config fetch/cache
- **New**: `client/src/components/PremiumOnlyPage.vue` — full-page "Premium Only" block with upgrade CTA
- **New**: `client/src/components/FreeTierLimitDialog.vue` — limit reached dialog
- **New**: `client/src/services/database/free-tier-usage.ts` — SQLite operations
- `client/src/router/index.ts` — add `meta: { requiresPremium: true }` to 11 routes + `beforeEach` guard
- `client/src/pages/Projects.vue` — gate clip builds, pass null watermark for free tier
- `client/src/editor/components/ExportButton.vue` — gate editor exports (1/day)
- `client/src/editor/core/managers/renderer-manager.ts` — inject admin watermark/outro for free tier
- `client/src/pages/StreamVods.vue` — gate VOD downloads (2/day)
- `client/src/composables/useDownloads.ts` — inject watermark for free tier downloads
- `client/src/pages/admin/AdminSettings.vue` — add free-tier branding section
- `client/src/composables/useSubscriptionGate.ts` — add free-tier awareness
- `client/src/components/SubscriptionGate.vue` — update messaging
- `client/src/components/ProfileDialog.vue` — disable watermark/intro/outro selectors for free tier, show "Premium" lock
- `client/src/components/ClipBuildSettingsDialog.vue` — hide "Add-ons" step for free tier, strip watermark settings

### Client (Rust/Tauri) — potentially
- `client/src-tauri/src/downloads.rs` or new file — `apply_free_tier_branding` command
- `client/src-tauri/src/lib.rs` — register new command

---

## Implementation Order

1. **Phase 1B**: Server-side daily credit reset (migration + lazy reset in `get_balance`)
2. **Phase 1A + 1C**: SQLite table + `useFreeTierLimits` composable
3. **Phase 1D**: Integrate gates into clip build, export, download, AI video flows
4. **Phase 2A-2B**: Server endpoints for free-tier branding config
5. **Phase 2C**: Admin UI for watermark/outro configuration
6. **Phase 2D**: Client-side branding fetch/cache
7. **Phase 3A-3C**: Inject watermark + outro into all output paths
8. **Phase 3D**: New Rust command for VOD post-processing
9. **Phase 4**: UI polish (badges, limit dialog, AI video block, subscription flow)
10. **Phase 1E**: Verify livestream/manual clip remain free (testing)
