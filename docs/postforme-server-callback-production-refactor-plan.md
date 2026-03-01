# PostForMe Unified Server Callback Refactor Plan (Production)

## 1. Objective

Refactor social account connection flows so **all PostForMe OAuth callbacks land on the Clippster backend first**, regardless of entry point:

1. PostForMe developer dashboard (first-time provider connect)
2. Tauri desktop app user connection flow
3. Landing/web app user connection flow

This removes dependence on `localhost` callback URLs and makes the flow production-safe.

## 2. Key Constraints and Decisions

### 2.1 PostForMe constraints (Quickstart)

1. Quickstart projects use a single project-level redirect URL.
2. This URL is also used when connecting providers from the PostForMe dashboard.
3. Per-request redirect overrides are White Label functionality.

### 2.2 Decision for this refactor

1. Configure PostForMe project callback to a backend endpoint:
  `https://<api-domain>/api/auth/postforme/callback`
2. Stop using `http://localhost:54325/postforme-callback` as the provider callback target.
3. Make Tauri completion asynchronous via backend status polling (or push), not local callback interception.

## 3. Current State (Code Map)

### 3.1 Tauri flow depends on local callback server

1. Starts local callback listener before opening PostForMe URL:
  `client/src-tauri/src/auth.rs` (`start_post_for_me_oauth`)
2. Expects callback on local route:
  `client/src-tauri/src/auth.rs` (`warp::path("postforme-callback")`)

### 3.2 Connect URL APIs can pass redirect override, but clients do not

1. Backend supports `redirect_url_override` in payload passed to PostForMe:
  `server/lib/clippster_server_web/controllers/clipper_profile_controller.ex`
   `server/lib/clippster_server_web/controllers/social_account_controller.ex`
2. Client connect calls currently do not send redirect override:
  `client/src/services/userInstagramApi.ts`
   `client/src/services/userTwitterApi.ts`
   `client/src/services/socialAccountsApi.ts`

### 3.3 Landing app still uses legacy provider-specific OAuth start

1. Popup flow points to `/api/auth/{platform}/start`:
  `landing/src/hooks/useOAuthPopup.ts`
2. OAuth popup callback page is web-only bridge for legacy auth:
  `landing/src/pages/auth/OAuthCallbackPage.tsx`

## 4. Target Architecture

## 4.1 Single callback ingress on backend

Create one PostForMe callback controller endpoint:

1. `GET /api/auth/postforme/callback`

Responsibilities:

1. Parse callback query parameters (support snake_case + camelCase variants)
2. Resolve the pending connection session
3. Persist callback payload + status
4. Trigger account sync/upsert path
5. Route completion behavior by initiator (dashboard/tauri/web)

## 4.2 Connection Session abstraction (required)

Add first-class connection session tracking to decouple browser callback from app runtime:

Fields (minimum):

1. `id` (UUID)
2. `scope` (`org` or `user`)
3. `organization_id` (nullable)
4. `user_id`
5. `platform`
6. `external_id` (sent to PostForMe)
7. `status` (`pending | callback_received | synced | failed | expired`)
8. `success` (bool nullable)
9. `callback_payload` (jsonb)
10. `error_message` (text nullable)
11. `return_mode` (`dashboard | tauri | web`)
12. `return_url` (nullable, sanitized/allowlisted for web)
13. timestamps + optional `expires_at`

## 4.3 Completion model by channel

### Dashboard (PostForMe portal bootstrap)

1. Callback lands on backend.
2. Backend stores result and renders final server HTML response (success/error).
3. No dependency on Tauri runtime or web popup messaging.

### Tauri

1. Tauri asks backend for connect URL and receives `{ auth_url, connection_id, external_id }`.
2. Tauri opens browser to `auth_url`.
3. PostForMe returns to backend callback.
4. Tauri polls backend connection status with `connection_id`.
5. On success, frontend calls existing complete-connect flow (or new finalize endpoint).

### Landing/Web

1. Web app asks backend for connect URL with `return_mode=web` and a safe `return_url`.
2. After callback and sync, backend redirects to `return_url` with lightweight result params
  or a short-lived `connection_id`.
3. Web app reads result and refreshes social account state.

## 5. API and Contract Changes

## 5.1 New/updated backend endpoints

1. `POST /api/social/connect-url` and `POST /api/user/social/connect-url`:
  return `connection_id` in addition to `auth_url` and `external_id`.
