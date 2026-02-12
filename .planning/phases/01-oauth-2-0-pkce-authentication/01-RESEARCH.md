# Phase 1: OAuth 2.0 PKCE Authentication - Research

**Researched:** 2026-02-09
**Domain:** X (Twitter) API OAuth 2.0 with PKCE, Elixir/Phoenix backend
**Confidence:** HIGH

## Summary

X API OAuth 2.0 with PKCE is the modern standard for authenticating on behalf of users. The flow requires generating a code verifier/challenge pair (SHA256), exchanging authorization codes for tokens, and managing short-lived access tokens (2 hours) with single-use refresh tokens (6 months). X's implementation follows RFC 7636 PKCE specification strictly.

This phase follows the proven Instagram OAuth pattern already implemented in Clippster, adapted for X API's specific requirements: PKCE compliance (Instagram uses standard OAuth 2.0), 2-hour token expiry (vs Instagram's 60-day tokens), and single-use refresh token rotation (vs Instagram's reusable refresh).

The existing TokenEncryption (AES-256-GCM) and TokenRefreshWorker infrastructure can be reused directly. The primary differences are in OAuth flow initiation (PKCE code challenge), token endpoints, and refresh frequency.

**Primary recommendation:** Follow Instagram controller pattern exactly, add PKCE generation to authorization URL building, implement single-use refresh token rotation in Platform module, configure TokenRefreshWorker for 1-hour refresh checks instead of 12-hour.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| X API v2 | Current | OAuth 2.0 endpoints, user context API | Only version supporting OAuth 2.0 PKCE |
| Elixir `:crypto` | Built-in | SHA256 hashing for PKCE code challenge | Standard library, no dependencies |
| HTTPoison | Current | HTTP client for X API calls | Already used for Instagram, proven in codebase |
| Jason | Current | JSON encoding/decoding | Already used throughout codebase |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TokenEncryption | Existing | AES-256-GCM token encryption | Already implemented, reuse as-is |
| TokenRefreshWorker | Existing | Automatic token refresh GenServer | Already implemented, needs config update for 1-hour checks |
| PulseKit | Existing | Event logging for debugging | Already integrated, use for OAuth flow tracking |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw `:crypto` | oauth2 hex package | oauth2 doesn't support PKCE out-of-box, adds dependency for minimal gain |
| Manual refresh | Third-party OAuth library | Existing TokenRefreshWorker already handles this pattern well |
| X OAuth 1.0a | X OAuth 2.0 PKCE | OAuth 1.0a deprecated, OAuth 2.0 is modern standard with better security |

**Installation:**
```bash
# No new dependencies required - all libraries already in project
# X API requires developer account setup:
# 1. Apply for X Developer account at developer.x.com
# 2. Create app with OAuth 2.0 enabled
# 3. Configure OAuth 2.0 settings: Type = Web App, Confidential, Callback URLs
# 4. Copy Client ID and Client Secret to config
```

## Architecture Patterns

### Recommended Project Structure
```
server/lib/clippster_server/
├── social/
│   ├── platforms/
│   │   ├── instagram.ex           # Existing pattern to follow
│   │   └── twitter.ex              # New - X API implementation
│   ├── social_account.ex           # Existing - already supports twitter
│   ├── token_encryption.ex         # Existing - reuse as-is
│   └── token_refresh_worker.ex     # Existing - update config
├── clippster_server_web/
│   └── controllers/
│       ├── twitter_auth_controller.ex           # New - org OAuth flow
│       └── user_twitter_auth_controller.ex      # New - personal OAuth flow
```

### Pattern 1: PKCE Code Verifier/Challenge Generation
**What:** Generate cryptographically secure code verifier and compute SHA256 Base64-URL encoded challenge
**When to use:** At OAuth flow initiation, before redirecting to X authorization URL
**Example:**
```elixir
# Source: X Developer Community - OAuth2 with PKCE extension
# https://devcommunity.x.com/t/oauth2-with-pkce-extension-using-code-challenge-method-s256/165100

defp generate_pkce_pair do
  # Generate 32-byte random code verifier
  code_verifier = :crypto.strong_rand_bytes(32)
                  |> Base.url_encode64(padding: false)

  # Compute SHA256 hash and Base64-URL encode (no padding)
  code_challenge = :crypto.hash(:sha256, code_verifier)
                   |> Base.url_encode64(padding: false)

  {code_verifier, code_challenge}
end

# Store code_verifier in session/state for token exchange
# Send code_challenge in authorization URL with method=S256
```

### Pattern 2: OAuth State with PKCE Verifier Storage
**What:** Encode OAuth state with code verifier for token exchange step
**When to use:** Building authorization URL and validating callback
**Example:**
```elixir
# Source: Instagram pattern (modified for PKCE)
# /server/lib/clippster_server_web/controllers/instagram_auth_controller.ex lines 54-61

{code_verifier, code_challenge} = generate_pkce_pair()

state = %{
  org_id: org_id,
  callback_port: callback_port,
  user_id: user.id,
  code_verifier: code_verifier,  # NEW: Store for token exchange
  timestamp: System.system_time(:second)
}
|> Jason.encode!()
|> Base.url_encode64(padding: false)

auth_url = "https://x.com/i/oauth2/authorize?" <>
  URI.encode_query(%{
    "response_type" => "code",
    "client_id" => client_id,
    "redirect_uri" => callback_url,
    "scope" => "tweet.read tweet.write users.read offline.access",
    "state" => state,
    "code_challenge" => code_challenge,
    "code_challenge_method" => "S256"
  })
```

### Pattern 3: Token Exchange with Code Verifier
**What:** Exchange authorization code for tokens using code verifier from state
**When to use:** OAuth callback handler after user authorizes
**Example:**
```elixir
# Source: X API Authorization Code Flow documentation
# https://developer.twitter.com/en/docs/authentication/oauth-2-0/authorization-code

def exchange_code(code, opts) do
  client_id = opts[:client_id]
  client_secret = opts[:client_secret]
  redirect_uri = opts[:redirect_uri]
  code_verifier = opts[:code_verifier]  # From state

  body = URI.encode_query(%{
    "code" => code,
    "grant_type" => "authorization_code",
    "client_id" => client_id,
    "redirect_uri" => redirect_uri,
    "code_verifier" => code_verifier  # PKCE requirement
  })

  headers = [
    {"Content-Type", "application/x-www-form-urlencoded"},
    {"Authorization", "Basic " <> Base.encode64("#{client_id}:#{client_secret}")}
  ]

  case HTTPoison.post("https://api.x.com/2/oauth2/token", body, headers) do
    {:ok, %{status_code: 200, body: response_body}} ->
      case Jason.decode(response_body) do
        {:ok, %{"access_token" => access_token, "refresh_token" => refresh_token, "expires_in" => expires_in}} ->
          {:ok, %{
            access_token: access_token,
            refresh_token: refresh_token,
            expires_in: expires_in  # 7200 seconds = 2 hours
          }}
        {:ok, %{"error" => error}} ->
          {:error, error}
        _ ->
          {:error, :invalid_response}
      end
    {:ok, %{status_code: status, body: body}} ->
      {:error, extract_error(body, :token_exchange_failed)}
    {:error, reason} ->
      {:error, reason}
  end
end
```

### Pattern 4: Single-Use Refresh Token Rotation
**What:** When refreshing, X returns NEW refresh token and invalidates old one
**When to use:** TokenRefreshWorker or on-demand token refresh
**Example:**
```elixir
# Source: Refresh Token Rotation Best Practices
# https://www.serverion.com/uncategorized/refresh-token-rotation-best-practices-for-developers/

def refresh_tokens(refresh_token, opts) do
  client_id = opts[:client_id]
  client_secret = opts[:client_secret]

  body = URI.encode_query(%{
    "refresh_token" => refresh_token,
    "grant_type" => "refresh_token",
    "client_id" => client_id
  })

  headers = [
    {"Content-Type", "application/x-www-form-urlencoded"},
    {"Authorization", "Basic " <> Base.encode64("#{client_id}:#{client_secret}")}
  ]

  case HTTPoison.post("https://api.x.com/2/oauth2/token", body, headers) do
    {:ok, %{status_code: 200, body: response_body}} ->
      case Jason.decode(response_body) do
        {:ok, %{"access_token" => new_access, "refresh_token" => new_refresh, "expires_in" => expires_in}} ->
          # CRITICAL: Must update BOTH tokens atomically
          # Old refresh_token is now invalid
          {:ok, %{
            access_token: new_access,
            refresh_token: new_refresh,  # NEW refresh token
            expires_in: expires_in
          }}
        _ ->
          {:error, :invalid_response}
      end
    {:ok, %{status_code: 401}} ->
      # Refresh token is expired or revoked - user must re-authenticate
      {:error, :refresh_token_expired}
    _ ->
      {:error, :refresh_failed}
  end
end
```

### Pattern 5: User Profile Retrieval
**What:** Get authenticated user's X profile information
**When to use:** After successful token exchange, to populate social account
**Example:**
```elixir
# Source: X API v2 User Lookup
# https://docs.x.com/x-api/introduction

def get_user_profile(access_token) do
  headers = [
    {"Authorization", "Bearer #{access_token}"}
  ]

  case HTTPoison.get("https://api.x.com/2/users/me?user.fields=profile_image_url,name,username", headers) do
    {:ok, %{status_code: 200, body: body}} ->
      case Jason.decode(body) do
        {:ok, %{"data" => profile}} ->
          {:ok, %{
            user_id: profile["id"],
            username: profile["username"],
            display_name: profile["name"],
            profile_image_url: profile["profile_image_url"]
          }}
        {:ok, %{"errors" => errors}} ->
          {:error, extract_errors(errors)}
        _ ->
          {:error, :invalid_response}
      end
    {:ok, %{status_code: 401}} ->
      {:error, :unauthorized}
    _ ->
      {:error, :profile_fetch_failed}
  end
end
```

### Anti-Patterns to Avoid

- **Storing code_verifier in client-side session**: Code verifier must round-trip securely via server state, never exposed to client JS
- **Reusing refresh tokens**: X invalidates old refresh token on use; must atomically update both tokens in database transaction
- **Refreshing on-demand only**: 2-hour expiry means token could expire mid-request; proactive refresh at 1-hour mark prevents failures
- **Plain OAuth 2.0 without PKCE**: X API requires PKCE for security; standard OAuth 2.0 flow will be rejected
- **Assuming refresh_token is optional**: Must include `offline.access` scope to receive refresh token; without it, tokens expire in 2 hours permanently

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token encryption | Custom AES implementation | Existing TokenEncryption module | Already audited, handles key management, IV generation, AAD properly |
| Token refresh scheduling | Manual cron or intervals | Existing TokenRefreshWorker | GenServer pattern with backoff, handles failures, logs via PulseKit |
| PKCE code challenge | Custom hashing | Elixir `:crypto.hash(:sha256, verifier)` | Standard library, cryptographically secure, battle-tested |
| OAuth state encoding | Custom encoding | `Jason.encode!() |> Base.url_encode64()` | Prevents injection attacks, handles special chars, URL-safe |
| HTTP retry logic | Manual retry loops | HTTPoison with retry library or Req | Rate limiting, exponential backoff, connection pooling |

**Key insight:** OAuth 2.0 with PKCE has subtle security requirements (state validation, code verifier secrecy, single-use refresh tokens). Following proven patterns from Instagram controller and Platform behavior interface prevents common vulnerabilities like CSRF, authorization code interception, and token replay attacks.

## Common Pitfalls

### Pitfall 1: Missing `offline.access` Scope
**What goes wrong:** Access token granted without refresh token, expires in 2 hours permanently
**Why it happens:** Developer assumes OAuth 2.0 always provides refresh tokens; X requires explicit scope
**How to avoid:** Always include `offline.access` in scope string alongside `tweet.read`, `tweet.write`, `users.read`
**Warning signs:** Token exchange succeeds but `refresh_token` field is null in response

### Pitfall 2: Not Updating Refresh Token After Refresh
**What goes wrong:** Second refresh attempt fails with 401; old refresh token was invalidated
**Why it happens:** Developer only updates access_token, assumes refresh_token is reusable
**How to avoid:** Use database transaction to atomically update both `access_token_encrypted` and `refresh_token_encrypted` fields
**Warning signs:** First token refresh works, subsequent refreshes fail; user must re-authenticate frequently

### Pitfall 3: Token Expires Mid-Request
**What goes wrong:** Token valid at request start, expires during API call, returns 401 after partial work
**Why it happens:** 2-hour window is short; waiting until expiry to refresh creates race condition
**How to avoid:** Configure TokenRefreshWorker to refresh at 1-hour mark (50% of lifetime); check `token_expires_at` before critical operations
**Warning signs:** Random 401 errors that don't correlate with user actions; errors cluster around 2-hour intervals

### Pitfall 4: Code Verifier Not URL-Safe
**What goes wrong:** Token exchange fails with "invalid code_verifier" despite correct flow
**Why it happens:** Using standard Base64 encoding instead of URL-safe variant; `+`, `/`, `=` break URL parsing
**How to avoid:** Use `Base.url_encode64(padding: false)` for both verifier and challenge; never use `Base.encode64()`
**Warning signs:** Token exchange works in dev (localhost) but fails in production (HTTPS redirects)

### Pitfall 5: State Parameter Too Large
**What goes wrong:** Authorization redirect fails silently; X truncates state parameter
**Why it happens:** Developer stores large objects in state (user profile, session data); exceeds URL length limits
**How to avoid:** State should only contain: user_id, org_id, code_verifier, timestamp, callback_port; keep under 1KB
**Warning signs:** OAuth flow works for some users/orgs but not others; intermittent callback failures

### Pitfall 6: Mixing Organization and Personal Account Flows
**What goes wrong:** User connects personal X account to organization, or vice versa; wrong database table
**Why it happens:** Reusing same controller/endpoint for both flows; state doesn't distinguish account type
**How to avoid:** Separate controllers (`TwitterAuthController` for orgs, `UserTwitterAuthController` for personal); different callback URLs
**Warning signs:** Account appears in wrong UI section; permission errors when posting; foreign key constraint failures

### Pitfall 7: Not Validating State Timestamp
**What goes wrong:** Attacker intercepts old authorization code and replays it
**Why it happens:** Developer validates state structure but not freshness; authorization code valid for 10 minutes
**How to avoid:** Include timestamp in state; reject if `System.system_time(:second) - timestamp > 600` (10 minutes)
**Warning signs:** No immediate symptoms; security audit reveals replay vulnerability

## Code Examples

Verified patterns from official sources:

### Authorization URL with PKCE
```elixir
# Source: X API OAuth 2.0 Authorization Code Flow
# https://developer.twitter.com/en/docs/authentication/oauth-2-0/authorization-code

def authorize_url(opts) do
  client_id = opts[:client_id] || raise "client_id required"
  redirect_uri = opts[:redirect_uri] || raise "redirect_uri required"
  scope = opts[:scope] || "tweet.read tweet.write users.read offline.access"
  state = opts[:state]
  {code_verifier, code_challenge} = generate_pkce_pair()

  # Store code_verifier in state for token exchange
  state_with_verifier = state
                        |> Map.put(:code_verifier, code_verifier)
                        |> Jason.encode!()
                        |> Base.url_encode64(padding: false)

  params = %{
    "response_type" => "code",
    "client_id" => client_id,
    "redirect_uri" => redirect_uri,
    "scope" => scope,
    "state" => state_with_verifier,
    "code_challenge" => code_challenge,
    "code_challenge_method" => "S256"
  }

  "https://x.com/i/oauth2/authorize?" <> URI.encode_query(params)
end
```

### Platform Behavior Implementation
```elixir
# Source: Instagram platform module pattern
# /server/lib/clippster_server/social/platforms/instagram.ex lines 42-102

defmodule ClippsterServer.Social.Platforms.Twitter do
  @behaviour ClippsterServer.Social.Platform

  @twitter_oauth_url "https://api.x.com/2/oauth2/token"
  @twitter_api_url "https://api.x.com/2"

  @impl true
  def platform_id, do: "twitter"

  @impl true
  def platform_name, do: "X (Twitter)"

  @impl true
  def authorize_url(opts) do
    # See authorization URL example above
  end

  @impl true
  def exchange_code(code, opts) do
    # See token exchange pattern above
  end

  @impl true
  def refresh_tokens(refresh_token) do
    # See single-use refresh pattern above
    # CRITICAL: Returns new refresh_token that must be stored
  end

  @impl true
  def get_user_profile(access_token) do
    # See user profile retrieval pattern above
  end
end
```

### Database Schema Extension
```elixir
# Source: Existing SocialAccount schema
# /server/lib/clippster_server/social/social_account.ex lines 12-14

# No schema changes needed - twitter already in @platforms list
@platforms ~w(instagram tiktok twitter youtube)

# TokenRefreshWorker configuration update needed
# /server/lib/clippster_server/social/token_refresh_worker.ex line 15
# Change from:
@default_interval :timer.hours(12)
# To:
@default_interval :timer.hours(1)  # Check hourly for 2-hour expiry tokens

# Or make platform-specific:
defp refresh_threshold("twitter"), do: :timer.hours(1)
defp refresh_threshold(_), do: DateTime.add(DateTime.utc_now(), 1, :day)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| OAuth 1.0a with request tokens | OAuth 2.0 PKCE | X API v2 launch (2021) | Simpler flow, better security, fine-grained scopes |
| Long-lived tokens (indefinite) | Short-lived access (2 hours) + refresh (6 months) | OAuth 2.0 security best practices | Forces token rotation, limits breach impact |
| Reusable refresh tokens | Single-use refresh token rotation | RFC 9700 (2024) | Detects token theft, prevents replay attacks |
| Standard OAuth 2.0 | PKCE mandatory | X API security update (2022) | Prevents authorization code interception |
| Global API rate limits | Per-app + per-user limits with OAuth 2.0 | X API v2 rate limit structure | 900 requests/15min vs 300 for app-only auth |

**Deprecated/outdated:**
- **OAuth 1.0a**: Still supported but deprecated; X recommends OAuth 2.0 for all new apps
- **3-legged OAuth without PKCE**: X API rejects standard OAuth 2.0 flow; PKCE is mandatory
- **Bearer tokens for user context**: App-only Bearer tokens can't post on behalf of users; need OAuth 2.0 user context

## Open Questions

1. **Does X API support refresh token reuse during grace period?**
   - What we know: Most OAuth providers offer 30-second grace period where old refresh token still works
   - What's unclear: X API documentation doesn't mention grace period; community reports suggest strict single-use
   - Recommendation: Implement atomic transaction for token updates; log refresh attempts via PulseKit to detect reuse errors

2. **What happens if token refresh fails mid-flight due to network error?**
   - What we know: Refresh token is single-use, might be invalidated even if we don't receive new tokens
   - What's unclear: Does X API roll back invalidation on server error? Is old refresh token still valid after 5xx response?
   - Recommendation: Store refresh attempt timestamp; if refresh fails, mark account for re-authentication after 2 failed attempts

3. **Can organization and personal accounts use same X user ID?**
   - What we know: Instagram pattern allows same Instagram account connected to multiple organizations
   - What's unclear: Should X account be shareable, or enforce one-org-one-account uniqueness?
   - Recommendation: Follow Instagram pattern - unique constraint on (organization_id, platform, platform_user_id) allows same X user across orgs

4. **Does offline.access scope require special app review?**
   - What we know: Some X API access levels require elevated approval
   - What's unclear: Is offline.access available on Free tier? Does Basic ($100/mo) tier unlock it?
   - Recommendation: Test with Free tier first; document tier requirement in setup guide if blocked

## Sources

### Primary (HIGH confidence)
- [X API OAuth 2.0 Documentation](https://developer.x.com/en/docs/authentication/oauth-2-0) - Official X API OAuth 2.0 overview
- [OAuth 2.0 Authorization Code Flow with PKCE](https://developer.twitter.com/en/docs/authentication/oauth-2-0/authorization-code) - Official PKCE implementation guide
- [How to connect to endpoints using OAuth 2.0 Authorization Code Flow with PKCE](https://docs.x.com/fundamentals/authentication/oauth-2-0/user-access-token) - Official user access token guide
- [X Developer Community - OAuth2 with PKCE extension](https://devcommunity.x.com/t/oauth2-with-pkce-extension-using-code-challenge-method-s256/165100) - Official forum discussion on S256 method
- [RFC 7636 - Proof Key for Code Exchange](https://www.authlete.com/developers/pkce/) - PKCE standard specification

### Secondary (MEDIUM confidence)
- [node-twitter-api-v2 authentication documentation](https://github.com/PLhery/node-twitter-api-v2/blob/master/doc/auth.md) - Community library showing OAuth 2.0 patterns (verified against official docs)
- [X Developer Community - Token expiry discussions](https://devcommunity.x.com/t/access-token-with-offline-access-expire-in-2-hours/191921) - Community-confirmed 2-hour expiry and 6-month refresh token lifetime
- [Refresh Token Rotation Best Practices](https://www.serverion.com/uncategorized/refresh-token-rotation-best-practices-for-developers/) - Industry best practices (verified with RFC 9700)
- [How to Get X API Key: Complete 2026 Guide](https://elfsight.com/blog/how-to-get-x-twitter-api-key-in-2026/) - Current setup guide for 2026

### Tertiary (LOW confidence - needs validation during implementation)
- [Tweepy 4.14.0 authentication documentation](https://docs.tweepy.org/en/stable/authentication.html) - Python library examples (may not reflect latest X API changes)
- [OAuth2 library for Elixir](https://hex.pm/packages/oauth2) - General OAuth 2.0 client (doesn't explicitly support PKCE, may need manual implementation)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - X API documentation is authoritative, Elixir `:crypto` is standard library
- Architecture: HIGH - Instagram pattern proven in production, PKCE additions verified against RFC 7636 and X docs
- Pitfalls: MEDIUM-HIGH - Common issues documented in X Developer Community, some extrapolated from OAuth 2.0 general patterns
- Token rotation: MEDIUM - Single-use refresh confirmed by community but grace period behavior unclear
- Scopes and tiers: LOW - offline.access tier requirements not explicitly documented, needs validation

**Research date:** 2026-02-09
**Valid until:** 2026-03-09 (30 days - OAuth 2.0 spec is stable, but X API pricing/tiers change quarterly)

**Critical implementation notes:**
- PKCE is mandatory, not optional - X API rejects non-PKCE flows
- Token refresh must be atomic (both access + refresh) to prevent invalidation mismatch
- TokenRefreshWorker interval must be reduced from 12 hours to 1 hour for 2-hour token expiry
- Code verifier must use URL-safe Base64 encoding without padding
- `offline.access` scope is required for refresh token issuance
