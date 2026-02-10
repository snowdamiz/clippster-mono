# Architecture Research: X API v2 Posting Integration

**Domain:** Social Media OAuth & Posting Integration (X/Twitter API v2)
**Researched:** 2026-02-09
**Confidence:** HIGH

## Executive Summary

Adding X API v2 posting to Clippster requires adapting the existing Instagram OAuth pattern to handle OAuth 2.0 with PKCE (Proof Key for Code Exchange), implementing chunked media upload for videos, and coordinating between v1.1 media endpoints and v2 tweet endpoints. The key architectural challenge is managing PKCE state (code_verifier) across the OAuth flow while maintaining compatibility with the existing Tauri deep-link callback pattern.

**Critical differences from Instagram:**
1. **PKCE requirement**: code_verifier must be generated client-side, stored during OAuth flow, and sent to token exchange
2. **Split API versions**: Media upload uses v1.1 chunked upload, tweet creation uses v2
3. **Refresh tokens optional**: Requires `offline.access` scope, otherwise tokens expire in 2 hours
4. **Coexistence with existing twitter.ex**: New `twitter_v2.ex` for posting, existing module remains for analytics via twitterapi.io

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          TAURI CLIENT (Desktop)                          │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │ Generate     │→ │ Store        │→ │ Open Browser │                  │
│  │ code_verify  │  │ code_verify  │  │ OAuth URL    │                  │
│  └──────────────┘  └──────────────┘  └──────┬───────┘                  │
│                                              ↓                           │
├──────────────────────────────────────────────┼───────────────────────────┤
│                     PHOENIX SERVER                                       │
├──────────────────────────────────────────────┼───────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │              TwitterV2AuthController                              │   │
│  │                                                                    │   │
│  │  /auth/twitter/start                                              │   │
│  │    - Receives: org_id, callback_port, code_challenge,            │   │
│  │                code_challenge_method, auth_token                  │   │
│  │    - Validates: user permissions                                  │   │
│  │    - Creates: state (base64(JSON{org_id, callback_port,          │   │
│  │               user_id, timestamp}))                               │   │
│  │    - Redirects: X OAuth with state + code_challenge               │   │
│  │                                                                    │   │
│  │  /auth/twitter/callback                                           │   │
│  │    - Receives: code, state                                        │   │
│  │    - Decodes: state → extract org_id, callback_port              │   │
│  │    - REQUIRES: code_verifier from client (via state or session)  │   │
│  │    - Calls: TwitterV2.exchange_code(code, code_verifier, opts)   │   │
│  │    - Creates: SocialAccount record                                │   │
│  │    - Redirects: Tauri deep link callback                          │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │         Social.Platforms.TwitterV2 (NEW MODULE)                   │   │
│  │                                                                    │   │
│  │  @behaviour Platform                                              │   │
│  │                                                                    │   │
│  │  exchange_code(code, code_verifier, opts)                        │   │
│  │    POST https://api.x.com/2/oauth2/token                         │   │
│  │    Body: grant_type=authorization_code,                          │   │
│  │          code=..., redirect_uri=...,                             │   │
│  │          code_verifier=..., client_id=...                        │   │
│  │    Returns: {access_token, refresh_token, expires_in, scope}    │   │
│  │                                                                    │   │
│  │  refresh_tokens(refresh_token)                                   │   │
│  │    POST https://api.x.com/2/oauth2/token                         │   │
│  │    Body: grant_type=refresh_token,                               │   │
│  │          refresh_token=..., client_id=...                        │   │
│  │                                                                    │   │
│  │  get_user_profile(access_token)                                  │   │
│  │    GET https://api.x.com/2/users/me                              │   │
│  │    Headers: Authorization: Bearer {access_token}                 │   │
│  │                                                                    │   │
│  │  publish_media(access_token, media_url, opts)                    │   │
│  │    1. Download video from media_url                              │   │
│  │    2. Upload via chunked_upload(access_token, video_binary)      │   │
│  │    3. create_tweet(access_token, media_id, caption)              │   │
│  │                                                                    │   │
│  │  chunked_upload(access_token, video_binary)                      │   │
│  │    INIT:   POST /2/media/upload?command=INIT                     │   │
│  │            → media_id, media_key                                  │   │
│  │    APPEND: POST /2/media/upload?command=APPEND                   │   │
│  │            (loop for each chunk)                                  │   │
│  │    FINALIZE: POST /2/media/upload?command=FINALIZE               │   │
│  │    STATUS: GET /2/media/upload?command=STATUS (poll until ready) │   │
│  │    Returns: media_id                                              │   │
│  │                                                                    │   │
│  │  create_tweet(access_token, media_id, text)                      │   │
│  │    POST https://api.x.com/2/tweets                               │   │
│  │    Headers: Authorization: Bearer {access_token}                 │   │
│  │    Body: {text: "...", media: {media_ids: [media_id]}}           │   │
│  │    Returns: {id, text}                                            │   │
│  │                                                                    │   │
│  │  get_insights(access_token, post_id)                             │   │
│  │    NOT IMPLEMENTED - delegate to existing twitter.ex             │   │
│  │    (X API v2 metrics require Elevated access tier)               │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │         Social.Platforms.Twitter (EXISTING - UNCHANGED)           │   │
│  │                                                                    │   │
│  │  get_tweet_analytics(tweet_id)                                   │   │
│  │    Uses twitterapi.io third-party service                        │   │
│  │    Returns: {view_count, like_count, ...}                        │   │
│  │                                                                    │   │
│  │  NO POSTING - read-only analytics only                           │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │              ScheduledPostWorker (MODIFIED)                       │   │
│  │                                                                    │   │
│  │  - Polls post_submissions every 1 minute                         │   │
│  │  - Detects platform="twitter", status="scheduled"                │   │
│  │  - Calls Platform.call("twitter", :publish_media, [...])         │   │
│  │    → Routes to TwitterV2.publish_media (via Platform behavior)   │   │
│  │  - Handles chunked upload + tweet creation flow                  │   │
│  │  - Updates post_submission with post_id, post_url                │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │           TokenRefreshWorker (EXISTING - WORKS AS-IS)             │   │
│  │                                                                    │   │
│  │  - Polls every 12 hours                                           │   │
│  │  - Detects token_expires_at within 1 day                         │   │
│  │  - Calls Platform.call("twitter", :refresh_tokens, [token])      │   │
│  │    → Routes to TwitterV2.refresh_tokens                           │   │
│  │  - Updates encrypted access_token, refresh_token in DB           │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | Integration Points |
|-----------|----------------|-------------------|
| **Tauri Client** | Generate code_verifier (128 bytes random), create code_challenge (SHA256 + base64url), manage OAuth state storage, handle deep link callback | Opens browser to `/auth/twitter/start`, receives callback via deep link |
| **TwitterV2AuthController** | Handle OAuth 2.0 PKCE flow, manage state parameter, exchange code for tokens, create SocialAccount | Calls TwitterV2 module, redirects to Tauri callback |
| **TwitterV2 Module** | Implement Platform behavior, OAuth token exchange with code_verifier, chunked media upload (INIT/APPEND/FINALIZE/STATUS), tweet creation with media_id, token refresh | Called by controller (OAuth), ScheduledPostWorker (posting), TokenRefreshWorker (refresh) |
| **Twitter Module (existing)** | Analytics via twitterapi.io, read-only operations | Used by analytics sync for published tweets, no posting |
| **Platform Behavior** | Routing abstraction, get_platform_module("twitter") → TwitterV2, consistent interface across platforms | Used by workers to call platform-specific implementations |
| **ScheduledPostWorker** | Poll scheduled posts, route to correct platform module, handle publish failures, optimistic locking | Calls Platform.call("twitter", :publish_media, [...]) |
| **TokenRefreshWorker** | Refresh tokens before expiry (1 day threshold), update encrypted tokens in DB | Calls Platform.call("twitter", :refresh_tokens, [token]) |
| **SocialAccount Schema** | Store encrypted access_token, refresh_token, token_expires_at, platform="twitter" | Read/written by OAuth controller, workers |

