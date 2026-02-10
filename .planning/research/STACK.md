# Stack Research

**Domain:** X (Twitter) API v2 OAuth 2.0 with PKCE and Tweet Posting Integration
**Researched:** 2026-02-09
**Confidence:** MEDIUM

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| X API v2 | v2 (latest) | Tweet creation, media upload, user authentication | Current standard for X integrations. v1.1 endpoints deprecated/deprecating. OAuth 2.0 with PKCE is the modern auth flow. |
| HTTPoison | ~> 2.2 (existing) | HTTP client for API calls | Already in use for Instagram integration. Sufficient for X API needs. Consider migration to Req for new code. |
| Built-in Crypto | Elixir `:crypto` | PKCE code verifier/challenge generation | Native Elixir/Erlang crypto library. No external dependencies needed for SHA256 hashing and base64 encoding. |
| Jason | ~> 1.2 (existing) | JSON encoding/decoding | Already in use. X API v2 uses JSON payloads exclusively. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **None Required** | - | PKCE implementation | Implement PKCE directly using `:crypto` - simpler than adding OAuth library dependency |
| oauth2 | ~> 2.1 (optional) | OAuth 2.0 client scaffold | Only if you want abstraction layer. **Does NOT support PKCE out-of-box** - would need custom implementation anyway |
| Req | ~> 0.5 (future) | Modern HTTP client | Consider for new API integrations. More modern than HTTPoison, but not required for X API migration |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| X Developer Portal | API credentials, app config | Required for OAuth 2.0 client setup. Free tier supports write operations (500 posts/month) |
| cURL / Postman | API testing | Useful for testing PKCE flow and media upload endpoints during development |

## Installation

```elixir
# mix.exs - NO NEW DEPENDENCIES REQUIRED
# Use existing HTTPoison, Jason, and built-in :crypto

defp deps do
  [
    # ... existing deps ...
    {:httpoison, "~> 2.2"},  # Already present
    {:jason, "~> 1.2"},       # Already present
    # :crypto is built-in to Erlang/Elixir
  ]
end
```

