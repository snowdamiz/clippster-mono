# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-04)

**Core value:** Content creators can generate, edit, and distribute short-form clips from long-form video with minimal manual effort

**Current focus:** Milestone v1.2 — Stripe to Paddle Migration

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-04 — Milestone v1.2 started

## Performance Metrics

**Velocity:**
- Total plans completed: 8
- Average duration: 2.4 minutes
- Total execution time: 0.44 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 2 | 5.6m | 2.8m |
| 02 | 2 | 5.5m | 2.8m |
| 03 | 2 | 3.6m | 1.8m |
| 04 | 2 | 6.4m | 3.2m |

**Recent Trend:**
- Last 5 plans: 03-01 (1.9m), 03-02 (1.7m), 04-01 (3.4m), 04-02 (3.0m)
- Trend: Stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- 01-01: Separate :twitter_oauth config from :twitter analytics config (keeps OAuth posting separate from twitterapi.io analytics)
- 01-01: Preserve existing analytics functions in Twitter module (maintains backwards compatibility)
- 01-01: Stub publish_media and get_insights for now (Phase 2/3 implementation)
- 01-02: Use refresh_token for X, access_token for Instagram in TokenRefreshWorker (X uses single-use rotation, Instagram refreshes via access_token)
- 01-02: Reduce TokenRefreshWorker interval from 12 hours to 1 hour (X tokens expire in 2 hours - hourly checks provide 1-hour buffer)
- 01-02: Redirect to /twitter-callback instead of /instagram-callback (Tauri app needs platform-specific callback paths)
- 02-01: Use 1MB chunks (not 5MB) for lower failure rates per X community recommendations
- 02-01: Poll STATUS synchronously with check_after_secs respect (not GenServer) for simpler request-scoped workflow
- 02-01: Skip FFmpeg codec validation for MVP - rely on X API processing validation
- 02-01: Use v2 endpoint exclusively (api.x.com/2/media/upload), not deprecated v1.1
- 02-02: 6-hour R2 presigned URL expiry for X processing delays
- 02-02: Return media_id only from publish_media (X separates upload from tweet creation)
- 03-01: Use get_user_profile/1 fallback to /i/ URL for post_url construction (more reliable URL generation even if profile API unavailable)
- 03-01: Enforce 280-char limit at schema level for Twitter (catches validation errors early in UX flow)
- 03-01: Support optional media_ids in create_tweet/3 (flexible API for text-only and media tweets)
- [Phase 04-01]: Track rate limits per-endpoint and per-social-account (not global) for accurate X API quota tracking
- [Phase 04-01]: Retry transient errors (429/5xx) with 60s max delay and 5min timeout; return permanent errors (400/401/403/404) immediately
- [Phase 04-02]: Two-stage content hashing (caption-only pre-check, caption+media final hash) prevents API quota waste on duplicate uploads
- [Phase 04-02]: 24-hour duplicate detection window balances catching duplicates vs allowing intentional reposts
- [Phase 04-02]: Per-account duplicate detection (not global) allows same content on different accounts
- [Phase 05]: Recreate app admin UX natively in landing React and wire to existing admin APIs — Removes iframe/Tauri runtime dependency in browser while preserving route/functionality parity

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-10
Stopped at: Completed 04-02-PLAN.md (Duplicate Detection & TwitterApiClient Integration)
Resume file: None