## Data Flow

### OAuth 2.0 PKCE Flow (Tauri → Server → X → Server → Tauri)

```
1. Tauri Client Initiates
   ┌─────────────────────────────────────────────────────────────┐
   │ Client generates:                                            │
   │   code_verifier = random_bytes(128) |> base64url_encode     │
   │   code_challenge = SHA256(code_verifier) |> base64url_encode│
   │                                                               │
   │ Client stores code_verifier in memory/session                │
   │                                                               │
   │ Client calls:                                                │
   │   GET /auth/twitter/start?organization_id=123               │
   │       &callback_port=9876                                    │
   │       &code_challenge={challenge}                            │
   │       &code_challenge_method=S256                            │
   │       &auth_token={jwt}                                      │
   └─────────────────────────────────────────────────────────────┘
                              ↓
2. Server Creates OAuth URL
   ┌─────────────────────────────────────────────────────────────┐
   │ Controller validates auth_token → user                       │
   │ Controller creates state:                                    │
   │   state = base64url({                                        │
   │     org_id: 123,                                             │
   │     callback_port: 9876,                                     │
   │     user_id: 456,                                            │
   │     timestamp: 1738234567,                                   │
   │     code_challenge: {challenge} ← STORE FOR TOKEN EXCHANGE  │
   │   })                                                         │
   │                                                               │
   │ Redirects browser to:                                        │
   │   https://x.com/i/oauth2/authorize?                         │
   │     response_type=code&                                      │
   │     client_id={client_id}&                                   │
   │     redirect_uri={server_callback}&                          │
   │     scope=tweet.read tweet.write users.read offline.access& │
   │     state={state}&                                           │
   │     code_challenge={challenge}&                              │
   │     code_challenge_method=S256                               │
   └─────────────────────────────────────────────────────────────┘
                              ↓
3. User Authorizes on X
   ┌─────────────────────────────────────────────────────────────┐
   │ User clicks "Authorize app"                                  │
   │ X redirects to:                                              │
   │   {server_callback}?code={auth_code}&state={state}          │
   └─────────────────────────────────────────────────────────────┘
                              ↓
4. Server Exchanges Code for Token
   ┌─────────────────────────────────────────────────────────────┐
   │ Controller receives code + state                             │
   │ Decodes state → extract org_id, callback_port, code_challenge│
   │                                                               │
   │ PROBLEM: code_verifier is on CLIENT, not in state!          │
   │                                                               │
   │ SOLUTION OPTIONS:                                            │
   │   A. Client includes code_verifier in start request params   │
   │      → Store in state (less secure, verifier exposed)        │
   │   B. Client calls exchange endpoint POST with code + verifier│
   │      → Server validates state, client sends verifier         │
   │   C. Server generates verifier, stores in session/cache      │
   │      → Not PKCE-compliant (defeats purpose of client-side)   │
   │                                                               │
   │ RECOMMENDED: Option B (two-step flow)                        │
   │   - Server receives callback, validates state                │
   │   - Server redirects to Tauri with code + state              │
   │   - Tauri calls POST /auth/twitter/exchange with:            │
   │       {code, state, code_verifier}                           │
   │   - Server exchanges code for token                          │
   └─────────────────────────────────────────────────────────────┘
                              ↓
5. Token Exchange (REVISED FLOW)
   ┌─────────────────────────────────────────────────────────────┐
   │ Tauri receives redirect:                                     │
   │   http://localhost:9876/twitter-callback?code=...&state=...  │
   │                                                               │
   │ Tauri retrieves code_verifier from memory                    │
   │                                                               │
   │ Tauri calls server:                                          │
   │   POST /api/auth/twitter/exchange                            │
   │   Body: {                                                    │
   │     code: "...",                                             │
   │     state: "...",                                            │
   │     code_verifier: "..."                                     │
   │   }                                                          │
   │                                                               │
   │ Server validates state → extract org_id, user_id             │
   │                                                               │
   │ Server calls TwitterV2.exchange_code(code, code_verifier):  │
   │   POST https://api.x.com/2/oauth2/token                     │
   │   Content-Type: application/x-www-form-urlencoded            │
   │   Body:                                                      │
   │     grant_type=authorization_code                            │
   │     code={auth_code}                                         │
   │     redirect_uri={server_callback}                           │
   │     code_verifier={code_verifier}                            │
   │     client_id={client_id}                                    │
   │                                                               │
   │ X responds:                                                  │
   │   {                                                          │
   │     access_token: "...",                                     │
   │     refresh_token: "..." (if offline.access scope),          │
   │     expires_in: 7200,                                        │
   │     scope: "tweet.read tweet.write users.read offline.access"│
   │   }                                                          │
   └─────────────────────────────────────────────────────────────┘
                              ↓
6. Get User Profile
   ┌─────────────────────────────────────────────────────────────┐
   │ Server calls TwitterV2.get_user_profile(access_token):      │
   │   GET https://api.x.com/2/users/me                          │
   │   Headers: Authorization: Bearer {access_token}              │
   │                                                               │
   │ X responds:                                                  │
   │   {                                                          │
   │     data: {                                                  │
   │       id: "12345",                                           │
   │       username: "johndoe",                                   │
   │       name: "John Doe",                                      │
   │       profile_image_url: "https://..."                       │
   │     }                                                        │
   │   }                                                          │
   └─────────────────────────────────────────────────────────────┘
                              ↓
7. Create SocialAccount
   ┌─────────────────────────────────────────────────────────────┐
   │ Server creates organization_social_accounts record:          │
   │   platform: "twitter"                                        │
   │   platform_user_id: "12345"                                  │
   │   username: "johndoe"                                        │
   │   display_name: "John Doe"                                   │
   │   access_token_encrypted: encrypt(access_token)              │
   │   refresh_token_encrypted: encrypt(refresh_token)            │
   │   token_expires_at: now + 7200 seconds                       │
   │   connected_at: now                                          │
   │   is_active: true                                            │
   │                                                               │
   │ Server responds to Tauri:                                    │
   │   {success: true, account: {...}}                            │
   └─────────────────────────────────────────────────────────────┘
```

