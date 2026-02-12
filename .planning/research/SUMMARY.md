# Project Research Summary

**Project:** X (Twitter) API v2 OAuth & Posting Integration
**Domain:** Social Media Platform Integration
**Researched:** 2026-02-09
**Confidence:** MEDIUM

## Executive Summary

Adding X API v2 posting to Clippster requires implementing OAuth 2.0 with PKCE (Proof Key for Code Exchange), migrating to v2 media upload endpoints (v1.1 deprecated June 2025), and handling asynchronous video processing. Unlike Instagram's simpler OAuth flow, X requires client-side PKCE generation, has split API responsibilities, and uses single-use refresh tokens that invalidate after each use. The recommended approach leverages existing infrastructure (Platform behavior, ScheduledPostWorker, TokenRefreshWorker) while implementing X-specific patterns for chunked video upload (INIT/APPEND/FINALIZE/STATUS) and app-level rate limiting.

Critical risks center on OAuth implementation complexity (missing `offline.access` scope causes 2-hour token expiry with no refresh), chunked upload requirements (all videos must use 3-phase upload regardless of size), and app-level rate limits (free tier has 1,500 tweets/month shared across all users, not per-user). Mitigation strategies include explicit scope validation in Phase 1, dedicated media upload implementation with status polling in Phase 2, and app-level rate limit tracking with per-user quotas in Phase 4. The existing Instagram integration provides a strong foundation for posting workflows, but OAuth and media upload patterns require X-specific implementations that cannot be directly reused.

The integration achieves feature parity with Instagram (immediate and scheduled video posting) while respecting X-specific constraints (280 character limit, 512MB video cap on free tier, mandatory chunked upload). Key differentiators like alt text and reply settings are deferred to v1.x, allowing focus on reliable core posting functionality before adding enhancements. No new dependencies are required—all functionality can be implemented using existing HTTPoison, built-in :crypto for PKCE, and Jason for JSON handling.

## Key Findings

### Recommended Stack

No new dependencies required. X API v2 integration uses existing HTTPoison for HTTP requests, built-in `:crypto` for PKCE implementation (SHA256 hashing and base64 encoding), and Jason for JSON handling. The key architectural decision is implementing PKCE directly rather than adding an OAuth library, as the popular `oauth2` library doesn't support PKCE and would require custom implementation anyway.

**Core technologies:**
- **X API v2**: OAuth 2.0 with PKCE for authentication, POST /2/tweets for posting, dedicated v2 media upload endpoints (migration from deprecated v1.1 completed June 2025)
- **HTTPoison (~> 2.2)**: Already in use for Instagram integration, sufficient for X API needs. Alternative is Req (~> 0.5) for future modernization but not required for this integration.
- **Built-in :crypto**: Native Elixir/Erlang crypto library handles PKCE code verifier/challenge generation using SHA256 hashing. No external PKCE library needed—implementation is 10-15 lines of code.
- **Jason (~> 1.2)**: Already in use for JSON encoding/decoding. X API v2 uses JSON exclusively for request/response payloads.

**Critical version notes:**
- X API v2 endpoints are mandatory as of June 9, 2025 (v1.1 media upload endpoints sunset completed)
- OAuth 2.0 with PKCE is required for user context (all write operations)
- Media upload uses v2 endpoints at `api.x.com/2/media/upload` (not legacy v1.1 endpoints)
- Access tokens expire in 2 hours, refresh tokens are long-lived but single-use (new token issued on each refresh)
- Refresh tokens require explicit `offline.access` scope in authorization request

### Expected Features

Research from FEATURES.md establishes clear priority tiers based on user expectations and competitive analysis of social media management tools (Buffer, Typefully, Hootsuite).

**Must have (table stakes):**
- OAuth 2.0 connection flow with PKCE (users connect X accounts to organization)
- Video posting with caption, immediate execution (core clip distribution use case)
- Scheduled video posting (reuse ScheduledPostWorker infrastructure, parity with Instagram)
- Access token refresh with single-use token rotation (2-hour access token lifespan)
- Post status tracking (store post_id, post_url, posted_at in PostSubmission schema)
- 280 character limit validation (client-side and server-side)
- Chunked media upload with async processing wait (INIT/APPEND/FINALIZE/STATUS polling)
- Presigned URL generation for R2 private storage (Clippster uses private R2 buckets)
- Error handling with retry logic (429 rate limits, 5xx server errors, exponential backoff)
- Media processing wait (poll STATUS until state="succeeded", timeout after 5 minutes)