2. New:
  `GET /api/social/connect-status?connection_id=...`
   and `GET /api/user/social/connect-status?connection_id=...`
3. New callback ingress:
  `GET /api/auth/postforme/callback`
4. Optional simplification:
  `POST /api/social/finalize-connect` and `/api/user/social/finalize-connect`
   using `connection_id` only.

## 5.2 Backward compatibility

1. Keep current `complete-connect` payload shape during transition.
2. Support both:
  1. old client path using explicit `account_id/account_ids/external_id`
  2. new client path using `connection_id`

## 6. Detailed Implementation Plan

## Phase 0 - Infrastructure and Config

1. Configure PostForMe project callback to production API callback URL.
2. Add env vars:
  1. `POST_FOR_ME_CALLBACK_URL` (explicit callback endpoint)
  2. `POST_FOR_ME_PROJECT_ID` (optional verification guard)
  3. `POST_FOR_ME_CONNECT_SESSION_TTL_SECONDS`
3. Document staging and production callback URLs.

Files:

1. `server/config/runtime.exs`
2. `server/.env.example`
3. `docs/` deployment runbook update

## Phase 1 - Connection Session persistence

1. Add migration for connection sessions table.
2. Add schema + context module:
  1. create session
  2. mark callback received
  3. mark synced/failed
  4. query by `connection_id` and by `external_id`
3. Add cleanup job for expired sessions.

Files:

1. `server/priv/repo/migrations/*_create_post_for_me_connection_sessions.exs`
2. `server/lib/clippster_server/social/post_for_me_connection_session.ex`
3. `server/lib/clippster_server/social/post_for_me_connection_sessions.ex`

## Phase 2 - Server callback controller

1. Create controller:
  `PostForMeAuthController` with `callback/2`.
2. Parse both callback naming conventions:
  1. success: `success` or `isSuccess`
  2. account ids: `account_id`, `account_ids`, `accountIds`
  3. platform/provider: `platform` or `provider`
3. Resolve session using `external_id` or signed session token.
4. Update session status and store raw payload.
5. Trigger sync of social account(s) via existing provider list/upsert flow.
6. Render or redirect based on `return_mode`.

Files:

1. `server/lib/clippster_server_web/controllers/post_for_me_auth_controller.ex` (new)
2. `server/lib/clippster_server_web/router.ex`

## Phase 3 - Connect URL endpoints refactor

1. Update both connect-url endpoints to:
  1. create connection session first
  2. generate `external_id` that embeds session identity
  3. call PostForMe auth URL endpoint
  4. return `connection_id` to caller
2. Ensure callback URL passed to PostForMe is backend callback URL.
  Note: Quickstart uses project callback; keep field wiring compatible for future White Label.
3. Preserve existing response fields for compatibility.

Files:

1. `server/lib/clippster_server_web/controllers/clipper_profile_controller.ex`
2. `server/lib/clippster_server_web/controllers/social_account_controller.ex`
3. `server/lib/clippster_server/social/providers/post_for_me.ex` (if request payload changes)

## Phase 4 - Status and finalize endpoints

1. Implement status endpoint(s):
  response includes `status`, `success`, `error`, `account_ids`, `external_id`.
2. Add finalize endpoint or adapt existing complete-connect to accept `connection_id`.
3. Keep idempotent behavior for retries.

Files:

1. `server/lib/clippster_server_web/controllers/clipper_profile_controller.ex`
2. `server/lib/clippster_server_web/controllers/social_account_controller.ex`
3. `server/lib/clippster_server_web/router.ex`

## Phase 5 - Tauri app migration to server-first callback

1. Remove dependence on local PostForMe callback listener (`54325`) for connection completion.
2. `start_post_for_me_oauth` should only open URL.
3. Frontend services in `client/src/services/`*:
  1. read `connection_id` from connect-url response
  2. poll connect-status endpoint
  3. on success, finalize and update UI
4. Keep legacy fallback temporarily behind feature flag.

Files:

1. `client/src-tauri/src/auth.rs`
2. `client/src/services/userInstagramApi.ts`
3. `client/src/services/userTwitterApi.ts`
4. `client/src/services/socialAccountsApi.ts`

## Phase 6 - Landing/web app migration