### Chunked Video Upload Flow (ScheduledPostWorker → TwitterV2 → X)

```
1. Worker Triggers Publish
   ┌─────────────────────────────────────────────────────────────┐
   │ ScheduledPostWorker polls post_submissions                   │
   │ Finds: status="scheduled", scheduled_at <= now               │
   │ Locks post: status="publishing", locked_at=now               │
   │                                                               │
   │ Retrieves SocialAccount (platform="twitter")                 │
   │ Decrypts access_token                                        │
   │                                                               │
   │ Calls Platform.call("twitter", :publish_media, [             │
   │   access_token,                                              │
   │   post.media_url,                                            │
   │   %{caption: post.caption, media_type: "video"}              │
   │ ])                                                           │
   └─────────────────────────────────────────────────────────────┘
                              ↓
2. TwitterV2.publish_media Orchestrates
   ┌─────────────────────────────────────────────────────────────┐
   │ def publish_media(access_token, media_url, opts) do          │
   │   # Download video from R2/storage                           │
   │   {:ok, video_binary} = download_video(media_url)            │
   │                                                               │
   │   # Upload via chunked upload                                │
   │   {:ok, media_id} = chunked_upload(access_token, video_binary)│
   │                                                               │
   │   # Create tweet with media                                  │
   │   {:ok, tweet} = create_tweet(access_token, media_id, opts)  │
   │                                                               │
   │   {:ok, %{                                                   │
   │     post_id: tweet.data.id,                                  │
   │     post_url: "https://x.com/{username}/status/#{id}",       │
   │     media_type: "video"                                      │
   │   }}                                                         │
   │ end                                                          │
   └─────────────────────────────────────────────────────────────┘
                              ↓
3. Chunked Upload: INIT
   ┌─────────────────────────────────────────────────────────────┐
   │ POST https://api.x.com/2/media/upload                       │
   │ Content-Type: application/x-www-form-urlencoded              │
   │ Authorization: Bearer {access_token}                         │
   │                                                               │
   │ Body:                                                        │
   │   command=INIT                                               │
   │   total_bytes=15728640 (15MB)                                │
   │   media_type=video/mp4                                       │
   │   media_category=tweet_video                                 │
   │                                                               │
   │ Response:                                                    │
   │   {                                                          │
   │     media_id: 1234567890,                                    │
   │     media_key: "7_1234567890"                                │
   │   }                                                          │
   └─────────────────────────────────────────────────────────────┘
                              ↓
4. Chunked Upload: APPEND (Loop for Each Chunk)
   ┌─────────────────────────────────────────────────────────────┐
   │ Split video into chunks (max 5MB per chunk)                  │
   │ chunk_size = 5 * 1024 * 1024 (5MB)                          │
   │ chunks = split_binary(video_binary, chunk_size)              │
   │                                                               │
   │ Enum.each_with_index(chunks, fn chunk, index ->             │
   │   POST https://api.x.com/2/media/upload                     │
   │   Content-Type: multipart/form-data                          │
   │   Authorization: Bearer {access_token}                       │
   │                                                               │
   │   Body (multipart):                                          │
   │     command=APPEND                                           │
   │     media_id=1234567890                                      │
   │     segment_index={index}                                    │
   │     media={chunk_binary}                                     │
   │                                                               │
   │   Response: 204 No Content (success)                         │
   │ end)                                                         │
   └─────────────────────────────────────────────────────────────┘
                              ↓
5. Chunked Upload: FINALIZE
   ┌─────────────────────────────────────────────────────────────┐
   │ POST https://api.x.com/2/media/upload                       │
   │ Content-Type: application/x-www-form-urlencoded              │
   │ Authorization: Bearer {access_token}                         │
   │                                                               │
   │ Body:                                                        │
   │   command=FINALIZE                                           │
   │   media_id=1234567890                                        │
   │                                                               │
   │ Response:                                                    │
   │   {                                                          │
   │     media_id: 1234567890,                                    │
   │     processing_info: {                                       │
   │       state: "pending",                                      │
   │       check_after_secs: 5                                    │
   │     }                                                        │
   │   }                                                          │
   └─────────────────────────────────────────────────────────────┘
                              ↓
6. Chunked Upload: STATUS (Poll Until Ready)
   ┌─────────────────────────────────────────────────────────────┐
   │ Wait 5 seconds (from check_after_secs)                       │
   │                                                               │
   │ GET https://api.x.com/2/media/upload?                       │
   │     command=STATUS&media_id=1234567890                       │
   │ Authorization: Bearer {access_token}                         │
   │                                                               │
   │ Response (if still processing):                              │
   │   {                                                          │
   │     media_id: 1234567890,                                    │
   │     processing_info: {                                       │
   │       state: "in_progress",                                  │
   │       check_after_secs: 10,                                  │
   │       progress_percent: 45                                   │
   │     }                                                        │
   │   }                                                          │
   │                                                               │
   │ Response (when complete):                                    │
   │   {                                                          │
   │     media_id: 1234567890,                                    │
   │     processing_info: {                                       │
   │       state: "succeeded"                                     │
   │     }                                                        │
   │   }                                                          │
   │                                                               │
   │ Poll with exponential backoff, max 30 attempts (5 min total) │
   └─────────────────────────────────────────────────────────────┘
                              ↓
7. Create Tweet with Media
   ┌─────────────────────────────────────────────────────────────┐
   │ POST https://api.x.com/2/tweets                             │
   │ Content-Type: application/json                               │
   │ Authorization: Bearer {access_token}                         │
   │                                                               │
   │ Body:                                                        │
   │   {                                                          │
   │     text: "Check out this clip! #gaming",                    │
   │     media: {                                                 │
   │       media_ids: ["1234567890"]                              │
   │     }                                                        │
   │   }                                                          │
   │                                                               │
   │ Response:                                                    │
   │   {                                                          │
   │     data: {                                                  │
   │       id: "9876543210",                                      │
   │       text: "Check out this clip! #gaming"                   │
   │     }                                                        │
   │   }                                                          │
   └─────────────────────────────────────────────────────────────┘
                              ↓
8. Update PostSubmission
   ┌─────────────────────────────────────────────────────────────┐
   │ Worker calls Social.mark_post_published(post, %{             │
   │   post_id: "9876543210",                                     │
   │   post_url: "https://x.com/johndoe/status/9876543210",       │
   │   posted_at: now                                             │
   │ })                                                           │
   │                                                               │
   │ Updates post_submissions:                                    │
   │   status: "published"                                        │
   │   post_id: "9876543210"                                      │
   │   post_url: "https://x.com/johndoe/status/9876543210"        │
   │   posted_at: 2026-02-09T12:34:56Z                            │
   │   completed_at: 2026-02-09T12:34:56Z                         │
   └─────────────────────────────────────────────────────────────┘
```

