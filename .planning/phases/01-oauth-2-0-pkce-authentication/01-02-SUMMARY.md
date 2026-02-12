---
phase: 01-oauth-2-0-pkce-authentication
plan: 02
subsystem: authentication
tags: [oauth, pkce, twitter, x-api, controllers, routes, token-refresh]
dependency-graph:
  requires:
    - X Platform module with OAuth 2.0 PKCE (Plan 01)
    - Phoenix router infrastructure
    - Social/Campaigns contexts
  provides:
    - Organization X OAuth flow endpoints
    - Personal X OAuth flow endpoints
    - Hourly token refresh for X accounts
  affects:
    - Tauri desktop app OAuth flow
    - TokenRefreshWorker for all platforms
tech-stack:
  added:
    - TwitterAuthController (org accounts)
    - UserTwitterAuthController (personal accounts)
    - Phoenix routes for X OAuth
  patterns:
    - PKCE code_verifier extraction from state
    - Single-use refresh token rotation support
    - Platform-aware token refresh logic
key-files:
  created:
    - server/lib/clippster_server_web/controllers/twitter_auth_controller.ex
    - server/lib/clippster_server_web/controllers/user_twitter_auth_controller.ex
  modified:
    - server/lib/clippster_server_web/router.ex
    - server/lib/clippster_server/social/token_refresh_worker.ex
decisions:
  - decision: "Use refresh_token for X, access_token for Instagram in TokenRefreshWorker"
    rationale: "X uses single-use refresh token rotation, Instagram refreshes via access_token - worker now handles both patterns automatically"
  - decision: "Reduce TokenRefreshWorker interval from 12 hours to 1 hour"
    rationale: "X tokens expire in 2 hours - hourly checks catch tokens at 50% lifetime, leaving 1-hour buffer; Instagram 60-day tokens unaffected"
  - decision: "Redirect to /twitter-callback instead of /instagram-callback"
    rationale: "Tauri app needs platform-specific callback paths to route OAuth results correctly"
metrics:
  duration: 187
  completed-date: 2026-02-10
---

# Phase 01 Plan 02: X OAuth Controllers and Token Refresh Summary

**One-liner:** Complete X OAuth flow with organization and personal controllers, Phoenix routes, and hourly token refresh supporting single-use refresh token rotation.

## What Was Built

Implemented the full X OAuth 2.0 PKCE flow for both organization and personal accounts, integrated with the Platform module from Plan 01. Users can now connect X accounts from the Tauri desktop app, and tokens are automatically refreshed hourly to maintain live connections despite X's 2-hour token expiry.

### Key Components

**TwitterAuthController** (`server/lib/clippster_server_web/controllers/twitter_auth_controller.ex`)
- Organization-level X OAuth flow following InstagramAuthController pattern exactly
- `start_oauth/2` - Verifies user is org admin, calls Twitter.authorize_url/1 (PKCE generation handled by Platform module), redirects to X
- `oauth_callback/2` - Receives code and state from X, decodes state to extract code_verifier, validates timestamp (10-minute expiry)
- `process_oauth_callback/5` - Exchanges code with code_verifier, fetches profile, creates/updates social_account with refresh_token
- Redirects to `http://localhost:{callback_port}/twitter-callback` with success/error params
- Helper functions: decode_state/1, redirect_with_success/3, redirect_with_error/3, calculate_expiry/1, format_error/1, has_unique_constraint_error?/1

**UserTwitterAuthController** (`server/lib/clippster_server_web/controllers/user_twitter_auth_controller.ex`)
- Personal-level X OAuth flow following UserInstagramAuthController pattern exactly
- `start_oauth/2` - Verifies auth token, calls Twitter.authorize_url/1, redirects to X
- `oauth_callback/2` - Receives code and state, extracts code_verifier, validates timestamp
- `process_oauth_callback/4` - Exchanges code, fetches profile, stores via Campaigns.create_social_account/2
- `create_or_update_account/2` - Checks for existing account, creates or updates (same logic as UserInstagramAuthController)
- Redirects to `http://localhost:{callback_port}/twitter-callback` with success/error params

**Phoenix Routes** (`server/lib/clippster_server_web/router.ex`)
- Added 4 routes in unprotected scope (lines 93-100, immediately after Instagram OAuth routes):
  - GET /api/auth/twitter/start (TwitterAuthController, :start_oauth)
  - GET /api/auth/twitter/callback (TwitterAuthController, :oauth_callback)
  - GET /api/auth/user-twitter/start (UserTwitterAuthController, :start_oauth)
  - GET /api/auth/user-twitter/callback (UserTwitterAuthController, :oauth_callback)
- No authenticated-scope routes needed (auth_token passed as query param to start_oauth)