**Should have (competitive advantages):**
- Alt text support (1,000 character limit, accessibility compliance, growing ADA pressure)
- Reply settings control (following, mentioned, verified, subscribers—audience management)
- Video format validation before upload (512MB max, MP4/MOV, H.264, 1920x1080 resolution)
- Rate limit visibility (show remaining API quota, warn when approaching limits)
- Post preview UI (show character count, video thumbnail, how post will appear)
- Bulk scheduling (upload multiple clips, schedule as individual posts with time offsets)
- Account health dashboard (token expiry warnings, failed post history, re-auth prompts)

**Defer (v2+):**
- Thread posting (multi-video threads, complex sequential API calls with reply_to relationships, high failure surface area)
- X Analytics integration (separate concern from posting, requires Basic tier $100/mo minimum)
- Best time to post suggestions (requires analytics data, follower activity patterns)
- Video optimization (auto-compress to fit X limits, bitrate/resolution adjustment, likely unnecessary for Clippster clips)
- Draft posts (save post configuration without scheduling, resume later)
- Team collaboration features (post approval workflows, comment threads on scheduled posts)

**Anti-features (commonly requested but problematic):**
- Poll creation (X polls can't include media attachments, incompatible with video posting workflow)
- Extended character support (X API enforces 280 char limit even for Premium users, despite 4K+ via web)
- Real-time analytics during posting (excessive API calls, rate limit pressure, not needed in publish flow)
- Native X scheduling (X API v2 has no scheduling endpoints, must use existing ScheduledPostWorker)
- Image posting (Clippster is video-focused, images add minimal value for core use case)
- Multiple video carousels (X limitation: 1 video per post, or up to 4 images—no multiple videos)

### Architecture Approach

The integration follows the existing Platform behavior pattern, adding TwitterV2 module alongside existing Twitter module (dual module coexistence: TwitterV2 for posting with OAuth 2.0 user context, Twitter for analytics via twitterapi.io third-party service). OAuth flow requires two-step exchange: client generates code_verifier and code_challenge, server receives callback with authorization code, client calls exchange endpoint POST with code_verifier for token exchange. This differs from Instagram's fully server-side OAuth where all state lives server-side.

**Major components:**
1. **TwitterV2AuthController** — Handles OAuth 2.0 PKCE flow, validates state parameter (base64-encoded JSON with org_id, callback_port, user_id, timestamp), exchanges authorization code with client-provided code_verifier, creates SocialAccount records with encrypted tokens.
2. **TwitterV2 Platform Module** — Implements Platform behavior for OAuth token exchange, chunked media upload (INIT/APPEND/FINALIZE/STATUS polling), tweet creation with media_ids, token refresh with single-use rotation (atomic DB update of both access_token and refresh_token).
3. **Chunked Upload Handler** — Three-phase video upload: INIT (POST with total_bytes/media_type, returns media_id), APPEND chunks (5MB each, sequential with segment_index 0-based), FINALIZE (POST media_id, triggers processing, returns processing_info), STATUS polling (wait until state="succeeded", respect check_after_secs interval).
4. **Dual Module Pattern** — TwitterV2 (posting, OAuth 2.0 user context, official X API v2) coexists with Twitter (analytics, twitterapi.io third-party service, API key auth), clear separation of concerns documented in module headers, Platform behavior routes posting to TwitterV2.

**Key patterns from ARCHITECTURE.md:**
- **PKCE Implementation**: Client generates code_verifier (128 bytes random, base64url-encoded to 43+ chars), creates code_challenge (SHA256 hash of verifier, base64url-encoded), server validates during token exchange, use S256 method (not plain).
- **Single-Use Refresh Tokens**: X returns NEW refresh token on each refresh, old token invalidates immediately. Atomic database update of both access_token and refresh_token in single transaction, distributed lock/mutex prevents concurrent refresh attempts from multiple workers.
- **Chunked Upload with Polling**: Split video into 5MB chunks (safe limit, X docs don't specify maximum), upload sequentially with segment_index starting at 0, poll STATUS endpoint with exponential backoff (initial wait from check_after_secs, typically 5s), timeout after 5 minutes (30 polls × 10s intervals).
- **App-Level Rate Limiting**: Track POST requests across all users (free tier: 1,500 tweets/month total shared by app, NOT per-user), parse x-rate-limit-* headers on every response (x-rate-limit-remaining, x-rate-limit-reset), implement per-user quotas in application layer to prevent single user DOS.

### Critical Pitfalls

Research from PITFALLS.md identifies 12 critical and moderate pitfalls. Top 8 most impactful:

1. **OAuth 2.0 Missing offline.access Scope (CRITICAL)** — Access tokens expire in 2 hours with no refresh token if `offline.access` scope is omitted. Users must re-authenticate constantly, breaking scheduled posts that execute hours/days later. Required scopes: `tweet.read tweet.write users.read offline.access media.write`. Fixing this later requires re-authenticating all users (HIGH cost). Validate refresh_token presence in OAuth callback handler, add integration test that verifies refresh token is returned. Phase: Must be correct in Phase 1 (OAuth).

2. **Refresh Token Single-Use Not Handled (CRITICAL)** — X refresh tokens invalidate after use, returning NEW refresh token that must replace old one. Attempting to reuse old token returns "invalid refresh token" errors. Race conditions in concurrent refresh attempts (multiple workers) cause token invalidation for all. Solution: treat refresh token as single-use consumable, atomic database update of both access_token AND refresh_token in single transaction, implement distributed lock/mutex for token refresh per user (Redis-based), never refresh "just in case"—only on 401 or actual expiry. Phase: Phase 1 (OAuth), database schema must support atomic updates of both tokens.

3. **Chunked Upload Required for All Videos (CRITICAL)** — X rejects direct video upload. Three-phase chunked upload (INIT/APPEND/FINALIZE) is mandatory regardless of file size, even for small videos under 5MB. Instagram allows direct upload, developer assumes same for X. Common error: "Segments do not add up to provided total file size" on FINALIZE indicates chunking implementation bug (wrong byte counts). Implementation: always use chunked upload for videos, chunk size 5MB (safe default), segment_index is 0-based not 1-based. Phase: Phase 2 (Media Upload), cannot reuse Instagram's simpler upload logic.

4. **Video Processing Status Not Polled Before Posting (CRITICAL)** — After FINALIZE, video processes asynchronously on X servers. Posting tweet immediately fails with "media not ready" errors. Instagram processes media synchronously during upload, developer assumes media_id is usable immediately. Solution: after FINALIZE, check response for processing_info field, if present poll STATUS endpoint (GET /media/upload?command=STATUS&media_id={id}), check state field progression: "pending" → "in_progress" → "succeeded" or "failed", use check_after_secs from response for polling interval (typically 5 seconds), set maximum polling timeout (5 minutes recommended), only use media_id in tweet after state="succeeded", handle "failed" state by re-uploading media. Phase: Phase 2 (Media Upload), status polling must be part of video upload implementation.

5. **App-Level Rate Limits Apply to All Users (CRITICAL)** — Free tier: 1,500 tweets/month across entire app (not per-user). One power user exhausts quota for everyone, blocking all other users from posting. Instagram has per-user limits, X has app-level POST limits measured across ALL authenticated users (GET requests are per-user, POST requests are app-level). Solution: understand tiering (Free: 1,500/mo total, Basic $200/mo: 50,000/mo total, Pro $5,000/mo: 300,000/mo total), implement per-user rate limiting in application layer (below app-level limit), parse rate limit headers on every response (x-rate-limit-limit, x-rate-limit-remaining, x-rate-limit-reset), proactively throttle when remaining < 10% of limit, queue posts when approaching limits, return clear user error: "App rate limit reached, try again at {reset_time}". Phase: Phase 4 (Rate Limiting), dedicated phase for app-level tracking and queuing system.

6. **redirect_uri Must Match Exactly Including Trailing Slash (CRITICAL)** — OAuth fails with "redirect_uri_mismatch" errors even when URI looks correct. X requires EXACT match including protocol, port, path, and trailing slash. `http://localhost:3000/callback` ≠ `http://localhost:3000/callback/`. Also localhost vs 127.0.0.1 mismatch. Solution: register exact URI in X Developer Portal including trailing slash, use environment variables for redirect_uri (don't construct dynamically), test exact string match between registered URI and code, for Tauri desktop app use custom scheme `myapp://callback` or fixed port `http://localhost:PORT/callback`, never allow user input to modify redirect_uri. Phase: Phase 1 (OAuth), must be correct in initial implementation.

7. **Duplicate Content Detection Aggressive (MODERATE)** — Posts fail with "You are not allowed to create a Tweet with duplicate content" (403 error) even when content is not identical. X's duplicate detection triggers on similar text, same media, or rapid successive posts of similar content. Instagram allows duplicate posts, X prevents to combat spam. Retry logic reposting failed content triggers false positives. Solution: never retry exact same content without modification, add variation to retried posts (append timestamp, emoji, modify whitespace), validate content uniqueness before queueing scheduled posts, implement deduplication check in application layer, wait several minutes before retrying failed posts, store hash of recently posted content to prevent duplicates, handle 403 duplicate error gracefully (notify user, don't auto-retry). Phase: Phase 4 (Rate Limiting & Error Handling), add deduplication logic alongside retry handling.

8. **Video File Size and Format Not Validated (MODERATE)** — Video upload fails after chunked upload completes. FINALIZE returns validation errors, user wastes bandwidth uploading incompatible video. X has strict requirements: 512MB max (non-premium), MP4/MOV only, H.264 codec, AAC audio, max 1920x1080 resolution, max 140s duration (2m20s), max 40fps (30fps recommended), max 25 Mbps bitrate. Solution: validate before starting upload (file size, format, codec, resolution, duration, frame rate, bitrate), show user-friendly error before upload starts, offer video transcoding if format incorrect, check user's premium status to determine limits, document format requirements in UI. Phase: Phase 2 (Media Upload), add validation before starting chunked upload.

## Implications for Roadmap

Based on research synthesis, suggested phase structure prioritizes foundational OAuth correctness (highest risk of requiring user re-authentication), then complex media upload with async processing, then posting integration, then reliability features:

### Phase 1: OAuth 2.0 PKCE Authentication
**Rationale:** OAuth is the gateway to all other features. PKCE implementation is X-specific and cannot reuse Instagram patterns (Instagram uses standard OAuth without PKCE, has 60-day long-lived tokens by default). Missing `offline.access` scope or incorrect code_verifier handling requires re-authenticating all users later (HIGH cost recovery). X tokens expire in 2 hours vs Instagram's 60 days, making correct OAuth implementation critical for scheduled posts.

**Delivers:**
- User connects X account to organization via OAuth 2.0 with PKCE
- Access tokens and refresh tokens stored encrypted (reuse existing encryption)
- Automatic token refresh before 2-hour expiry (integrate with TokenRefreshWorker)
- User profile retrieval (GET /2/users/me: username, display name, profile image)
- SocialAccount record creation (platform="twitter", encrypted tokens, token_expires_at)

**Addresses Features:**
- OAuth connection flow (table stakes)
- Access token refresh (table stakes)

**Avoids Pitfalls:**
- OAuth 2.0 missing offline.access scope (CRITICAL) — validate refresh_token present in response
- Refresh token single-use not handled (CRITICAL) — atomic DB update, distributed lock
- redirect_uri exact match (CRITICAL) — environment variables, test all environments
- PKCE code_verifier length requirements (CRITICAL) — 43-128 chars, SHA256, S256 method
- App-only vs user context confusion (CRITICAL) — always user context for posting

**Research Flag:** SKIP research-phase. OAuth 2.0 PKCE is well-documented in X API docs, RFC 7636 provides official spec, implementation pattern is clear from ARCHITECTURE.md with code examples. Main work is adapting existing Instagram OAuth controller to two-step exchange (server redirect, client POST with code_verifier).

---

### Phase 2: Chunked Video Upload & Async Processing
**Rationale:** Video upload is fundamentally different from Instagram (chunked vs single-request, async processing vs synchronous). This complexity justifies dedicated phase before integrating with posting flow. Without working video upload, tweet creation cannot attach media (media_id dependency). Phase 2 isolates upload complexity, enabling independent testing and debugging.

**Delivers:**
- Three-phase chunked upload (INIT → APPEND chunks → FINALIZE)
- Video processing status polling with exponential backoff (poll until state="succeeded")
- Presigned URL generation for R2 private storage (X must download video during processing)
- Video format validation before upload (512MB, MP4/MOV, H.264, AAC, 1920x1080, 140s, 40fps, 25Mbps)
- Error handling for upload failures (retry individual chunks, handle processing failures)
- Chunk splitting logic (5MB chunks, 0-based segment_index, multipart form data)

**Uses Stack:**
- HTTPoison for chunked multipart upload (POST with multipart form data)
- Built-in binary handling for 5MB chunk splitting (byte_size, binary slicing)
- X API v2 media upload endpoints (api.x.com/2/media/upload with command parameter)

**Implements Architecture:**
- Chunked Upload Handler component (three-phase workflow orchestration)
- STATUS polling with check_after_secs intervals (exponential backoff, 5-minute timeout)
- Presigned URL generation (reuse existing pattern from Instagram, 2-hour expiry)

**Addresses Features:**
- Video posting infrastructure (table stakes)
- Media processing wait (table stakes)
- Presigned URL generation (table stakes)
- Video format validation (should-have)

**Avoids Pitfalls:**
- Chunked upload required for videos (CRITICAL) — always use 3-phase, never single upload
- Video processing status not polled (CRITICAL) — STATUS polling until succeeded/failed
- Video file size and format not validated (MODERATE) — pre-upload validation, early failure
- Media upload uses v2 endpoints (CRITICAL) — api.x.com/2/media/upload not v1.1

**Research Flag:** SKIP research-phase. Chunked upload pattern is thoroughly documented in ARCHITECTURE.md with implementation examples and PITFALLS.md with error scenarios. X API docs cover INIT/APPEND/FINALIZE/STATUS flow with request/response formats.

---

### Phase 3: Tweet Creation & Scheduled Posting
**Rationale:** With authentication (Phase 1) and media upload (Phase 2) complete, integrate into posting flow. Reuse existing ScheduledPostWorker infrastructure (polymorphic via Platform behavior), leveraging proven pattern from Instagram. Focus on tweet creation endpoint integration, character limit validation, and post tracking. Minimal new infrastructure needed—mainly glue code connecting upload to posting.

**Delivers:**
- POST /2/tweets with media_id attachment (JSON body: {text, media: {media_ids: [id]}})
- 280 character validation (client-side and server-side, different from Instagram's 2,200)
- Post status tracking (update PostSubmission: post_id, post_url, posted_at, status="published")
- Integration with ScheduledPostWorker for scheduled posts (existing Platform.call routes to TwitterV2)
- Post URL generation (https://x.com/{username}/status/{id})
- Error handling for tweet creation failures (403 duplicate, 401 token, 400 validation)

**Addresses Features:**
- Video posting immediate (table stakes)
- Scheduled video posting (table stakes)
- Character limit validation (table stakes)
- Post status tracking (table stakes)

**Avoids Pitfalls:**
- Integration between chunked upload and tweet creation (coordinate media_id handoff)
- Character limit differences from Instagram (280 vs 2,200, avoid copy-paste assumptions)

**Research Flag:** SKIP research-phase. POST /2/tweets endpoint is straightforward REST endpoint documented in STACK.md. Scheduling reuses existing ScheduledPostWorker pattern from Instagram (no changes needed, Platform.call routes to TwitterV2.publish_media automatically).

---

### Phase 4: Rate Limiting & Reliability
**Rationale:** App-level rate limits are X-specific and can cause surprise failures if not tracked. Free tier (1,500 tweets/month shared across all users) requires proactive tracking to prevent single user exhausting quota. Retry logic must account for duplicate content detection (403 errors), rate limits (429 errors), and transient failures (5xx errors). This phase hardens the integration for production use under load.

**Delivers:**
- Parse x-rate-limit-* headers on all responses (x-rate-limit-limit, x-rate-limit-remaining, x-rate-limit-reset)
- Track app-level POST quota across all users (shared pool for free tier)
- Per-user rate limiting in application layer (prevent single user DOS)
- Exponential backoff retry for 429/5xx errors (respect Retry-After header)
- Duplicate content detection (application-level deduplication, hash recent posts)
- Queue posts when approaching rate limit (stop at 90% of limit, queue remaining)
- User-facing rate limit visibility (show remaining quota, monthly usage dashboard)
- Error format parsing (X format: {title, detail, type, status} not Instagram format)

**Addresses Features:**
- Error handling/retries (table stakes)
- Rate limit visibility (should-have)

**Avoids Pitfalls:**
- App-level rate limits (CRITICAL) — track across all users, per-user quotas
- Duplicate content detection (MODERATE) — application-level dedup, never retry exact content
- Error format differs from Instagram (MODERATE) — X-specific parser for {title, detail, type}

**Research Flag:** SKIP research-phase. Rate limiting patterns are documented in PITFALLS.md with header parsing examples. Error response format is detailed in STACK.md. Exponential backoff is established pattern in ScheduledPostWorker.

---

### Phase 5: Enhancements (v1.x)
**Rationale:** After core posting is stable and validated with users in production, add differentiating features that improve user experience. These are low-complexity, high-value enhancements that don't risk destabilizing core posting functionality. User feedback from Phase 1-4 rollout validates which enhancements matter most.

**Delivers:**
- Alt text support (1,000 characters, sent during chunked upload INIT, accessibility compliance)
- Reply settings control (dropdown: anyone/following/mentioned/verified, POST /2/tweets parameter)
- Post preview UI (show character count 45/280, video thumbnail, how post will appear on X)
- Bulk scheduling (upload multiple clips, schedule as individual posts with time offsets)
- Account health dashboard (token expiry warnings, failed post history, re-auth prompts when tokens invalid)
- Video optimization warnings (detect if video exceeds X limits, suggest re-export)

**Addresses Features:**
- Alt text (competitive advantage, accessibility)
- Reply settings (competitive advantage, audience management)
- Post preview (should-have, improves UX)
- Bulk scheduling (should-have, power user feature)
- Account health dashboard (should-have, reduces support burden)

**Research Flag:** SKIP research-phase. Alt text and reply settings are simple API parameters documented in X API. Post preview is UI work. Bulk scheduling reuses existing scheduling infrastructure with minor enhancements.

---

### Phase Ordering Rationale

**Why OAuth first (Phase 1):** All features depend on valid user context tokens. Getting PKCE wrong (missing offline.access scope, incorrect code_verifier length, wrong code_challenge_method) requires re-authenticating all users (high cost recovery, user disruption). Instagram pattern doesn't transfer (no PKCE, long-lived tokens by default, simpler server-side OAuth). X tokens expire in 2 hours vs Instagram's 60 days, making refresh token acquisition critical. Single-use refresh token rotation must be correct initially—fixing concurrency bugs later risks invalidating all user tokens.

**Why media upload before posting (Phase 2):** Video upload is complex (chunked INIT/APPEND/FINALIZE, async STATUS polling, timeout handling, chunk size optimization). Isolating this complexity prevents debugging posting failures caused by upload issues. Integration tests can validate upload independently before integrating with tweet creation. Tweet creation requires media_id from successful upload—can't test posting without working upload. Chunked upload has most edge cases (network interruption, partial uploads, processing failures, timeout tuning).

**Why posting after upload (Phase 3):** With authentication and upload working, posting is straightforward integration (POST /2/tweets with media_id). Reuses existing ScheduledPostWorker pattern from Instagram (no infrastructure changes, Platform.call routes automatically). Can focus on character limit validation (280 vs 2,200) and X-specific error handling without fighting upload issues. Scheduled posts can be tested end-to-end (OAuth → upload → post → tracking).

**Why rate limiting separate phase (Phase 4):** App-level rate limiting is cross-cutting concern affecting all posts. Implementing after basic posting works allows empirical testing of rate limit behavior under load (free tier: 1,500 posts/month is sufficient for development/testing). Can instrument actual API responses to understand x-rate-limit-* header behavior. Retry logic and duplicate detection are reliability enhancements, not core functionality—can add after posting proves stable.

**Why enhancements last (Phase 5):** Alt text and reply settings are straightforward API parameters once posting works (no complex orchestration). Deferring allows focus on core reliability without feature bloat. User feedback from production rollout (Phases 1-4) validates which enhancements users actually request vs theoretical nice-to-haves. Post preview and bulk scheduling are UI/UX improvements—better to get core posting right first.

### Research Flags

**All phases use standard patterns—NO phases require deeper research during planning:**

- **Phase 1 (OAuth):** OAuth 2.0 PKCE is well-documented in X API official docs, RFC 7636 provides authoritative spec, ARCHITECTURE.md includes implementation examples with code snippets. Main adaptation is two-step exchange (server redirect, client POST with code_verifier) documented in data flow diagrams.

- **Phase 2 (Media Upload):** X API chunked upload documentation is comprehensive (INIT/APPEND/FINALIZE/STATUS with request/response examples). ARCHITECTURE.md provides chunked upload code implementation. PITFALLS.md covers edge cases (segment_index 0-based, byte counting, processing timeouts). Pattern is established in other integrations (S3 multipart upload, YouTube resumable upload).

- **Phase 3 (Posting):** POST /2/tweets is straightforward REST endpoint (JSON body with text and media.media_ids array). STACK.md documents endpoint and request format. Scheduling reuses existing ScheduledPostWorker infrastructure—no research needed, proven pattern from Instagram.

- **Phase 4 (Rate Limiting):** Rate limit header parsing is standard HTTP pattern. PITFALLS.md documents x-rate-limit-* headers and app-level tracking strategy. Exponential backoff and retry logic exist in ScheduledPostWorker. Error format parsing documented in STACK.md with examples.

- **Phase 5 (Enhancements):** Alt text and reply settings are simple API parameters documented in FEATURES.md and STACK.md. UI enhancements (post preview, bulk scheduling) are standard web development patterns.

**Research confidence is MEDIUM overall (not HIGH) due to:**
- X API documentation has some redirect/access issues (some official pages don't load consistently)
- Some edge cases rely on community forum posts (not official docs): concurrent token refresh behavior, exact rate limit timing (calendar month vs rolling 30 days), processing time variance by video size
- Premium tier feature detection not exposed via API (app can't determine user's premium status to adjust limits dynamically)

**However, implementation patterns are clear enough to proceed with roadmap planning.** Operational uncertainties (rate limit exact timing, token refresh race conditions, processing time variance) can be resolved empirically during Phase implementation through integration tests and production monitoring.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Official X API docs have some redirect/access issues on specific pages, but core endpoints are verified and working (OAuth, media upload, posting). HTTPoison/Jason already proven in Instagram integration. PKCE implementation verified against RFC 7636 (authoritative spec). No new dependencies reduces risk. |
| Features | MEDIUM | Feature requirements verified with official X API docs (endpoint capabilities, constraints) and 2026 competitor analysis (Buffer, Typefully, Hootsuite feature sets). MVP definition achieves parity with Instagram integration. Some free tier limits rely on third-party sources (official docs don't clearly state 1,500/month). |
| Architecture | HIGH | Existing Platform behavior provides clear integration pattern (proven with Instagram). PKCE flow documented in official X docs and RFC 7636. Chunked upload workflow verified with X API v2 docs and official deprecation announcements. Dual module coexistence (TwitterV2/Twitter) follows established pattern. |
| Pitfalls | MEDIUM | Critical pitfalls verified with X Developer Community posts (official source managed by X staff). PKCE pitfalls verified against RFC security considerations. Some edge cases (concurrent token refresh, exact chunk size limits) based on community reports not official docs. Production behavior requires empirical validation. |

**Overall confidence:** MEDIUM

Research is sufficient for roadmap planning and initial implementation. Uncertainty centers on operational concerns (rate limit behavior under load, token refresh race conditions in high-concurrency scenarios, video processing time variance by file size/codec) rather than missing documentation or unclear patterns. Architecture is sound, implementation patterns are established, main risks are execution risks (correct PKCE implementation, proper chunking logic, atomic token updates) not knowledge gaps.

**Mitigation strategies:**
- Comprehensive integration tests covering each pitfall scenario (missing offline.access, concurrent refresh, duplicate content, rate limits)
- Load testing in staging with multiple concurrent users posting (validate app-level rate limit tracking, token refresh locking)
- Production monitoring of x-rate-limit-* headers (log actual API behavior, adjust quotas empirically)
- Gradual rollout to subset of users (catch edge cases before full deployment)

### Gaps to Address

Areas where research was inconclusive or needs validation during implementation (not blocking for roadmap):

**Token refresh race conditions (Phase 1):** Research identifies single-use refresh tokens as critical pitfall and recommends distributed lock (Redis mutex), but exact concurrent refresh behavior under high load needs empirical testing. Scenario: 10 workers simultaneously detect token expiry for same user, all attempt refresh—how many succeed? Does X rate-limit refresh requests? Mitigation: implement distributed lock in Phase 1, load test with multiple workers in Phase 4, log refresh attempts to understand patterns.

**Chunked upload chunk size limits (Phase 2):** X API documentation doesn't specify maximum chunk size (only minimum total file size 512MB for free tier). Research recommends 5MB as safe default based on community reports and similar APIs (S3 multipart 5MB minimum). Needs validation: can chunks be larger (10MB, 20MB) for faster upload? Do smaller chunks (1MB) reduce timeout risk for slow connections? Mitigation: start with 5MB chunks, monitor for 500 errors or upload failures, adjust empirically if needed, log successful uploads with chunk sizes.

**Video processing time variance (Phase 2):** Video processing duration depends on file size, length, codec, resolution, but X documentation doesn't provide estimates (seconds? minutes?). Research recommends 5-minute timeout (30 polls × 10s exponential backoff) but this is conservative guess. Needs validation: what's typical processing time for 10MB/30s video vs 500MB/2min video? When do timeouts actually occur vs processing failures? Mitigation: implement 5-minute timeout with exponential backoff in Phase 2, log processing times (start to succeeded state) to understand actual patterns, adjust timeout or backoff strategy based on data.

**Premium vs free tier feature detection (Phase 2/5):** X API doesn't expose user's premium status. App can't proactively adjust limits (512MB free tier vs 16GB Premium Plus, 140s free vs 4hr Premium). User sees generic error "file too large" after upload fails. Needs validation: is there an endpoint to check premium status? Does /2/users/me include subscription_type field? Can we infer from upload errors (attempt 600MB upload, if accepted assume Premium)? Mitigation: enforce free tier limits (512MB, 140s) universally for safety, surface validation errors clearly to user with explanation, document Premium feature gap in UI, revisit if X adds premium detection endpoint.

**App-level rate limit exact calculation (Phase 4):** X documentation states "1,500 tweets per month" for free tier but doesn't clarify reset timing (calendar month? rolling 30 days? UTC vs user timezone?). x-rate-limit-reset header provides epoch timestamp but unclear if this is per-endpoint or app-wide. Needs validation: does limit reset on 1st of month at midnight UTC? Is reset time consistent across requests? Can we rely on x-rate-limit-reset for accurate tracking? Mitigation: parse x-rate-limit-reset header for accurate tracking (trust X's reported reset time), implement conservative buffer (stop at 90% of limit to avoid edge cases), log actual reset behavior to understand timing, adjust strategy based on observed patterns.

**Error code classification for retry logic (Phase 4):** Research identifies transient errors (429, 5xx) vs permanent errors (400, 403, 404) but X API error responses can be ambiguous. Example: 403 can mean duplicate content (don't retry) OR permission issue (permanent failure) OR rate limit (unofficial). Which error messages should trigger retry vs permanent failure? Mitigation: implement conservative retry strategy (only retry 429/500/502/503/504 with exponential backoff), mark all 4xx except 429 as permanent failures initially, log error details (title, detail, type fields), adjust classification based on production error patterns, document ambiguous cases for manual review.

**These gaps are phase-specific implementation details, not architectural unknowns.** Research provides sufficient clarity for roadmap structure and phase planning. Gaps can be resolved during implementation through integration tests, production monitoring, and empirical tuning. None block proceeding to roadmap definition.

## Sources

Sources aggregated from all four research files (STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md):

### Primary (HIGH confidence)
- [X API v2 Official Documentation](https://docs.x.com/) — OAuth 2.0 authorization, media upload endpoints, POST /2/tweets, rate limits
- [X Developer Community Announcements](https://devcommunity.x.com/) — v1.1 media deprecation (June 9, 2025), v2 migration deadline (May 30, 2025), refresh token lifespan
- [RFC 7636 - PKCE Specification](https://datatracker.ietf.org/doc/html/rfc7636) — Official OAuth 2.0 PKCE standard, security considerations
- [Elixir :crypto Documentation](https://www.erlang.org/doc/man/crypto.html) — SHA256 hashing, base64 encoding for code_verifier/challenge
- [HTTPoison Hex Package](https://hex.pm/packages/httpoison) — HTTP client documentation, version 2.2.x compatibility

### Secondary (MEDIUM confidence)
- [X API Rate Limits Research](https://docs.x.com/x-api/fundamentals/rate-limits) — Free/Basic/Pro tier limits, app-level vs per-user
- [X Video Specifications Guide 2026](https://postfa.st/sizes/x/video) — Format requirements (H.264, AAC, resolution, bitrate)
- [Chunked Media Upload - X API](https://docs.x.com/x-api/media/quickstart/media-upload-chunked) — INIT/APPEND/FINALIZE/STATUS flow
- [Response Codes & Errors - X API](https://docs.x.com/x-api/fundamentals/response-codes-and-errors) — Error format {title, detail, type}
- Competitor analysis (Buffer, Typefully, Hootsuite) — Feature benchmarking for X posting capabilities
- [X API Pricing 2026](https://getlate.dev/blog/twitter-api-pricing) — Third-party pricing comparison, tier limits
- [Elixir HTTP Client Comparison](https://andrealeopardi.com/posts/breakdown-of-http-clients-in-elixir/) — HTTPoison vs Req vs Tesla

### Tertiary (LOW confidence, requires validation)
- Community forum posts on token refresh expiry timing — Conflicting reports on 6-month vs indefinite refresh token lifespan
- Third-party blog posts on X API rate limits — Some sources report different monthly limits, official docs are source of truth
- Chunk size recommendations — 5MB based on community reports and S3 multipart analogy, not official X documentation
- Processing time estimates — No official data, 5-minute timeout is conservative guess based on similar services
- Premium tier features — Third-party sources list 16GB/4hr limits but unclear if accessible via API (web-only features)

**Documentation quality issues noted:**
- Some official X API doc pages have redirects or access issues (links in research return 404 or redirect loops intermittently)
- Rate limit details incomplete (monthly limits stated but reset timing not documented clearly)
- Premium tier API access not documented (features exist on web but API capability unclear)
- Chunked upload documentation sparse for v2 endpoints (mostly v1.1 legacy docs with v2 migration notes)

**Despite documentation gaps, implementation patterns are clear from RFC specs, community announcements, and similar API patterns.** Primary sources (official docs, RFCs) provide sufficient technical detail. Secondary sources (community forums, competitor analysis) provide practical validation. Tertiary sources require empirical validation during implementation but don't block roadmap planning.

---

*Research completed: 2026-02-09*
*Ready for roadmap: yes*