## Integration Points

### New Components

| Component | File Path | Purpose |
|-----------|-----------|---------|
| **TwitterV2AuthController** | `server/lib/clippster_server_web/controllers/twitter_v2_auth_controller.ex` | Handle OAuth 2.0 PKCE flow, manage state, exchange code with code_verifier |
| **TwitterV2 Module** | `server/lib/clippster_server/social/platforms/twitter_v2.ex` | Platform behavior implementation for X API v2 posting |
| **PKCE Helper** | `server/lib/clippster_server/social/pkce.ex` | Generate code_challenge from code_verifier, validate S256 method |

### Modified Components

| Component | Modification | Reason |
|-----------|--------------|--------|
| **Platform Behavior** | Update `get_platform_module("twitter")` to return TwitterV2 instead of Twitter | Route posting to TwitterV2, analytics still use Twitter |
| **InstagramAuthController** | NO CHANGE (reference only) | Pattern to follow for TwitterV2AuthController |
| **ScheduledPostWorker** | NO CODE CHANGE (already polymorphic via Platform.call) | Existing Platform.call abstraction handles routing |
| **TokenRefreshWorker** | NO CODE CHANGE | TwitterV2.refresh_tokens implements behavior contract |

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **X OAuth 2.0** | HTTPS POST to `https://api.x.com/2/oauth2/token` | Code exchange requires `code_verifier`, refresh requires `refresh_token` + `client_id` |
| **X Media Upload (v2)** | HTTPS POST to `https://api.x.com/2/media/upload` | Chunked upload with INIT/APPEND/FINALIZE/STATUS commands |
| **X Tweet Creation (v2)** | HTTPS POST to `https://api.x.com/2/tweets` | Requires `tweet.write` scope, accepts media_ids array |
| **X User Profile (v2)** | HTTPS GET to `https://api.x.com/2/users/me` | Returns id, username, name, profile_image_url |
| **twitterapi.io (existing)** | HTTPS GET to `https://api.twitterapi.io/twitter/tweets` | Third-party analytics, NO CHANGE |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **Tauri ↔ TwitterV2AuthController** | HTTP GET `/auth/twitter/start` (initiates OAuth), HTTP POST `/api/auth/twitter/exchange` (exchanges code) | Client generates code_verifier, server handles OAuth redirect |
| **TwitterV2AuthController ↔ TwitterV2 Module** | Direct function calls (exchange_code, get_user_profile) | Controller validates permissions, module handles API calls |
| **ScheduledPostWorker ↔ TwitterV2 Module** | Platform.call("twitter", :publish_media, [...]) | Polymorphic dispatch via behavior |
| **TwitterV2 Module ↔ X API** | HTTPS with OAuth 2.0 Bearer token | All requests require `Authorization: Bearer {access_token}` |
| **TwitterV2 ↔ Twitter (coexistence)** | NO DIRECT COMMUNICATION | TwitterV2 for posting, Twitter for analytics (separate concerns) |