**TokenRefreshWorker** (`server/lib/clippster_server/social/token_refresh_worker.ex`)
- Changed `@default_interval` from `:timer.hours(12)` to `:timer.hours(1)` (line 15)
- Added `get_token_for_refresh/1` private function (lines 112-126):
  - Checks if account has refresh_token_encrypted field populated
  - If yes: decrypts and returns refresh_token (for X's single-use rotation)
  - If no: returns access_token (for Instagram's refresh-via-access-token pattern)
  - Handles both {:ok, token} and raw token return types from TokenEncryption.decrypt/1
- Updated `refresh_account_tokens/1` to use token_for_refresh instead of hardcoded access_token
- Updated `init/1` logging to show "minutes" for intervals < 1 hour (lines 48-52)

## Deviations from Plan

### Auto-fixed Issues

None - plan executed exactly as written.

## Technical Details

### PKCE Code Verifier Flow

The PKCE code_verifier is generated in the Platform module's `authorize_url/1` and embedded in the state:

1. **Start OAuth**: TwitterAuthController.start_oauth/2 calls Twitter.authorize_url/1 with state map
2. **PKCE Generation**: Platform module generates code_verifier + code_challenge, merges code_verifier into state
3. **State Encoding**: State (with code_verifier) encoded as Base64 URL-safe, sent to X as state param
4. **X Authorization**: User authorizes, X redirects back with code + state
5. **Code Verifier Extraction**: Controller decodes state, extracts code_verifier
6. **Token Exchange**: Controller calls Twitter.exchange_code/2 with code + code_verifier
7. **PKCE Validation**: X API validates SHA256(code_verifier) matches original code_challenge

### Token Refresh Logic

The TokenRefreshWorker now handles two distinct refresh patterns:

**X/Twitter (refresh_token_encrypted populated)**:
- Worker calls `get_token_for_refresh(account)` → returns refresh_token
- Passes refresh_token to Twitter.refresh_tokens/1
- X API returns NEW access_token + NEW refresh_token (single-use rotation)
- Worker stores both new tokens via Social.refresh_social_account_tokens/2

**Instagram (refresh_token_encrypted is nil)**:
- Worker calls `get_token_for_refresh(account)` → returns access_token
- Passes access_token to Instagram.refresh_tokens/1
- Instagram API returns NEW access_token (no new refresh_token)
- Worker stores new access_token

### Hourly Check Rationale

X tokens expire in 2 hours (7200 seconds). Checking every hour means:
- Token at 1 hour old (50% lifetime) triggers refresh (within 1-day threshold from SocialAccount.token_needs_refresh?/1)
- Leaves 1-hour buffer before actual expiry
- Instagram 60-day tokens (5,184,000 seconds) still refresh when within 1 day of expiry (86,400 seconds)
- No impact on Instagram refresh behavior, just detected earlier

## Verification Results

All verification criteria met:

1. `mix compile --warnings-as-errors` - Zero errors/warnings for Twitter controllers, router, TokenRefreshWorker (only pre-existing Instagram.publish_video/4 warning)
2. `mix phx.routes | grep twitter` - All 4 routes registered correctly
3. TwitterAuthController has start_oauth/2 and oauth_callback/2 public functions
4. UserTwitterAuthController has start_oauth/2 and oauth_callback/2 public functions
5. Both controllers extract code_verifier from state and pass to Twitter.exchange_code/2
6. Both controllers include refresh_token in account_attrs (line 208 TwitterAuthController, line 163 UserTwitterAuthController)
7. Both controllers redirect to /twitter-callback path on Tauri local server
8. TokenRefreshWorker @default_interval is :timer.hours(1)
9. TokenRefreshWorker.get_token_for_refresh/1 prefers refresh_token over access_token
10. Instagram OAuth flow unchanged (routes, controller, refresh pattern all intact)

## Files Changed

| File | Lines Changed | Purpose |
|------|---------------|---------|
| `server/lib/clippster_server_web/controllers/twitter_auth_controller.ex` | +269 | Organization X OAuth controller with PKCE |
| `server/lib/clippster_server_web/controllers/user_twitter_auth_controller.ex` | +251 | Personal X OAuth controller with PKCE |
| `server/lib/clippster_server_web/router.ex` | +8 | X OAuth routes (org + personal) |
| `server/lib/clippster_server/social/token_refresh_worker.ex` | +29, -5 | Hourly checks, platform-aware refresh token logic |

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 494360f | feat(01-02): create organization and personal X OAuth controllers |
| 2 | 2c3c95d | feat(01-02): add X OAuth routes to Phoenix router |
| 3 | 5ceb5f3 | feat(01-02): update TokenRefreshWorker for X 2-hour token expiry |

## Next Steps

**Phase 1 Complete!** All OAuth infrastructure is now in place:
- Plan 01 built the X Platform module with PKCE support
- Plan 02 wired it into the full OAuth flow with controllers, routes, and token refresh

**Phase 2 (Content Publishing)** can now implement:
- Twitter.publish_media/3 to post tweets with media using OAuth tokens
- Post scheduling infrastructure
- Content queue management

**Phase 3 (Analytics)** can implement:
- Twitter.get_insights/2 to fetch post analytics via X API v2
- Analytics dashboard integration
- Performance tracking

## Self-Check: PASSED

Verified all created/modified files exist:
- `server/lib/clippster_server_web/controllers/twitter_auth_controller.ex` - EXISTS
- `server/lib/clippster_server_web/controllers/user_twitter_auth_controller.ex` - EXISTS
- `server/lib/clippster_server_web/router.ex` - EXISTS (modified)
- `server/lib/clippster_server/social/token_refresh_worker.ex` - EXISTS (modified)

Verified all commits exist:
- 494360f - EXISTS
- 2c3c95d - EXISTS
- 5ceb5f3 - EXISTS

All implementation claims verified against codebase.
