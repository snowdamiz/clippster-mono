# Post For Me Migration Plan (Clippster)

## Goal
Replace direct X (Twitter) and Instagram integrations with Post For Me SaaS for auth, publishing, scheduling, and analytics, while making **all supported social platforms** connectable through one integration layer.

Base docs researched: https://api.postforme.dev/docs

## What Post For Me Provides (Research Summary)
From the docs/OpenAPI surface, the key endpoints for our migration are:

- `POST /v1/social-accounts/auth-url` (provider auth URL generation)
- `GET /v1/social-accounts` (list connected accounts)
- `DELETE /v1/social-accounts/{id}/disconnect` (disconnect)
- `POST /v1/media/create-upload-url` (media upload handoff)
- `POST /v1/social-posts` (create/schedule posts)
- `GET /v1/social-posts/{id}` (post status)
- `GET /v1/social-post-results` and `GET /v1/social-post-results/{id}` (per-account result state)
- `GET /v1/social-account-feeds/{social_account_id}` (feed/metrics)
- `POST /v1/webhooks` + related webhook endpoints (event delivery)

Documented supported platforms include:
`facebook`, `instagram`, `x`, `tiktok`, `youtube`, `pinterest`, `linkedin`, `bluesky`, `threads`, `tiktok_business`.

## Current Codebase Findings (Why This Is Needed)
Current implementation is provider-specific and duplicated across org/user flows.

Backend hotspots:
- Platform abstraction and provider modules:
  - `server/lib/clippster_server/social/platform.ex`
  - `server/lib/clippster_server/social/platforms/instagram.ex`
  - `server/lib/clippster_server/social/platforms/twitter.ex`
- Provider-specific auth controllers:
  - `server/lib/clippster_server_web/controllers/instagram_auth_controller.ex`
  - `server/lib/clippster_server_web/controllers/twitter_auth_controller.ex`
  - `server/lib/clippster_server_web/controllers/user_instagram_auth_controller.ex`
  - `server/lib/clippster_server_web/controllers/user_twitter_auth_controller.ex`
- Posting/sync/scheduling paths depend on direct platform handling:
  - `server/lib/clippster_server_web/controllers/post_submission_controller.ex`
  - `server/lib/clippster_server_web/controllers/user_posts_controller.ex`
  - `server/lib/clippster_server_web/controllers/scheduling_controller.ex`
- Workers built around direct API integration:
  - `server/lib/clippster_server/social/scheduled_post_worker.ex`
  - `server/lib/clippster_server/social/analytics_sync_worker.ex`
  - `server/lib/clippster_server/social/token_refresh_worker.ex`

Frontend hotspots:
- Separate IG/X publish and auth UX:
  - `client/src/components/InstagramPublishDialog.vue`
  - `client/src/components/TwitterPublishDialog.vue`
  - `client/src/services/userInstagramApi.ts`
  - `client/src/services/userTwitterApi.ts`
- Social UI is partly hardcoded to existing platforms:
  - `client/src/pages/organization/OrganizationSocial.vue`
  - `client/src/components/organization/SocialAccountsManager.vue`

Desktop (Tauri) hotspots:
- Provider-specific OAuth command flows in:
  - `client/src-tauri/src/auth.rs`

Schema constraints:
- Platform enums currently fixed to a small set in Ecto schemas (`social_account`, `post_submission`, etc.), which blocks adding all Post For Me platforms cleanly.

## Target Architecture

### 1) Single Provider Adapter Layer
Create `ClippsterServer.Social.Providers.PostForMe` as the primary integration boundary:
- Handles auth URL generation, account sync, media upload init, create/schedule post, fetch results, feed metrics.
- All controller/service layers call this adapter, not provider-specific modules.

### 2) Platform-Agnostic Domain Model
Refactor social account/post platform fields to be open-ended (string or normalized table) instead of compile-time enum lock-in.
- Keep a canonical internal platform key.
- Persist raw `provider_platform` from Post For Me for traceability.

### 3) Webhook-First Status/Analytics Sync
Use Post For Me webhooks for post/account/result updates.
- Keep polling as fallback for resilience.
- Reduce custom scheduled/token refresh complexity.

### 4) Backward-Compatible API to Frontend (Phase 1)
Keep existing frontend API contracts initially, but route backend internals through Post For Me.
- Enables safer incremental rollout.
- Later simplify frontend endpoints into generic `social/accounts`, `social/posts`, `social/results` APIs.

## Migration Plan (Phased)

## Phase 0: Safety + Feature Flag
1. Add `POST_FOR_ME_API_KEY` and `POST_FOR_ME_BASE_URL` config.
2. Add feature flag: `SOCIAL_PROVIDER_MODE=legacy|post_for_me|dual`.
3. In `dual`, write/observe both systems but read from legacy first.

Deliverable: deploy-safe toggle with zero behavior change.

