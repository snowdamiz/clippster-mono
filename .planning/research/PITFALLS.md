# Pitfalls Research

**Domain:** X API v2 Posting Integration
**Researched:** 2026-02-09
**Confidence:** MEDIUM

## Critical Pitfalls

### Pitfall 1: Assuming Media Upload Uses v2 API

**What goes wrong:**
Developers attempt to use X API v2 endpoints for media upload, but media upload still requires v1.1 endpoints (https://upload.twitter.com/1.1/media/upload.json). The v2 media endpoints were announced but the v1.1 endpoints were only sunset on June 9, 2025. Migration to v2 media endpoints at api.x.com/2/media/upload is now mandatory, but the workflow differs significantly from Instagram.

**Why it happens:**
Instagram uses a unified Graph API version. Developers assume X API v2 means ALL endpoints are v2. The mixed API version requirement is not obvious during initial integration planning.

**How to avoid:**
- Use the v2 media upload endpoint: `POST https://api.x.com/2/media/upload`
- Explicitly document API version per endpoint in platform adapter
- Add version checks in integration tests
- Don't reuse Instagram's single-version assumption

**Warning signs:**
- 404 errors when trying to upload media to v2-style endpoint patterns
- Authentication working for posting but failing for media upload
- Media upload working in Postman but failing in code (different endpoint assumptions)

**Phase to address:**
Phase 1 (OAuth + Basic Posting) - Media upload must be part of initial implementation, not deferred.

**Sources:**
- [Deprecating the v1.1 media upload endpoints](https://devcommunity.x.com/t/deprecating-the-v1-1-media-upload-endpoints/238196)
- [Media Upload Endpoints Update and Extended Migration Deadline](https://devcommunity.x.com/t/media-upload-endpoints-update-and-extended-migration-deadline/241818)

---

### Pitfall 2: OAuth 2.0 PKCE Missing offline.access Scope

**What goes wrong:**
Access tokens expire after 2 hours with no refresh token issued. Users must re-authenticate every 2 hours, breaking the scheduling workflow. Instagram tokens last 60 days by default; X requires explicit scope to get refresh tokens.

**Why it happens:**
The `offline.access` scope is not obvious in documentation. Developers copy basic PKCE examples that omit it. Instagram's long-lived tokens create false assumptions about token lifetime patterns.

**How to avoid:**
- Always include `offline.access` in the scopes array during authorization
- Required scopes for posting: `tweet.read tweet.write users.read offline.access media.write`
- Validate refresh token presence in OAuth callback handler
- Add integration test that verifies refresh token is returned
- Document scope differences from Instagram in platform adapter

**Warning signs:**
- OAuth flow succeeds but no refresh_token in response
- Users reporting "reconnect required" every 2 hours
- Scheduled posts failing with 401 errors after token creation time
- Token refresh endpoint returning errors

**Phase to address:**
Phase 1 (OAuth + Basic Posting) - Must be in initial OAuth implementation. Fixing this later requires re-authenticating all users.

**Sources:**
- [OAuth 2.0 Authorization Code Flow with PKCE](https://developer.twitter.com/en/docs/authentication/oauth-2-0/authorization-code)
- [Refresh token expiring (with offline.access scope)](https://devcommunity.x.com/t/refresh-token-expiring-with-offline-access-scope/168899)

---

### Pitfall 3: Refresh Token One-Time Use Not Handled

**What goes wrong:**
After refreshing an access token, the old refresh token becomes invalid. Attempting to reuse it returns "invalid refresh token" errors. Unlike some OAuth implementations, X's refresh tokens are single-use. Each refresh returns a NEW refresh token that must replace the old one.

**Why it happens:**
Instagram and many other platforms allow refresh token reuse. Developers implement token refresh logic that stores access token but doesn't update the refresh token. Race conditions in concurrent refresh attempts cause token invalidation.

**How to avoid:**
- Treat refresh token as single-use consumable
- Atomic database update: store both new access_token AND new refresh_token in single transaction
- Implement distributed lock/mutex for token refresh to prevent concurrent refresh attempts
- Add retry logic with exponential backoff for transient failures
- Never refresh "just in case" - only refresh when token is actually expired or request fails with 401

**Warning signs:**
- "Refresh token validation errors" after first successful refresh
- Users needing to re-authenticate after scheduled posts
- Intermittent 401 errors during high-traffic periods
- Multiple refresh requests for same user happening simultaneously

**Phase to address:**
Phase 1 (OAuth + Basic Posting) - Token refresh logic must be correct from day one. Database schema must support atomic updates of both tokens.

**Sources:**
- [Refresh token getting frequently expired](https://devcommunity.x.com/t/refresh-token-getting-frequently-expired/240282)
- [Refresh token validation errors](https://devcommunity.x.com/t/refresh-token-validation-errors/169179)

---

### Pitfall 4: Chunked Upload Required for Videos (Not Optional)

**What goes wrong:**
Videos fail to upload with "file too large" or validation errors. Developers implement simple single-request upload (like Instagram). X requires 3-phase chunked upload (INIT, APPEND, FINALIZE) for all videos, regardless of size.

**Why it happens:**
Instagram allows direct video upload. X's chunked upload workflow is fundamentally different: INIT creates media_id, APPEND uploads chunks (segment_index starts at 0), FINALIZE processes video and returns processing_info.

**How to avoid:**
- Always use chunked upload for video (even small files)
- Implement 3-phase workflow:
  1. **INIT**: POST with total_bytes and media_type, returns media_id_string
  2. **APPEND**: POST each chunk with segment_index (0-based), media_id, and media data
  3. **FINALIZE**: POST with media_id, check for processing_info in response
- If processing_info present, poll STATUS endpoint until state = "succeeded"
- Use `check_after_secs` from response to determine polling interval
- Chunk size: 5MB is safe, avoid chunks larger than X's undocumented limits

**Warning signs:**
- "Segments do not add up to provided total file size" on FINALIZE
- 500 errors at APPEND stage
- Media upload hanging without error
- Processing never completes

**Phase to address:**
Phase 2 (Media Upload) - Dedicated phase for chunked upload implementation. Cannot reuse Instagram's simpler upload logic.

**Sources:**
- [Chunked Media Upload - X](https://docs.x.com/x-api/media/quickstart/media-upload-chunked)
- [New Dedicated Endpoints for Chunked Media Upload Broken](https://devcommunity.x.com/t/new-dedicated-endpoints-for-chunked-media-upload-broken/241923)
- [Chunked media upload](https://developer.x.com/en/docs/x-api/v1/media/upload-media/uploading-media/chunked-media-upload)

---

### Pitfall 5: Video Processing Status Not Polled Before Posting

**What goes wrong:**
Tweet creation fails with "media not ready" errors. Developer posts tweet immediately after FINALIZE without waiting for video processing. X processes video asynchronously; posting must wait until processing completes.

**Why it happens:**
Instagram processes media synchronously during upload. Developers assume media_id is usable immediately after upload completes. X's asynchronous processing is not obvious until it fails in production.

**How to avoid:**
- After FINALIZE, check response for `processing_info` field
- If present, implement STATUS polling loop:
  - GET /media/upload?command=STATUS&media_id={id}
  - Check `state` field: "pending" → "in_progress" → "succeeded" or "failed"
  - Use `check_after_secs` from response for polling interval (typically 5 seconds)
  - Set maximum polling timeout (5 minutes recommended)
- Only use media_id in tweet after state = "succeeded"
- Handle "failed" state by re-uploading media

**Warning signs:**
- Tweets posting without video attached
- "Media not found" errors when posting
- Videos appearing broken in posts
- Inconsistent behavior (works sometimes, fails others)

**Phase to address:**
Phase 2 (Media Upload) - Status polling must be part of video upload implementation. Add explicit test cases for async processing.

**Sources:**
- [GET media/upload (STATUS)](https://developer.x.com/en/docs/x-api/v1/media/upload-media/api-reference/get-media-upload-status)
- [POST media/upload (FINALIZE)](https://developer.x.com/en/docs/x-api/v1/media/upload-media/api-reference/post-media-upload-finalize)

---

### Pitfall 6: Rate Limits Apply at App Level Across All Users

**What goes wrong:**
One power user exhausts rate limits, blocking all other users from posting. App-wide posting stops due to shared rate limit pool. Instagram has per-user limits; X has app-level POST limits measured across ALL authenticated users.

**Why it happens:**
Developer assumes per-user rate limits (like Instagram). X's rate limit model is fundamentally different: POST requests are limited at the App level, while GET requests are per-user. One user can DOS the entire app.

**How to avoid:**
- Understand tiering:
  - **Free tier**: 1,500 tweets/month TOTAL (not per user)
  - **Basic ($200/mo)**: 50,000 tweets/month TOTAL
  - **Pro ($5,000/mo)**: 300,000 tweets/month TOTAL
- Implement per-user rate limiting in application layer
- Parse rate limit headers on every response:
  - `x-rate-limit-limit`: ceiling for endpoint
  - `x-rate-limit-remaining`: requests left in 15-min window
  - `x-rate-limit-reset`: UTC epoch seconds until reset
- Proactively throttle when remaining < 10% of limit
- Queue posts when approaching limits
- Return clear user error: "App rate limit reached, try again at {reset_time}"

**Warning signs:**
- 429 "Too Many Requests" errors affecting all users simultaneously
- Rate limit errors occurring well below per-user expectations
- All posts failing during high-traffic periods
- Inconsistent posting success based on time of day

**Phase to address:**
Phase 3 (Rate Limiting & Error Handling) - Dedicated phase for app-level rate limit tracking and queuing system.

**Sources:**
- [Rate limits - X](https://docs.x.com/x-api/fundamentals/rate-limits)
- [X API Rate Limits (Formerly Twitter) - 9meters](https://9meters.com/entertainment/social-media/x-api-rate-limits-formerly-twitter)

---

### Pitfall 7: redirect_uri Must Match Exactly (Including Trailing Slash)

**What goes wrong:**
OAuth authorization fails with "redirect_uri_mismatch" errors even when URI looks correct. X requires EXACT match including protocol, port, path, and trailing slash. `http://localhost:3000/callback` ≠ `http://localhost:3000/callback/`

**Why it happens:**
Developer registers one URI in X Developer Portal but application constructs slightly different URI at runtime. Browser/framework adds or removes trailing slash. localhost vs 127.0.0.1 mismatch.

**How to avoid:**
- Register exact URI in X Developer Portal including trailing slash
- Use environment variables for redirect_uri (don't construct dynamically)
- Test exact string match between registered URI and code
- For Tauri desktop app:
  - Use custom scheme: `myapp://callback` (register in portal)
  - OR use `http://localhost:PORT/callback` with fixed port
- Register both `http://localhost:8080/callback` and `http://127.0.0.1:8080/callback` if app might use either
- Never allow user input to modify redirect_uri

**Warning signs:**
- OAuth flow redirects to X but immediately fails
- Error: "Invalid redirect_uri" or "redirect_uri_mismatch"
- OAuth works in development but fails in production
- Works on some developer machines but not others

**Phase to address:**
Phase 1 (OAuth + Basic Posting) - Must be correct in initial OAuth implementation. Test in multiple environments.

**Sources:**
- [How to Fix "Invalid Redirect URI" OAuth2 Errors](https://oneuptime.com/blog/post/2026-01-24-fix-invalid-redirect-uri-oauth2/view)
- [Apps - X](https://docs.x.com/fundamentals/developer-apps)

---

### Pitfall 8: PKCE code_verifier Length Requirements Not Met

**What goes wrong:**
OAuth PKCE flow fails with cryptic validation errors. code_verifier doesn't meet minimum entropy requirements (43-128 characters, minimum 256 bits entropy).

**Why it happens:**
Developer generates short random string or uses simple timestamp. PKCE spec (RFC 7636) has strict requirements: [A-Z][a-z][0-9]-._~ characters only, 43-128 character length.

**How to avoid:**
- Generate code_verifier: 32 random bytes, base64url-encode → 43 characters
- Use crypto library (don't hand-roll):
  ```javascript
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const codeVerifier = base64UrlEncode(array); // 43+ chars
  ```
- For code_challenge: SHA-256 hash of verifier, then base64url-encode
- Use `code_challenge_method=S256` (not plain)
- Store code_verifier securely until token exchange
- Verify parameter case: `S256` not `s256` (case-sensitive)

**Warning signs:**
- OAuth authorization succeeds but token exchange fails
- "Invalid code_verifier" errors
- PKCE validation errors without clear message
- Inconsistent behavior across OAuth flows

**Phase to address:**
Phase 1 (OAuth + Basic Posting) - PKCE implementation must be correct initially. Add unit tests for verifier generation.

**Sources:**
- [RFC 7636 - Proof Key for Code Exchange](https://datatracker.ietf.org/doc/html/rfc7636)
- [OAuth2 with PKCE extension using code_challenge_method=s256](https://devcommunity.x.com/t/oauth2-with-pkce-extension-using-code-challenge-method-s256/165100)

---

### Pitfall 9: Duplicate Content Detection More Aggressive Than Instagram

**What goes wrong:**
Posts fail with "You are not allowed to create a Tweet with duplicate content" (403 error) even when content is not identical. X's duplicate detection triggers on similar text, same media, or rapid successive posts of similar content.

**Why it happens:**
Instagram allows duplicate posts to different accounts. X prevents duplicate content to combat spam. Scheduled posts with same caption across time, retry logic reposting failed content, and template-based posts trigger false positives.

**How to avoid:**
- Never retry exact same content without modification
- Add variation to retried posts:
  - Append timestamp: "Original post [HH:MM]"
  - Add emoji variation
  - Modify whitespace (but don't rely on this alone)
- For scheduled posts: validate content uniqueness before queueing
- Implement deduplication check in application layer
- Wait several minutes before retrying failed posts
- Store hash of recently posted content, prevent duplicates
- Handle 403 duplicate error gracefully: notify user, don't auto-retry

**Warning signs:**
- 403 errors with "duplicate content" message
- Error Code 187 (legacy) or 403 Forbidden (v2)
- Scheduled posts failing intermittently
- Retry logic causing more failures than it fixes

**Phase to address:**
Phase 3 (Rate Limiting & Error Handling) - Add deduplication logic alongside retry handling. Update scheduling system to check for duplicates.

**Sources:**
- [You are not allowed to create a Tweet with duplicate content](https://devcommunity.x.com/t/you-are-not-allowed-to-create-a-tweet-with-duplicate-content/191600)
- [Twitter: Duplicate Status Error](https://help.smarterqueue.com/article/241-twitter-duplicate-status-error)

---

### Pitfall 10: App-Only Auth vs User Context Confusion

**What goes wrong:**
Posting fails with "Authenticating with OAuth 2.0 Application-Only is forbidden for this endpoint. Supported authentication types are [OAuth 1.0a User Context, OAuth 2.0 User Context]". Developer uses bearer token (app-only auth) instead of user context OAuth.

**Why it happens:**
Instagram Graph API uses app-level tokens for many operations. Developer assumes same pattern for X. X requires user context (acting on behalf of a user) for ALL write operations.

**How to avoid:**
- **NEVER use bearer token / app-only auth for posting**
- App-only auth use cases:
  - Reading public tweets
  - Search without user context
  - Public profile data
- User context required for:
  - Creating tweets (POST /2/tweets)
  - Uploading media (POST /2/media/upload)
  - Liking, retweeting, replying
  - Any write operation
- Use OAuth 2.0 PKCE for user context in Tauri desktop app
- Store access token per-user (not app-level token)
- Validate token includes required scopes: `tweet.write media.write`

**Warning signs:**
- "Application-Only is forbidden" error
- Bearer token auth working for some endpoints but not posting
- 403 Forbidden on POST /2/tweets
- Auth flow seems to work but posts fail

**Phase to address:**
Phase 1 (OAuth + Basic Posting) - OAuth implementation must use user context from the start. Document auth type per endpoint.

**Sources:**
- [Authentication - X](https://docs.x.com/fundamentals/authentication/overview)
- [Authenticating with OAuth 2.0 Application-Only is forbidden](https://devcommunity.x.com/t/authenticating-with-oauth-2-0-application-only-is-forbidden-for-this-endpoint-supported-authentication-types-are-oauth-1-0a-user-context-oauth-2-0-user-context/202850)

---

### Pitfall 11: Error Response Format Differs from Instagram

**What goes wrong:**
Error handling code doesn't parse X API errors correctly. Instagram returns errors in different format than X. Partial success scenarios (200 with errors) not handled.

**Why it happens:**
Instagram uses standard Graph API error format. X uses structured error objects with `title`, `detail`, `type` fields. X also supports partial success: 200 response can include both `data` and `errors` arrays.

**How to avoid:**
- Parse X error structure:
  ```json
  {
    "title": "Forbidden",
    "detail": "You are not allowed to create a Tweet with duplicate content.",
    "type": "about:blank",
    "status": 403
  }
  ```
- Check for `errors` array even on 200 responses (partial success)
- Don't reuse Instagram's error parser for X
- Map `type` URI to error categories in application
- Log full error response for debugging
- Handle HTTP status codes:
  - **401**: Token expired/invalid → trigger refresh
  - **403**: Permission issue → show user error
  - **429**: Rate limit → queue and retry with backoff
  - **400**: Validation error → return to user

**Warning signs:**
- Generic "something went wrong" errors shown to users
- Specific error details not logged
- Partial success not detected (user thinks post failed when it succeeded)
- Retry logic triggering on non-retryable errors

**Phase to address:**
Phase 3 (Rate Limiting & Error Handling) - Implement X-specific error parsing. Don't assume Instagram patterns transfer.

**Sources:**
- [Response Codes & Errors - X](https://docs.x.com/x-api/fundamentals/response-codes-and-errors)

---

### Pitfall 12: Video File Size and Format Restrictions Not Validated

**What goes wrong:**
Video upload fails after chunked upload completes. FINALIZE returns validation errors. User wastes bandwidth uploading incompatible video.

**Why it happens:**
Instagram has different video requirements. Developer doesn't validate before upload starts. X has strict requirements: 512MB max (non-premium), MP4/MOV only, H.264 codec, max 1920x1080 resolution.

**How to avoid:**
- Validate before starting upload:
  - **File size**: 512MB max (non-premium), 16GB max (Premium Plus)
  - **Format**: MP4 or MOV only
  - **Codec**: H.264 video, AAC audio
  - **Resolution**: max 1920x1080, min 32x32
  - **Duration**: 2m20s (non-premium), 4hrs (Premium)
  - **Frame rate**: max 40fps (30fps recommended)
  - **Bitrate**: max 25 Mbps
- Show user-friendly error before upload starts
- Offer video transcoding if format incorrect
- Check user's premium status to determine limits
- Document format requirements in UI

**Warning signs:**
- Upload succeeds but FINALIZE fails
- "Unsupported media type" errors
- Processing stuck in "failed" state
- Bandwidth wasted on rejected uploads

**Phase to address:**
Phase 2 (Media Upload) - Add validation before starting chunked upload. Include format checking in media upload flow.

**Sources:**
- [X (Twitter) Video Size & Specifications Guide (Updated 2026)](https://postfa.st/sizes/x/video)
- [Length and size limits on video uploads](https://devcommunity.x.com/t/length-and-size-limits-on-video-uploads-for-verified-and-unverified-users/247448)

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Reusing Instagram's OAuth flow code | Faster implementation | PKCE differences, token lifetime bugs, missing offline.access scope | Never - auth patterns too different |
| Skipping video processing status polling | Simpler upload code | Unreliable video posts, user complaints | Never - async processing is mandatory |
| Client-side rate limiting only | Simpler backend | App-level limits hit unexpectedly, no queuing, DOS vulnerability | Never - app-level limits require server tracking |
| Hardcoding API endpoints | Less config complexity | Broken when endpoints change, environment switching harder | Never - endpoints already changed (v1.1 → v2) |
| Using plain text instead of S256 for PKCE | Slightly simpler crypto | Security vulnerability, may be rejected by X | Never - S256 is required by modern OAuth standards |
| Retrying failed posts without modification | Auto-recovery from transient errors | Duplicate content errors, wasted rate limit quota | Only with exponential backoff AND duplicate detection |

## Integration Gotchas

Common mistakes when connecting to X API from existing Clippster platform.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| OAuth token storage | Storing only access_token like Instagram | Store both access_token AND refresh_token, update both atomically on refresh |
| Media upload | Using single-request upload like Instagram | Always use 3-phase chunked upload for videos (INIT/APPEND/FINALIZE) |
| Rate limit tracking | Per-user tracking like Instagram | Track app-level POST limits across all users, per-user GET limits |
| Error handling | Reusing Instagram error parser | Implement X-specific parser for {title, detail, type} structure |
| Posting endpoint | Using media_url like Instagram | Use media_id from upload response in tweet.media.media_ids array |
| Scope management | Minimal scopes | Always include offline.access, media.write, tweet.write, tweet.read, users.read |
| redirect_uri handling | Dynamic construction | Use exact registered URI from environment variable, no runtime modification |
| Caption length | 2,200 character limit (Instagram) | 280 characters (standard users), 25,000 (Premium) - validate before post |
| Alt text | Optional | Recommended for accessibility, max 1,000 characters, separate metadata endpoint |
| Scheduling | Server-side scheduling API | No native scheduling - must implement cron/worker system (already exists in Clippster) |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| No distributed lock on token refresh | Race condition token invalidation | Implement Redis/DB-based mutex for refresh per user | Multiple workers/instances serving same user |
| Polling video status in HTTP request | Request timeouts, poor UX | Background job polls status, webhook notifies user | Video processing >30s (common for >10MB files) |
| No rate limit headroom buffer | Hitting 429 constantly | Stop posting at 90% of limit, queue remaining | >10 concurrent users posting |
| Synchronous media upload in API request | API timeouts, poor UX | Background job handles chunked upload | Video files >5MB (30s+ upload time) |
| No app-level rate limit dashboard | Can't predict when limits hit | Track app-level usage metrics, alert at 80% | >100 posts/day across all users |
| Retrying 429 errors immediately | Amplifies rate limit problem | Exponential backoff: wait until x-rate-limit-reset time | Any production load |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing code_verifier in localStorage | XSS can steal PKCE verifier | Use session storage, clear after token exchange |
| Not validating state parameter | CSRF attack during OAuth callback | Generate cryptographic random state, validate on callback |
| Logging refresh tokens | Token leak in logs/monitoring | Redact sensitive tokens in logs, never log refresh_token |
| Not implementing scope validation | Over-privileged tokens | Only request needed scopes, validate scope in token response |
| Trusting media_id from client | User could post others' media | Validate media_id ownership before posting |
| No rate limiting per user in app layer | One user can DOS entire app | Enforce per-user limits below X's app-level limits |
| Storing tokens unencrypted | Token theft from DB dump | Encrypt tokens at rest (already implemented in Clippster) |
| Not rotating code_verifier | PKCE replay attacks | Generate new verifier for each OAuth flow |

## UX Pitfalls

Common user experience mistakes in X integration.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Not explaining 2-hour token expiry | "Why do I need to reconnect?" | Proactive refresh, show last refresh time, explain offline.access |
| No progress indicator for video upload | User thinks app is frozen | Show chunked upload progress: "Uploading segment 3/10" |
| Not showing video processing status | User doesn't know if post worked | Show processing state: "Processing video... (5s remaining)" |
| Generic "posting failed" errors | User can't fix the problem | Specific errors: "Video too large (600MB, max 512MB)" |
| Not warning about duplicate content | Confusion when retry fails | "Similar content posted recently. Modify to post again." |
| No indication of rate limit status | Sudden failures surprise users | Show remaining quota: "47,234 posts remaining this month" |
| Posting without waiting for processing | Videos don't appear in tweets | UI blocks posting until processing complete |
| No caption length validation | Post fails after scheduling | Show character count: "45/280" or "145/25,000 (Premium)" |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **OAuth Flow:** Verified `offline.access` scope is included and refresh_token is returned
- [ ] **Token Refresh:** Both access_token AND refresh_token updated atomically on refresh
- [ ] **Video Upload:** Implements all 3 phases (INIT/APPEND/FINALIZE) with status polling
- [ ] **Status Polling:** Checks processing_info and polls until state="succeeded" before posting
- [ ] **Rate Limits:** Tracks app-level POST limits, not just per-user limits
- [ ] **Rate Headers:** Parses x-rate-limit-* headers on every response and logs them
- [ ] **Error Handling:** Parses X error format {title, detail, type}, not reusing Instagram parser
- [ ] **Chunk Upload:** segment_index starts at 0 (zero-based), not 1
- [ ] **redirect_uri:** Exact match including trailing slash, tested in all environments
- [ ] **PKCE Verifier:** 43-128 characters, uses S256 method, cryptographically random
- [ ] **Media Validation:** File size, format, codec, resolution checked BEFORE upload starts
- [ ] **Duplicate Detection:** Application-level deduplication before posting to X API
- [ ] **User Context Auth:** Never uses app-only bearer token for posting endpoints
- [ ] **Scope Validation:** All required scopes present: tweet.write, media.write, offline.access, tweet.read, users.read
- [ ] **Alt Text Support:** Separate metadata endpoint implemented for accessibility
- [ ] **Partial Success:** Checks for errors array even on 200 responses
- [ ] **Token Encryption:** refresh_token encrypted at rest (reuse Clippster's existing encryption)
- [ ] **State Parameter:** CSRF protection via state parameter validation on OAuth callback

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Missing offline.access scope | HIGH | Re-authenticate all users with correct scopes, send notification email |
| Token refresh not updating refresh_token | MEDIUM | Add migration to clear invalid tokens, force re-auth on next access |
| Video upload without status polling | LOW | Add polling to existing upload code, reprocess stuck uploads |
| App-level rate limit hit | LOW | Implement queuing system, retry posts after reset time |
| redirect_uri mismatch | LOW | Update X Developer Portal with correct URI, redeploy with fixed config |
| Duplicate content detection | LOW | Add timestamp/variation to content, wait before retry |
| Wrong auth type (app-only) | MEDIUM | Switch to OAuth 2.0 user context, migrate existing integrations |
| Error format parsing broken | LOW | Add X-specific error parser, update error handling logic |
| Video format validation missing | LOW | Add pre-upload validation, reject incompatible files early |
| No distributed lock on refresh | MEDIUM | Add Redis-based mutex, handle token invalidation gracefully |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Mixed API versions (v1.1 vs v2) | Phase 1 & 2 | Integration tests hit both posting and media endpoints |
| Missing offline.access scope | Phase 1 | Unit test validates refresh_token present in OAuth response |
| Refresh token one-time use | Phase 1 | Test that second refresh with old token fails, new token works |
| Chunked upload required | Phase 2 | Upload 1MB and 100MB videos, verify same code path used |
| Video processing not polled | Phase 2 | Integration test uploads video, verifies polling until "succeeded" |
| App-level rate limits | Phase 3 | Load test with multiple users, verify app-level tracking works |
| redirect_uri exact match | Phase 1 | Test OAuth in dev, staging, prod - all environments |
| PKCE code_verifier length | Phase 1 | Unit test generates 100 verifiers, asserts all 43-128 chars |
| Duplicate content detection | Phase 3 | Test posting same content twice, verify dedup logic catches it |
| App-only vs user context | Phase 1 | Test posting with bearer token, verify correct error handling |
| Error format differences | Phase 3 | Mock X errors, verify parser extracts title/detail/type |
| Video format validation | Phase 2 | Test uploading .avi, .webm, oversized files - all rejected pre-upload |

## Research Gaps and Validation Needed

Areas where research was limited and require phase-specific validation:

**MEDIUM Confidence Areas (verify during implementation):**
- Token refresh behavior under high concurrency (test with multiple workers)
- Exact chunked upload chunk size limits (documentation unclear, test empirically)
- Processing time variance for different video sizes/lengths
- Partial success scenario frequency and patterns
- Premium vs non-premium feature detection via API

**Requires Official Documentation Verification:**
- Media upload v2 endpoint behavior (documentation sparse post-migration)
- Rate limit header behavior across different endpoint types
- Alt text metadata endpoint integration with posting flow

## Sources

**OAuth & Authentication:**
- [OAuth 2.0 Authorization Code Flow with PKCE](https://developer.twitter.com/en/docs/authentication/oauth-2-0/authorization-code)
- [Issues with Accessing Twitter API Using access_token from OAuth 2.0 with PKCE flow](https://devcommunity.x.com/t/issues-with-accessing-twitter-api-using-access-token-from-oauth-2-0-with-pkce-flow/211298)
- [Refresh token expiring (with offline.access scope)](https://devcommunity.x.com/t/refresh-token-expiring-with-offline-access-scope/168899)
- [Refresh token getting frequently expired](https://devcommunity.x.com/t/refresh-token-getting-frequently-expired/240282)
- [Authentication - X](https://docs.x.com/fundamentals/authentication/overview)
- [RFC 7636 - Proof Key for Code Exchange](https://datatracker.ietf.org/doc/html/rfc7636)
- [RFC 9700 - Best Current Practice for OAuth 2.0 Security](https://datatracker.ietf.org/doc/html/rfc9700)

**Media Upload:**
- [Deprecating the v1.1 media upload endpoints](https://devcommunity.x.com/t/deprecating-the-v1-1-media-upload-endpoints/238196)
- [Media Upload Endpoints Update and Extended Migration Deadline](https://devcommunity.x.com/t/media-upload-endpoints-update-and-extended-migration-deadline/241818)
- [Chunked Media Upload - X](https://docs.x.com/x-api/media/quickstart/media-upload-chunked)
- [New Dedicated Endpoints for Chunked Media Upload Broken](https://devcommunity.x.com/t/new-dedicated-endpoints-for-chunked-media-upload-broken/241923)
- [Chunked media upload](https://developer.x.com/en/docs/x-api/v1/media/upload-media/uploading-media/chunked-media-upload)
- [GET media/upload (STATUS)](https://developer.x.com/en/docs/x-api/v1/media/upload-media/api-reference/get-media-upload-status)
- [POST media/upload (FINALIZE)](https://developer.x.com/en/docs/x-api/v1/media/upload-media/api-reference/post-media-upload-finalize)
- [POST media/metadata/create](https://developer.x.com/en/docs/x-api/v1/media/upload-media/api-reference/post-media-metadata-create)
- [Create Media metadata - X](https://docs.x.com/x-api/media/create-media-metadata)

**Rate Limits:**
- [Rate limits - X](https://docs.x.com/x-api/fundamentals/rate-limits)
- [X/Twitter API Pricing 2026: Complete Guide to All Tiers + Alternatives](https://getlate.dev/blog/twitter-api-pricing)
- [X API Rate Limits (Formerly Twitter) - 9meters](https://9meters.com/entertainment/social-media/x-api-rate-limits-formerly-twitter)

**Error Handling:**
- [Response Codes & Errors - X](https://docs.x.com/x-api/fundamentals/response-codes-and-errors)
- [You are not allowed to create a Tweet with duplicate content](https://devcommunity.x.com/t/you-are-not-allowed-to-create-a-tweet-with-duplicate-content/191600)
- [Twitter: Duplicate Status Error](https://help.smarterqueue.com/article/241-twitter-duplicate-status-error)

**Video Requirements:**
- [X (Twitter) Video Size & Specifications Guide (Updated 2026)](https://postfa.st/sizes/x/video)
- [Length and size limits on video uploads](https://devcommunity.x.com/t/length-and-size-limits-on-video-uploads-for-verified-and-unverified-users/247448)

**Other:**
- [How to Fix "Invalid Redirect URI" OAuth2 Errors](https://oneuptime.com/blog/post/2026-01-24-fix-invalid-redirect-uri-oauth2/view)
- [Apps - X](https://docs.x.com/fundamentals/developer-apps)
- [Authenticating with OAuth 2.0 Application-Only is forbidden](https://devcommunity.x.com/t/authenticating-with-oauth-2-0-application-only-is-forbidden-for-this-endpoint-supported-authentication-types-are-oauth-1-0a-user-context-oauth-2-0-user-context/202850)
- [X API - Ayrshare API Documentation](https://www.ayrshare.com/docs/apis/post/social-networks/x-twitter)

---
*Pitfalls research for: X API v2 Posting Integration to Clippster*
*Researched: 2026-02-09*
*Focus: Common mistakes when adding X API to existing Instagram-modeled posting system*