## Architectural Patterns

### Pattern 1: OAuth 2.0 PKCE with Server-Side Token Exchange

**What:** Client generates code_verifier, creates code_challenge, server exchanges code using client-provided code_verifier

**When to use:** OAuth 2.0 flows requiring PKCE (public clients, desktop apps)

**Trade-offs:**
- **Pro**: Secure against authorization code interception attacks
- **Pro**: No client secret exposure (client_id only)
- **Con**: More complex than server-side OAuth (Instagram pattern)
- **Con**: Client must manage code_verifier state across redirects

**Implementation:**

```elixir
# Client-side (Tauri/TypeScript)
defmodule Client.PKCE do
  def generate_code_verifier do
    :crypto.strong_rand_bytes(128)
    |> Base.url_encode64(padding: false)
  end

  def generate_code_challenge(code_verifier) do
    :crypto.hash(:sha256, code_verifier)
    |> Base.url_encode64(padding: false)
  end
end

# Example flow
code_verifier = Client.PKCE.generate_code_verifier()
code_challenge = Client.PKCE.generate_code_challenge(code_verifier)

# Store code_verifier in memory
Application.put_env(:app, :pkce_verifier, code_verifier)

# Call server to start OAuth
GET /auth/twitter/start?
  organization_id=123&
  callback_port=9876&
  code_challenge={code_challenge}&
  code_challenge_method=S256
```