## Phase 1: Backend Post For Me Client
1. Add HTTP client module for Post For Me endpoints.
2. Implement typed request/response mapping structs.
3. Add robust retry/error classification and rate-limit handling.
4. Instrument with telemetry + structured logs.

Deliverable: reliable client with unit tests (mocked HTTP).

## Phase 2: Data Model & Migrations
1. Add provider metadata fields:
   - `provider` (e.g., `post_for_me`)
   - `provider_account_id`
   - `provider_post_id`
   - `provider_payload` JSON
2. Relax or replace strict platform enums.
3. Backfill existing rows for X/Instagram to normalized platform keys.
4. Add indexes/uniqueness on provider IDs.

Deliverable: DB supports all platforms without schema redeploy for every new network.

## Phase 3: Auth/Account Connection Refactor
1. Replace direct Instagram/Twitter OAuth starts with Post For Me auth URL generation.
2. Add generic connect flow: choose platform -> request auth URL -> redirect.
3. On callback/webhook, upsert local social account records from Post For Me account data.
4. Keep legacy auth endpoints temporarily, internally delegating to generic flow.

Deliverable: one connect flow for all supported platforms.

## Phase 4: Posting/Scheduling Refactor
1. Replace direct post publish logic with `POST /v1/social-posts`.
2. Route media upload prep through `POST /v1/media/create-upload-url`.
3. Map scheduling to `scheduled_at` in Post For Me.
4. Persist returned provider post/result IDs for tracking.

Deliverable: org/user posting fully backed by Post For Me.

## Phase 5: Analytics/Result Ingestion
1. Register webhook endpoint in Clippster for social post/account/result events.
2. Verify webhook signatures (if provided by Post For Me).
3. Upsert post result state from webhook payloads.
4. Use `social-account-feeds` + `expand=metrics` for historical analytics sync and gap fill.

Deliverable: analytics and status from provider events, with polling fallback.

## Phase 6: Frontend/Tauri Consolidation
1. Replace IG/X specific dialogs with one generic publish/connect flow.
2. Update social account manager to render connect options from backend-supplied platform list.
3. Replace `userInstagramApi.ts`/`userTwitterApi.ts` with generic social API service.
4. Update Tauri auth commands to one provider-agnostic social auth entry.

Deliverable: UI supports all Post For Me platforms without per-platform client code.

## Phase 7: Cleanup + Decommission Legacy
1. Remove direct Twitter/Instagram secrets from runtime config.
2. Remove `twitter.ex`, `instagram.ex`, token refresh worker, and old auth controllers/routes after cutover stabilization.
3. Delete dead frontend provider-specific components/services.
4. Keep migration notes + fallback plan for one release cycle.

Deliverable: single integration stack, less maintenance overhead.

## API Mapping (Current -> Post For Me)
- Connect account (Instagram/Twitter auth endpoints) -> `POST /v1/social-accounts/auth-url`
- Internal social account sync -> `GET /v1/social-accounts`
- Disconnect account -> `DELETE /v1/social-accounts/{id}/disconnect`
- Publish/schedule post -> `POST /v1/social-posts`
- Upload media prep -> `POST /v1/media/create-upload-url`
- Post status/result sync -> `GET /v1/social-post-results` (+ webhook events)
- Analytics sync -> `GET /v1/social-account-feeds/{social_account_id}`

## Testing Strategy
1. Contract tests for Post For Me client request/response mapping.
2. Integration tests for auth connect, publish now, schedule, disconnect, webhook ingestion.
3. Migration/backfill tests for existing social accounts/posts.
4. End-to-end smoke tests per platform category (at least: x, instagram, linkedin, tiktok, youtube).
5. Rollout SLO checks: publish success %, webhook lag, metrics sync freshness.

## Rollout Strategy
1. Deploy with `legacy` mode.
2. Enable `dual` mode in staging; validate parity.
3. Canary `post_for_me` mode for a subset of orgs/users.
4. Full cutover after 7-day stability window.
5. Remove legacy code in following release.

## Risks + Mitigations
- Risk: Platform behavior differences (media limits/caption rules).
  - Mitigation: central capability matrix + preflight validation before submit.
- Risk: Webhook delivery delays/failures.
  - Mitigation: idempotent webhook handling + periodic reconciliation jobs.
- Risk: Data migration regressions.
  - Mitigation: reversible migrations + pre/post backfill audits.
- Risk: Existing frontend assumptions on platform enums.
  - Mitigation: backend compatibility layer first, frontend generic refactor second.

## Execution Order Recommendation
1. Backend client + feature flag.
2. Schema changes + backfill.
3. Auth and posting path swap.
4. Webhooks and analytics.
5. Frontend/Tauri genericization.
6. Legacy teardown.

## Immediate Next Actions
1. Implement `PostForMe` backend client and config wiring.
2. Draft DB migration replacing strict platform enums.
3. Add generic `POST /api/social/connect-url` backend endpoint backed by Post For Me auth URL API.
4. Wire one publish path (org posts) to Post For Me as pilot before user-level flows.