1. Replace legacy `/auth/{platform}/start` popup flow in `useOAuthPopup` with PostForMe connect-url flow.
2. Add polling/finalization logic mirroring Tauri/web client behavior.
3. Keep `/oauth/callback` route only if needed for transitional web redirects; otherwise deprecate.
4. Update Org Social UI success/error messaging based on new connect-status.

Files:

1. `landing/src/hooks/useOAuthPopup.ts`
2. `landing/src/pages/dashboard/OrgSocial.tsx`
3. `landing/src/pages/auth/OAuthCallbackPage.tsx` (deprecate or repurpose)
4. `landing/src/services/socialAccountsApi.ts` (add generic PostForMe connect calls)

## Phase 7 - Dashboard bootstrap flow support

1. Ensure backend callback can handle “initiator unknown/dashboard” sessions gracefully.
2. For dashboard-first provider connect:
  1. store callback audit record
  2. show deterministic success/error HTML response
  3. avoid dependence on app session cookies.
3. Add admin support tool endpoint (optional) to inspect recent callback payloads.

Files:

1. `server/lib/clippster_server_web/controllers/post_for_me_auth_controller.ex`
2. optional admin controller + route

## Phase 8 - Cleanup and hardening

1. Remove obsolete local callback port assumptions from docs and code.
2. Remove temporary fallback paths when adoption is complete.
3. Add structured logging/telemetry for:
  1. connect-url creation
  2. callback receipt
  3. sync outcome
  4. client finalize outcome
4. Add alerting for callback failure rate spikes.

## 7. Security and Reliability Requirements

1. Validate callback origin assumptions and required params.
2. Use signed session identifiers or signed state embedded in `external_id`.
3. Sanitize and allowlist `return_url` for web mode using existing target normalization patterns.
4. Enforce callback idempotency by `external_id + account_id` tuple.
5. Add timeout/expiry behavior for abandoned sessions.
6. Never expose raw provider tokens to clients.

## 8. Test Plan

## 8.1 Backend tests

1. Unit tests for callback parser with camelCase + snake_case params.
2. Controller tests for callback success/failure routes by return mode.
3. Integration tests:
  1. connect-url creates session + external_id
  2. callback updates session
  3. status endpoint transitions correctly
  4. finalize upserts account records

## 8.2 Tauri tests

1. Service-level tests for connect-status polling behavior.
2. Manual E2E in packaged app (not only dev):
  1. start connect
  2. complete provider OAuth in browser
  3. confirm account appears without local callback listener

## 8.3 Landing/web tests

1. Popup flow success, error, cancellation cases.
2. Session expiry UX.
3. Cross-origin redirect validation and rejection tests.

## 9. Rollout Plan

## Stage A - Backend ready, clients unchanged

1. Deploy callback endpoint + session model + status endpoints.
2. Switch PostForMe project callback to backend URL in staging.
3. Run dashboard-first provider connect validation.

## Stage B - Client migrations

1. Enable new flow in Tauri behind feature flag.
2. Enable new flow in landing/web behind feature flag.
3. Compare success/failure rates to legacy flow.

## Stage C - Production cutover

1. Flip feature flags for all clients.
2. Monitor callback ingestion, sync failures, and median completion time.
3. Remove localhost callback dependency from Tauri auth flow.

## Stage D - Decommission legacy

1. Remove old PostForMe local callback code paths.
2. Remove deprecated web OAuth popup callback bridge if unused.

## 10. Rollback Strategy

1. Keep existing `complete-connect` payload mode active during cutover.
2. Keep feature flags to revert Tauri/web callers to previous behavior short-term.
3. Preserve legacy routes until callback/session flow is stable for at least one release cycle.

## 11. Definition of Done

1. PostForMe dashboard first-time provider connect succeeds with backend callback in staging and production.
2. Tauri connect works when no local callback server is running.
3. Landing/web connect works end-to-end with backend callback.
4. No dependency remains on `localhost:54325` as provider callback target.
5. Monitoring dashboards show stable callback success and account sync success rates.

## 12. Immediate Execution Checklist

1. Set PostForMe project callback URL to backend callback endpoint in staging.
2. Implement backend callback endpoint and session persistence.
3. Add `connection_id` to connect-url responses.
4. Implement connect-status endpoint.
5. Migrate Tauri services to poll status + finalize.
6. Migrate landing `useOAuthPopup` flow to same server-first PostForMe APIs.
7. Validate in staging across all three entry points before production cutover.