```elixir
# Server-side controller
defmodule TwitterV2AuthController do
  def exchange_code(conn, %{"code" => code, "state" => state, "code_verifier" => code_verifier}) do
    # Decode state to get org_id, user_id
    {:ok, state_data} = decode_state(state)

    # Exchange code with code_verifier
    case TwitterV2.exchange_code(code, code_verifier, %{
      client_id: config[:client_id],
      redirect_uri: callback_url
    }) do
      {:ok, token_data} ->
        # Create social account
        create_social_account(state_data.org_id, token_data)

      {:error, reason} ->
        json(conn, %{success: false, error: reason})
    end
  end
end
```

### Pattern 2: Chunked Upload with Status Polling

**What:** Split large files into chunks, upload sequentially, poll for processing completion

**When to use:** Video uploads to X API, files >5MB, long processing times

**Trade-offs:**
- **Pro**: Resumable uploads (can retry individual chunks)
- **Pro**: Handles large files without timeout
- **Pro**: Progress tracking (segment_index, progress_percent)
- **Con**: More complex than single upload
- **Con**: Requires polling logic with exponential backoff

**Implementation:**

```elixir
defmodule TwitterV2.ChunkedUpload do
  @chunk_size 5 * 1024 * 1024  # 5MB
  @max_poll_attempts 30
  @initial_wait_time 5_000  # 5 seconds

  def upload(access_token, video_binary) do
    total_bytes = byte_size(video_binary)

    # INIT
    {:ok, media_id} = init_upload(access_token, total_bytes, "video/mp4")

    # APPEND (chunked)
    chunks = split_into_chunks(video_binary, @chunk_size)
    :ok = append_chunks(access_token, media_id, chunks)

    # FINALIZE
    {:ok, processing_info} = finalize_upload(access_token, media_id)

    # STATUS (poll)
    {:ok, media_id} = poll_until_ready(access_token, media_id, processing_info)

    {:ok, media_id}
  end

  defp init_upload(access_token, total_bytes, media_type) do
    url = "https://api.x.com/2/media/upload"
    headers = [
      {"Authorization", "Bearer #{access_token}"},
      {"Content-Type", "application/x-www-form-urlencoded"}
    ]
    body = URI.encode_query(%{
      "command" => "INIT",
      "total_bytes" => total_bytes,
      "media_type" => media_type,
      "media_category" => "tweet_video"
    })

    case HTTPoison.post(url, body, headers) do
      {:ok, %{status_code: 200, body: response_body}} ->
        %{"media_id" => media_id} = Jason.decode!(response_body)
        {:ok, media_id}
      {:error, reason} ->
        {:error, reason}
    end
  end

  defp append_chunks(access_token, media_id, chunks) do
    chunks
    |> Enum.with_index()
    |> Enum.each(fn {chunk, index} ->
      append_chunk(access_token, media_id, chunk, index)
    end)

    :ok
  end

  defp append_chunk(access_token, media_id, chunk_data, segment_index) do
    url = "https://api.x.com/2/media/upload"
    headers = [{"Authorization", "Bearer #{access_token}"}]

    # Multipart form data
    multipart = [
      {"command", "APPEND"},
      {"media_id", to_string(media_id)},
      {"segment_index", to_string(segment_index)},
      {:file, chunk_data, {"form-data", [name: "media"]}}
    ]

    case HTTPoison.post(url, {:multipart, multipart}, headers) do
      {:ok, %{status_code: 204}} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  defp poll_until_ready(access_token, media_id, processing_info, attempt \\ 0) do
    if attempt >= @max_poll_attempts do
      {:error, :processing_timeout}
    else
      wait_time = processing_info["check_after_secs"] || 5
      Process.sleep(wait_time * 1000)

      case get_status(access_token, media_id) do
        {:ok, %{"processing_info" => %{"state" => "succeeded"}}} ->
          {:ok, media_id}

        {:ok, %{"processing_info" => %{"state" => "failed", "error" => error}}} ->
          {:error, {:processing_failed, error}}

        {:ok, %{"processing_info" => info}} ->
          poll_until_ready(access_token, media_id, info, attempt + 1)
      end
    end
  end
end
```