**Optional: If adding Req for future HTTP client modernization**
```elixir
{:req, "~> 0.5"}  # Latest as of Jan 2026
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Direct HTTP (HTTPoison/Req) | oauth2 library (~> 2.1) | If you want OAuth abstraction. However, **PKCE not supported** - you'd implement PKCE manually regardless. Direct HTTP is simpler. |
| Built-in `:crypto` for PKCE | External PKCE library | No mature Elixir PKCE library exists. Assent has PKCE but is full auth framework (overkill). Direct implementation is 10-15 lines of code. |
| HTTPoison (existing) | Req (~> 0.5) | For new projects, Req is recommended (modern, batteries-included). For incremental feature add, HTTPoison is sufficient - avoid churn. |
| HTTPoison | Tesla | Tesla has swappable adapters but relies on metaprogramming and module config. Less ergonomic than Req or direct HTTPoison. |
| X API v2 | X API v1.1 | **Never.** v1.1 media endpoints deprecated June 2025. OAuth 1.0a is legacy. Always use v2 + OAuth 2.0. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| X API v1.1 media upload | **Deprecated June 9, 2025.** Sunset completed. | X API v2 chunked media upload (`/2/media/upload/*`) |
| OAuth 1.0a | Legacy auth. More complex than OAuth 2.0 PKCE. X recommends OAuth 2.0 for all new integrations. | OAuth 2.0 with PKCE (built-in implementation) |
| `oauth2` library for PKCE | Library **does not support PKCE**. Latest version (2.1.0, Jan 2023) has no PKCE functionality. | Direct implementation with `:crypto` module |
| `command` query param on `/2/media/upload` | Deprecated approach. Migration required by May 30, 2025. | New dedicated endpoints: `/2/media/upload/initialize`, `/2/media/upload/{id}/append`, `/2/media/upload/finalize` |
| Hackney (direct) | Known stability issues in high-traffic apps. HTTPoison 2.x improved this. | HTTPoison 2.x (uses Hackney but with fixes) or Req (uses Finch) |

## Stack Patterns by Variant

**For OAuth 2.0 PKCE Implementation:**
- Use built-in `:crypto.strong_rand_bytes/1` for code verifier (64 bytes)
- Generate code challenge: `:crypto.hash(:sha256, code_verifier) |> Base.url_encode64(padding: false)`
- Store `code_verifier` in session/state for token exchange
- Use `code_challenge_method=S256` in authorization URL

**For Media Upload (Videos/Large Files):**
- Use chunked upload for files >5MB or videos
- Three-step process: initialize → append chunks → finalize
- For images <5MB, single POST to `/2/media/upload` with base64-encoded media
- Store `media_id` from upload response, attach to tweet via `media.media_ids` array

**For Token Management:**
- Access tokens: 2-hour lifespan
- Refresh tokens: 6-month lifespan, **single-use** (new refresh token issued on each refresh)
- Must request `offline.access` scope to receive refresh token
- Reuse existing `TokenRefreshWorker` pattern from Instagram integration

**For API Endpoints:**
- **Authorization:** `https://x.com/i/oauth2/authorize` (with PKCE params)
- **Token exchange:** `POST https://api.x.com/2/oauth2/token`
- **Token refresh:** `POST https://api.x.com/2/oauth2/token` (with `grant_type=refresh_token`)
- **Token revoke:** `POST https://api.x.com/2/oauth2/revoke`
- **Media upload (init):** `POST https://api.x.com/2/media/upload/initialize`
- **Media upload (append):** `POST https://api.x.com/2/media/upload/{media_id}/append`
- **Media upload (finalize):** `POST https://api.x.com/2/media/upload/finalize`
- **Create tweet:** `POST https://api.x.com/2/tweets`
- **User profile:** `GET https://api.x.com/2/users/me`

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| HTTPoison 2.2 | Elixir 1.15+ | Already in use. Compatible with Phoenix 1.8 |
| Jason 1.2+ | Phoenix 1.8 | Already in use. Required for X API v2 JSON payloads |
| :crypto (OTP 26+) | Elixir 1.15+ | Built-in. SHA256 support guaranteed in modern OTP |
| X API v2 | OAuth 2.0 PKCE | X API v2 requires OAuth 2.0 user context (PKCE flow) for write operations |
| Req 0.5.17 | Elixir 1.15+, Finch 0.19+ | Optional. If adopting Req, ensure Finch is compatible (already in deps) |

## Integration with Existing Platform Pattern

The existing `ClippsterServer.Social.Platform` behavior defines:
- `authorize_url/1` - Build OAuth authorization URL
- `exchange_code/2` - Exchange auth code for tokens
- `refresh_tokens/1` - Refresh expired access token
- `get_user_profile/1` - Fetch user profile data
- `publish_media/3` - Post media to platform
- `get_insights/2` - Retrieve post analytics

**X API v2 Implementation Notes:**

| Callback | X API v2 Specifics |
|----------|-------------------|
| `authorize_url/1` | Include `code_challenge`, `code_challenge_method=S256`, `state`, scopes: `tweet.read tweet.write users.read media.write offline.access` |
| `exchange_code/2` | POST to `/2/oauth2/token` with `code_verifier` (matches challenge from authorize_url). Response includes `access_token` (2hr), `refresh_token` (6mo, single-use), `expires_in: 7200`. |
| `refresh_tokens/1` | POST to `/2/oauth2/token` with `grant_type=refresh_token`. Returns NEW refresh token (single-use rotation). Update both tokens in DB. |
| `get_user_profile/1` | `GET /2/users/me?user.fields=profile_image_url,username,name` with `Authorization: Bearer {token}` |
| `publish_media/3` | Two-step: (1) Upload media via chunked upload (init/append/finalize), receive `media_id`. (2) POST to `/2/tweets` with JSON body `{"text": "...", "media": {"media_ids": ["123"]}}` |
| `get_insights/2` | X API v2 analytics requires Basic tier ($100/mo) or higher. Free tier **does not** support analytics endpoints. Consider using twitterapi.io (already integrated) for read-only analytics. |

**Key Differences from Instagram:**
- **PKCE Required:** X requires PKCE for OAuth 2.0. Instagram uses standard OAuth (no PKCE).
- **Refresh Token Rotation:** X uses single-use refresh tokens (new token on each refresh). Instagram tokens are reusable for 60 days.
- **Media Upload Separate:** X requires separate media upload endpoint, then attach `media_id` to tweet. Instagram uses single-step container → publish flow.
- **No Refresh Token by Default:** Must explicitly request `offline.access` scope. Instagram provides refresh tokens automatically.
- **Shorter Token Lifespan:** X access tokens last 2 hours. Instagram long-lived tokens last 60 days.

## PKCE Implementation (Built-in Crypto)

```elixir
defmodule ClippsterServer.Social.Platforms.Twitter.PKCE do
  @moduledoc """
  PKCE (Proof Key for Code Exchange) utilities for OAuth 2.0.
  RFC 7636 - https://datatracker.ietf.org/doc/html/rfc7636
  """

  @doc """
  Generates a code verifier (64 random bytes, base64-url encoded).
  """
  def generate_code_verifier do
    :crypto.strong_rand_bytes(64)
    |> Base.url_encode64(padding: false)
  end

  @doc """
  Generates a code challenge from a code verifier using SHA256.
  """
  def generate_code_challenge(code_verifier) do
    :crypto.hash(:sha256, code_verifier)
    |> Base.url_encode64(padding: false)
  end

  @doc """
  Generates both verifier and challenge.
  Returns {code_verifier, code_challenge}.
  Store code_verifier in session for token exchange.
  """
  def generate_pkce_pair do
    verifier = generate_code_verifier()
    challenge = generate_code_challenge(verifier)
    {verifier, challenge}
  end
end
```

**Usage:**
1. On authorization initiation: Generate PKCE pair, store `code_verifier` in session/state, include `code_challenge` in authorize URL
2. On callback: Retrieve `code_verifier` from session, send to token exchange endpoint
3. X verifies that `SHA256(code_verifier)` matches original `code_challenge`

## Sources

### Official X API Documentation
- [OAuth 2.0 Authorization Code Flow with PKCE](https://docs.x.com/fundamentals/authentication/oauth-2-0/user-access-token) - MEDIUM confidence (official docs)
- [Chunked Media Upload](https://docs.x.com/x-api/media/quickstart/media-upload-chunked) - MEDIUM confidence (official docs)
- [POST /2/tweets endpoint](https://developer.x.com/en/docs/x-api/tweets/manage-tweets/api-reference/post-tweets) - MEDIUM confidence (official docs, site redirects)

### X Developer Community
- [Announcing media upload endpoints in X API v2](https://devcommunity.x.com/t/announcing-media-upload-endpoints-in-the-x-api-v2/234175) - MEDIUM confidence (official announcement, Jan 2025)
- [Deprecating v1.1 media upload endpoints](https://devcommunity.x.com/t/deprecating-the-v1-1-media-upload-endpoints/238196) - HIGH confidence (official deprecation notice)
- [Media Upload Endpoints Update and Extended Migration Deadline](https://devcommunity.x.com/t/media-upload-endpoints-update-and-extended-migration-deadline/241818) - HIGH confidence (migration deadline: May 30, 2025)
- [Refresh Token Expiration Clarification](https://devcommunity.x.com/t/refresh-token-expiration-clarification/176627) - MEDIUM confidence (6-month refresh token lifespan)
- [Access Token expires_in](https://devcommunity.x.com/t/access-token-expires-in/164425) - MEDIUM confidence (2-hour access token)

### Elixir HTTP Client Research
- [A Breakdown of HTTP Clients in Elixir](https://andrealeopardi.com/posts/breakdown-of-http-clients-in-elixir/) - HIGH confidence (comprehensive comparison)
- [Elixir Forum: Preferred HTTP library](https://elixirforum.com/t/preferred-http-library-req-or-httpoison/71163) - MEDIUM confidence (June 2025 community discussion)
- [Req GitHub repository](https://github.com/wojtekmach/req) - HIGH confidence (v0.5.17, Jan 2026)
- [HTTPoison Hex package](https://hex.pm/packages/httpoison) - HIGH confidence (v2.2.x current)

### OAuth 2.0 and PKCE
- [OAuth Libraries for Elixir](https://oauth.net/code/elixir/) - MEDIUM confidence (ueberauth/oauth2 listed, but no PKCE support)
- [ueberauth/oauth2 GitHub](https://github.com/ueberauth/oauth2) - HIGH confidence (v2.1.0, Jan 2023, no PKCE)
- [Boruta PKCE documentation](https://hexdocs.pm/boruta/pkce.html) - HIGH confidence (Elixir PKCE implementation example)
- [RFC 7636 - PKCE specification](https://datatracker.ietf.org/doc/html/rfc7636) - HIGH confidence (official RFC)

### X API Scopes and Authentication
- [X API v2 authentication mapping](https://docs.x.com/fundamentals/authentication/guides/v2-authentication-mapping) - MEDIUM confidence (official scope documentation)
- [How to Upload Media to Twitter API v2 Using OAuth 2.0](https://devcommunity.x.com/t/how-to-upload-media-to-twitter-api-v2-using-oauth-2-0/238518) - MEDIUM confidence (media.write scope requirement)

---
*Stack research for: X API v2 OAuth 2.0 with PKCE and Tweet Posting Integration*
*Researched: 2026-02-09*
*Confidence: MEDIUM - Based on official X documentation (redirects/access issues on some pages), developer community announcements, and Elixir ecosystem research. PKCE implementation verified against RFC 7636 and Elixir crypto documentation.*
