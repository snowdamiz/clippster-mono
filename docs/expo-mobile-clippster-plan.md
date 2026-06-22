# Expo Mobile Clippster — Architecture & Implementation Plan

**Document version:** June 2026  
**Project:** clippster-mono mobile client (Expo / React Native)

---

## Executive summary (plain language)

Imagine Clippster is a **toy workshop** with three rooms:

1. **Your phone or computer** — where you cut and decorate videos (download, trim, add words on screen).
2. **The cloud clubhouse** (`api.clippster.app`) — where your **name badge** lives, your **team** hangs out, and robots **post videos** to social media for you.
3. **A paid locker** (cloud storage) — if you pay, your projects get copied into a locker so you can open the **same project** on phone *or* computer. Big raw video files stay on your pocket unless you choose to put them in the locker too.

**Phone app = small workshop.** You can download a streamer's long video, pick the funny parts, add subtitles and text stickers, let the **server robots** find highlights (AI), then **schedule a post**. You cannot do the giant pro editor (OpenCut timeline, livestream studio, Remotion) — that's the **big workshop** on desktop.

**What runs on the phone vs in the cloud:**

- **On phone (native, fast):** FFmpeg cutting/export, video playback, drawing subtitles on preview.
- **In cloud:** login, billing, AI transcribe/detect, PostForMe posting, org/campaign data, **yt-dlp** (because YouTube won't give phones a direct download link — we ask the server for help).

---

## Platform support matrix (VOD download vs AI clip detection)

Desktop today supports six streaming platforms: **YouTube, Kick, Twitch, Rumble, X (Twitter), PumpFun**.

Mobile splits this into two different capabilities.

### VOD download (needs server yt-dlp resolver per platform)

| Platform | Desktop today | Mobile launch (Phase 1) | Deferred | Notes |
|----------|---------------|---------------------------|----------|-------|
| **YouTube** | Yes | Yes | — | Channel browse + single-video URL |
| **Kick** | Yes | Yes | — | Channel slug / Kick URL |
| **Twitch** | Yes | Yes | — | Channel VOD list + VOD URL |
| **Rumble** | Yes | Yes | — | Same yt-dlp path as desktop |
| **X (Twitter)** | Yes | Yes | — | No user X login for downloads (yt-dlp only) |
| **PumpFun** | Yes | No | Phase 3+ | Desktop uses Node/LiveKit sidecar |
| **Manual import** | Yes | Yes | — | Camera roll / Files app; no yt-dlp needed |

**Download flow:** paste URL → server resolves stream with yt-dlp → phone downloads → FFmpeg remuxes to local MP4.

### AI clip detection & transcription (platform-agnostic)

Server APIs (`POST /api/clips/transcribe`, `/detect`, `/detect-chunked`) do **not** care which platform the video came from. They process uploaded audio/video chunks + transcript. **Any video file on the phone can be detected** as long as the user has credits.

| Video source | Mobile AI detect/transcribe | When |
|--------------|----------------------------|------|
| Downloaded VOD (YouTube/Kick/Twitch/etc.) | Yes | Phase 1 |
| Manual import (camera roll / file picker) | Yes | Phase 1 |
| Org shared clips (download from R2) | Yes | Phase 4 |
| Cloud-synced project with opt-in raw VOD on R2 | Yes | Phase 5 |
| **Livestream DVR / realtime detect** | **No** | Desktop-only |

**Simple rule:** If you can get a video file onto the phone, AI can find clips in it. Download support only controls *how* you get the file — not whether detection works.

---

## Aspect ratios & manual framing (mobile constraints)

### Export ratios: 16:9 and 9:16 only

Desktop supports 16:9, 9:16, 1:1, 4:5, and more. **Mobile exports only 16:9 (landscape) and 9:16 (portrait).** User can build one or both per clip.

### Manual framing (required — desktop parity)

Mobile must implement the Manual Framing Editor from `ManualPOIEditor.vue`:

- **Source panel** — draw crop regions on the source video (speaker, gameplay, etc.)
- **Target panel** — preview how regions compose into 16:9 or 9:16 output; position subtitles and text box on export frame
- **Segment timeline** — time-based framing changes mid-clip (`SegmentRegionConfig[]`)
- **Source frame modes** — Scale 16:9 / Use 16:9 with optional blur letterbox

Data stored as `ActiveVodPresetConfig` / `ManualFramingConfig` in `projects.active_vod_preset_config` — same JSON shape as desktop for cloud sync and FFmpeg export.

AI B-roll inside ManualPOIEditor is desktop-only for mobile v1.

---

## What the repo audit found

### Current state

| Area | Today | Mobile impact |
|------|-------|---------------|
| Clients | Tauri+Vue, Phoenix API, landing web | **No mobile app exists** |
| Product docs | Desktop-first; web hides editor | Mobile is **greenfield** |
| Local data | 92 SQLite migrations on desktop | Mobile needs **subset schema** via expo-sqlite |
| Cloud data | PostgreSQL + R2 for org assets, posts | **Reusable as-is** |
| Project sync | **Does not exist** | **New backend subsystem required** |
| VOD download | yt-dlp + FFmpeg in Rust (6 platforms) | yt-dlp **server-side**; FFmpeg **native on device** |
| Minimal editor | ProjectWorkspaceDialog — trim, subtitles, text | Replicate data model + touch UI |
| Clip export | Rust orchestrator → FFmpeg filter graphs | Port FFmpeg arg generation to shared TypeScript |
| PostForMe | Server-only provider | Mobile uses same scheduling API patterns |
| Auth | JWT, wallet/Google/email | SecureStore + deep links on mobile |

### In scope for mobile v1

- Download VODs (platform-limited initially)
- Minimal editing = ProjectWorkspace parity (segments, subtitles, text box)
- Server AI detection + transcription (existing credit APIs)
- PostForMe scheduling + analytics
- Clipper profiles, org clipping (shared clips, campaigns), schedule posting
- Local storage default; **hybrid paid cloud** (projects/edits sync; raw VOD opt-in upload)

### Explicitly out of scope for v1

- OpenCut full timeline editor
- Livestream DVR, streaming studio, PumpFun Node sidecar
- Remotion export sidecar
- Desktop admin panel
- Full parity with 90+ SQLite migrations

---

## Target architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     EXPO MOBILE APP                              │
│  React Native UI │ expo-sqlite │ Device storage │ ffmpeg-expo   │
│  Skia overlays   │ expo-video playback                          │
└────────────────────────────┬────────────────────────────────────┘
                             │ JWT REST + WebSocket
┌────────────────────────────┴────────────────────────────────────┐
│                     PHOENIX API (extended)                       │
│  PostgreSQL │ Cloudflare R2 │ yt-dlp resolver │ AI detect        │
│  PostForMe worker │ NEW: user cloud projects API                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────────┐
│                     TAURI DESKTOP (unchanged core)               │
│  Vue SPA │ SQLite full schema │ Rust FFmpeg + yt-dlp            │
│  NEW: cloud sync client (Phase 5)                                │
└─────────────────────────────────────────────────────────────────┘
```

**Cloud sync flow (Phase 5):**

1. Phone pushes project snapshot to API → stored in PostgreSQL
2. Phone optionally uploads raw VOD to R2 (opt-in)
3. Desktop pulls cloud projects → downloads missing media from R2 → merges into local SQLite

---

## Monorepo layout (proposed)

```
clippster-mono/
  apps/
    mobile/                    # NEW Expo app (dev client + EAS Build)
  packages/
    shared-types/              # SubtitleSettings, ClipTextBoxState, API DTOs
    api-client/                # Extracted from client services
    clip-export/               # FFmpeg arg builders
    sqlite-schema/             # Subset migrations shared mobile + Tauri sync
  client/                      # Tauri (add cloud sync consumer later)
  server/                      # Add cloud project + yt-dlp resolver routes
```

---

## Tech stack decisions

### UI — "shadcn for Expo"

**Recommendation:** React Native Reusables + NativeWind v4

- Same copy-paste ownership model as desktop Radix/shadcn stack
- Tailwind mental model matches existing client styling
- Alternative: gluestack-ui v2 for universal web + mobile later
- Navigation: Expo Router (file-based, deep links for OAuth)

### SQLite

**expo-sqlite** with a subset of desktop tables:

| Table group | Mobile needs |
|-------------|--------------|
| projects, raw_videos, clips, clip_versions, clip_segments | Core workspace |
| transcripts, transcript word storage | Subtitles + AI |
| clip_builds | Export history |
| creator_profiles (local) | Optional; org profiles from server |
| Skip | video_editor_*, livestream DVR, studio scenes |

### FFmpeg (native — required)

**ffmpeg-expo** via Expo config plugin.

- Requires Expo Dev Client / EAS Build — **not Expo Go**
- Handles: remux, clip concat, subtitle burn-in, text overlay composite, thumbnail, export for 16:9 and 9:16 only

### yt-dlp (server — not on device)

Python yt-dlp cannot ship inside iOS/Android apps reliably.

**New server endpoints** (e.g. `POST /api/media/resolve-url`):

1. Mobile sends platform URL + quality prefs
2. Server runs yt-dlp
3. Returns time-limited direct stream URL(s) + metadata
4. Mobile downloads via expo-file-system
5. FFmpeg remuxes to local MP4

**Phased rollout:** Phase 1 = YouTube, Kick, Twitch, Rumble, X + manual import. Phase 3+ = PumpFun only.

### AI detection

Existing server APIs (no mobile-specific backend):

- `POST /api/clips/transcribe`
- `POST /api/clips/detect` / `detect-chunked`
- WebSocket progress channel
- Credits via `GET /api/credits/balance`

Mobile flow: upload VOD (presigned R2) → server processes → WebSocket progress → write to local SQLite.

---

## What must run natively for performance

| Layer | Stay in JavaScript | Extract to native |
|-------|-------------------|-------------------|
| UI / forms / navigation | Yes | — |
| SQLite CRUD | Yes (expo-sqlite) | Only if profiling shows jank |
| API / auth | Yes | SecureStore wrapper |
| Video playback | expo-video orchestration | AVPlayer / ExoPlayer (already native) |
| Subtitle/text preview | Logic in JS | react-native-skia for 60fps overlays |
| Clip export / remux | FFmpeg arg strings in TS | ffmpeg-expo on native thread |
| Background downloads | Queue logic in JS | expo-file-system + task manager |
| Thumbnail generation | Trigger from JS | FFmpeg native frame extract |
| yt-dlp | — | **Server only** |

**Do NOT port Rust orchestrator to JS execution** — port only the command recipe (inputs/outputs JSON) and run via native FFmpeg.

---

## Hybrid cloud storage (biggest new backend work)

**Model:** projects + edits sync across devices; raw VOD upload is **opt-in**.

### Server additions (Phoenix)

New domain: `ClippsterServer.CloudProjects`

**PostgreSQL tables (conceptual):**

- `cloud_projects` — id, user_id, name, schema_version, device_updated_at
- `cloud_project_snapshots` — JSON blob (clips, segments, subtitle_settings, clip_text_overlay, transcript refs)
- `cloud_media_assets` — asset_type (raw_vod | built_clip | thumbnail), r2_key, size_bytes, upload_status
- `user_storage_quotas` — tier, bytes_used, bytes_limit

**R2 layout:** `users/{user_id}/projects/{project_id}/{asset_id}.mp4`

**API surface (new):**

- `GET/POST /api/cloud/projects`
- `GET/PUT /api/cloud/projects/:id` — fetch/push snapshot
- `POST /api/cloud/projects/:id/media/presigned-upload`
- `GET /api/cloud/projects/:id/media/:asset_id/presigned-download`
- `POST /api/cloud/projects/:id/sync` — delta sync

**Billing:** New storage subscription add-on with quota enforcement.

---

## Mobile feature modules

### 1. Auth & account
- Same JWT as desktop; `X-Client-Platform: mobile`
- Google OAuth via expo-auth-session; email login
- Server: add mobile deep-link origins to CORS

### 2. Download VODs
- Channel URL input → server resolve → download queue → local raw_videos row

### 3. Workspace editor (ProjectWorkspace parity)
- Project list (local + cloud badge)
- Video preview + simplified timeline (segment in/out handles)
- Subtitles sheet (preset picker + properties)
- Text box sheet (content, style, timing, position)

### 4. AI pipeline
- Presigned R2 upload → transcribe + detect → local SQLite

### 5. Build & export
- Shared clip-export package → native FFmpeg → clip_builds → local MP4

### 6. PostForMe + scheduling + analytics
- OAuth deep links; schedule/cancel posts; view post analytics

### 7. Profiles, orgs, campaigns
- Clipper profile CRUD; org shared clips inbox; campaign submit

---

## Phased delivery (recommended)

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| **0 — Foundation** | 4–6 weeks | Expo scaffold, auth, SQLite subset, UI kit |
| **1 — Download + AI** | 4–6 weeks | yt-dlp resolver (YT/Kick/Twitch), download queue, AI integration, playback |
| **2 — Minimal editor** | 6–8 weeks | Timeline trim, Skia overlays, properties sheets, FFmpeg export |
| **3 — Distribution** | 3–4 weeks | PostForMe OAuth, scheduling, analytics |
| **4 — Org & profiles** | 3–4 weeks | Clipper profiles, shared clips, campaigns |
| **5 — Cloud sync** | 6–10 weeks | Cloud projects API, mobile + desktop sync clients, storage billing |

**Total estimate: 26–38 weeks** for a small team (2–3 engineers). Phases 1–3 deliver a usable app without cloud sync.

---

## Implementation checklist

1. Create apps/mobile Expo project with Dev Client, EAS, Expo Router, NativeWind + React Native Reusables
2. Add packages/shared-types, api-client, sqlite-schema, clip-export
3. Implement expo-sqlite layer for projects, raw_videos, clips, segments, transcripts, clip_builds
4. Add Phoenix yt-dlp resolver — Phase 1 YouTube/Kick/Twitch/Rumble/X
5. Integrate ffmpeg-expo: remux, clip build, thumbnail, subtitle/text burn-in
6. Build mobile workspace: expo-video + Skia overlays, segment timeline, property sheets
7. Wire mobile AI flow: presigned upload, transcribe/detect APIs, progress WebSocket
8. PostForMe OAuth deep links, scheduling, analytics, built-clip upload
9. Clipper profiles, org shared clips, campaign submit
10. Design hybrid cloud projects API (PostgreSQL snapshots + R2 media manifest + quotas)
11. Mobile + Tauri sync clients with opt-in raw VOD upload and conflict handling
12. Cloud storage subscription tier and quota enforcement

---

## Key risks & mitigations

| Risk | Mitigation |
|------|------------|
| yt-dlp ToS / breakage | Server-side only; cache URLs briefly; monitor releases |
| iOS background download limits | Foreground download + iOS background URL session |
| FFmpeg binary size | LGPL build; strip codecs; Android ABI splits |
| Cloud sync conflicts | device_id + updated_at last-write-wins |
| Schema drift | Shared sqlite-schema version field on server |
| Export parity bugs | Golden tests: same JSON input → compare FFmpeg args |

---

## Success criteria (v1 launch)

- User logs in with same account as desktop
- Downloads a YouTube VOD, runs AI detect, trims a clip, sets manual framing for 9:16, adds subtitles + text box, exports 9:16 and/or 16:9 MP4
- Schedules post via PostForMe; sees analytics in app
- Creates/edits clipper profile; receives org shared clip; submits to campaign
- With cloud subscription: project edits appear on desktop after sync; raw VOD uploads only when opted in

---

*Generated from Clippster monorepo planning session — June 2026*