### Pattern 3: Dual Module Coexistence (TwitterV2 + Twitter)

**What:** Two platform modules for same social network, one for posting (v2 API), one for analytics (third-party)

**When to use:** API version split, feature availability differences, migration periods

**Trade-offs:**
- **Pro**: Separates concerns (posting vs analytics)
- **Pro**: Can use best API for each feature
- **Pro**: No breaking changes to existing analytics
- **Con**: Confusion about which module to use
- **Con**: Potential for inconsistent error handling

**Implementation:**

```elixir
# Platform routing
defmodule ClippsterServer.Social.Platform do
  def get_platform_module("twitter"), do: {:ok, TwitterV2}  # For posting
  def get_platform_module("twitter_analytics"), do: {:ok, Twitter}  # For analytics
end

# ScheduledPostWorker uses TwitterV2 (posting)
Platform.call("twitter", :publish_media, [access_token, media_url, opts])

# AnalyticsSyncWorker uses Twitter (analytics via twitterapi.io)
Twitter.get_tweet_analytics(tweet_id)

# Clear documentation in module headers
defmodule TwitterV2 do
  @moduledoc """
  X API v2 integration for posting tweets with media.

  Responsibilities:
  - OAuth 2.0 with PKCE authentication
  - Chunked media upload (v2 endpoint)
  - Tweet creation (v2 endpoint)
  - Token refresh

  Does NOT handle analytics (use Twitter module).
  """
end

defmodule Twitter do
  @moduledoc """
  Read-only Twitter analytics via twitterapi.io third-party service.

  Responsibilities:
  - Fetch tweet analytics (views, likes, etc.)

  Does NOT handle posting (use TwitterV2 module).
  """
end
```

## Anti-Patterns

### Anti-Pattern 1: Storing code_verifier in Server State

**What people might do:** Server generates code_verifier, stores in session/cache, uses for token exchange

**Why it's wrong:** Defeats the purpose of PKCE (proof that client initiated the request), violates OAuth 2.0 PKCE spec, introduces server-side state management complexity

**Do this instead:**
1. Client generates code_verifier
2. Client stores in memory/local storage
3. Client sends code_verifier to server during token exchange POST
4. Server validates but never stores code_verifier

### Anti-Pattern 2: Single Upload for Large Videos

**What people might do:** Upload entire video file in single POST request

**Why it's wrong:**
- X API rejects videos >512MB
- Request timeout for large files (140s max duration = ~25MB at recommended bitrate)
- No retry on network failure (upload fails = start over)
- No progress tracking

**Do this instead:**
- Always use chunked upload for videos
- Split into 5MB chunks
- Retry individual chunks on failure
- Poll STATUS endpoint until processing completes

### Anti-Pattern 3: Using v1.1 Media Upload Endpoint

**What people might do:** Continue using `https://upload.twitter.com/1.1/media/upload.json`

**Why it's wrong:**
- X announced migration to v2 endpoints (deadline: May 30, 2025)
- v1.1 endpoints may be deprecated
- v2 endpoints required for OAuth 2.0 tokens

**Do this instead:**
- Use v2 endpoint: `https://api.x.com/2/media/upload`
- OAuth 2.0 Bearer token in Authorization header
- Same chunked upload flow (INIT/APPEND/FINALIZE/STATUS)

### Anti-Pattern 4: Combining TwitterV2 and Twitter into One Module

**What people might do:** Add posting methods to existing Twitter module

**Why it's wrong:**
- Mixes concerns (posting vs analytics)
- Different authentication (OAuth 2.0 vs API key)
- Creates dependency on twitterapi.io for core posting feature
- Harder to test and maintain

**Do this instead:**
- Separate modules with clear responsibilities
- TwitterV2: Official X API v2, OAuth 2.0, posting
- Twitter: twitterapi.io, API key, analytics only
- Document which module to use for each feature

## Video Format Specifications

Based on X API v2 documentation:

| Specification | Requirement | Notes |
|---------------|-------------|-------|
| **Formats** | MP4, MOV | Prefer MP4 for best compatibility |
| **Video Codec** | H.264 High Profile | YUV 4:2:0 pixel format only |
| **Audio Codec** | AAC LC (Low Complexity) | Stereo or mono, no 5.1+ |
| **Max File Size** | 512 MB | Standard API tier (non-premium) |
| **Duration** | 0.5s to 140s (2:20) | Premium users can upload longer via web, not API |
| **Resolution** | 32×32 to 1920×1080 | Recommended: 1280x720 (landscape), 720x1280 (portrait) |
| **Aspect Ratio** | 1:3 to 3:1 (exclusive) | Must have 1:1 pixel aspect ratio |
| **Frame Rate** | Max 40 FPS | Recommended: 30 FPS or 60 FPS |
| **Bitrate (Video)** | Max 25 Mbps | Min 5,000 kbps |
| **Bitrate (Audio)** | Min 128 kbps | Stereo, AAC LC |
| **Scan Type** | Progressive | No interlaced |
| **GOP** | No open GOP | Closed GOP only |

## Token Lifecycle

| Stage | Duration | Refresh Strategy |
|-------|----------|------------------|
| **Initial Token** | 2 hours (7200s) | Access token expires quickly |
| **Refresh Token** | Long-lived (no specified expiry) | Only issued with `offline.access` scope |
| **Refresh Window** | 1 day before expiry | TokenRefreshWorker checks every 12h, refreshes if expires_at < now + 1 day |
| **Refresh Endpoint** | `POST /2/oauth2/token` | `grant_type=refresh_token`, requires `client_id` + `refresh_token` |

**CRITICAL**: Always include `offline.access` scope in authorization request, otherwise no refresh_token is issued and user must re-authorize every 2 hours.

## Sources

- [OAuth 2.0 Authorization Code Flow with PKCE - X](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code)
- [Chunked Media Upload - X](https://docs.x.com/x-api/media/quickstart/media-upload-chunked)
- [Create or Edit Post - X](https://docs.x.com/x-api/posts/create-post)
- [RFC 7636 - Proof Key for Code Exchange by OAuth Public Clients](https://tools.ietf.org/html/rfc7636)
- [Media Best Practices | X Developer Platform](https://developer.x.com/en/docs/x-api/v1/media/upload-media/uploading-media/media-best-practices)
- [X (Twitter) Video Size & Specifications Guide (Updated 2026)](https://postfa.st/sizes/x/video)
- [How to connect to endpoints using OAuth 2.0 Authorization Code Flow with PKCE - X](https://docs.x.com/fundamentals/authentication/oauth-2-0/user-access-token)
- [Assent.Strategy.OAuth2 — Assent v0.3.1](https://hexdocs.pm/assent/Assent.Strategy.OAuth2.html)

---
*Architecture research for X API v2 posting integration*
*Researched: 2026-02-09*
