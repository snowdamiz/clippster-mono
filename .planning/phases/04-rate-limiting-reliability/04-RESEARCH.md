# Phase 4: Rate Limiting & Reliability - Research

**Researched:** 2026-02-09
**Domain:** X API Rate Limiting, Retry Strategies, Duplicate Detection, Structured Logging
**Confidence:** HIGH

## Summary

Phase 4 implements reliability infrastructure for X API interactions: rate limit tracking via response headers, exponential backoff retry for transient failures, duplicate content detection to prevent 403 errors, and comprehensive API logging via PulseKit. The codebase already uses HTTPoison for HTTP requests, PulseKit for event tracking, and has the post_submissions table with status/error fields ready for retry state management.

X API returns three rate limit headers (`x-rate-limit-limit`, `x-rate-limit-remaining`, `x-rate-limit-reset`) on every response, making quota tracking straightforward. Tesla's retry middleware provides production-tested exponential backoff with full jitter, but requires switching from HTTPoison. Alternatively, the `retry` library (safwank/ElixirRetry) integrates with existing HTTPoison calls. X enforces per-user rate limits for OAuth 2.0 tokens (15-minute windows), so app-level tracking means monitoring aggregate quota across all connected users. Duplicate detection requires SHA-256 content hashing before posting and storing recent hashes with PostgreSQL hash indexes for O(1) lookups.

**Primary recommendation:** Use Tesla.Middleware.Retry for standardized exponential backoff, store rate limit state per social account in database, hash caption+media_id to detect duplicates before posting, and emit PulseKit events for all X API interactions with rate limit metadata.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tesla | ~> 1.16 | HTTP client with retry middleware | Built-in exponential backoff + full jitter, production-proven |
| retry (ElixirRetry) | ~> 0.19 | Fallback: macros for exponential backoff | If staying with HTTPoison, composable delay strategies |
| :crypto (Erlang) | stdlib | SHA-256 hashing for duplicate detection | Elixir standard for cryptographic hashing |
| Ecto | (existing) | Store rate limit state, duplicate hashes | Phoenix standard for database operations |
| PulseKit | ~> 1.0 (existing) | Event tracking for API interactions | Already in use, captures errors and metrics |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Hammer | ~> 7.1 | Rate limiting with pluggable backends | Optional: proactive request throttling before hitting X limits |
| Cachex | (existing) | In-memory cache for rate limit state | Optional: reduce DB reads for hot rate limit checks |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Tesla | Keep HTTPoison + retry lib | HTTPoison works but Tesla middleware is more declarative |
| Database for rate limits | ETS/Cachex only | In-memory state lost on restart, DB persists across deployments |
| SHA-256 hash | MinHash (Twitter's algorithm) | MinHash finds near-duplicates, SHA-256 finds exact duplicates (simpler) |
| Hammer | ExRated | ExRated only uses ETS (single-node), Hammer supports Redis for multi-node |

**Installation:**
```bash
# Add to mix.exs deps:
{:tesla, "~> 1.16"},
{:retry, "~> 0.19"}  # Only if staying with HTTPoison
# hammer is optional for proactive throttling
```

## Architecture Patterns

### Recommended Project Structure
```
lib/clippster_server/social/
├── platforms/
│   └── twitter.ex                  # Migrate to Tesla or wrap HTTPoison with retry
├── twitter_rate_limiter.ex         # NEW: Track rate limits per endpoint
├── twitter_duplicate_detector.ex   # NEW: Hash-based duplicate detection
├── social.ex                       # Add retry logic for failed posts
└── post_submission.ex              # Add retry_count, last_error_code fields
```

### Pattern 1: Tesla Retry Middleware for Exponential Backoff
**What:** Wrap X API calls in Tesla client with automatic retry for 429/5xx errors
**When to use:** All X API requests (OAuth, media upload, tweet creation, profile fetch)
**Example:**
```elixir
# Source: https://hexdocs.pm/tesla/Tesla.Middleware.Retry.html
defmodule ClippsterServer.Social.Platforms.TwitterClient do
  use Tesla

  plug Tesla.Middleware.BaseUrl, "https://api.x.com"
  plug Tesla.Middleware.Headers, [{"Content-Type", "application/json"}]

  plug Tesla.Middleware.Retry,
    delay: 500,              # Base delay: 500ms
    max_retries: 5,          # Up to 5 retries
    max_delay: 60_000,       # Cap at 60 seconds
    jitter_factor: 0.2,      # 20% noise to prevent thundering herd
    use_retry_after_header: true,  # Respect X's Retry-After header
    should_retry: fn
      # Retry transient errors
      {:ok, %{status: status}} when status in [429, 500, 502, 503, 504] -> true
      {:ok, %{status: status}} when status in 400..499 -> false  # Permanent
      {:error, _reason} -> true  # Network errors
    end

  def create_tweet(access_token, text, opts \\ []) do
    body = %{"text" => text}
    |> maybe_add_media(opts[:media_ids])

    post("/2/tweets", body, headers: [{"Authorization", "Bearer #{access_token}"}])
  end
end
```

### Pattern 2: Rate Limit Tracking via Response Headers
**What:** Parse X rate limit headers from every response, store per-endpoint quota
**When to use:** After every X API call, before next request
**Example:**
```elixir
# Source: https://docs.x.com/x-api/fundamentals/rate-limits
defmodule ClippsterServer.Social.TwitterRateLimiter do
  @moduledoc """
  Tracks X API rate limits using response headers.

  X returns three headers on every response:
  - x-rate-limit-limit: Maximum requests per window
  - x-rate-limit-remaining: Requests remaining
  - x-rate-limit-reset: Unix timestamp when window resets
  """

  alias ClippsterServer.Repo
  alias ClippsterServer.Social.RateLimitState

  def update_from_response(endpoint, headers) do
    limit = parse_header(headers, "x-rate-limit-limit")
    remaining = parse_header(headers, "x-rate-limit-remaining")
    reset_at = parse_header(headers, "x-rate-limit-reset") |> unix_to_datetime()

    attrs = %{
      endpoint: endpoint,
      limit: limit,
      remaining: remaining,
      reset_at: reset_at,
      last_checked_at: DateTime.utc_now()
    }

    # Upsert rate limit state
    case Repo.get_by(RateLimitState, endpoint: endpoint) do
      nil -> %RateLimitState{} |> RateLimitState.changeset(attrs) |> Repo.insert()
      state -> state |> RateLimitState.changeset(attrs) |> Repo.update()
    end
  end

  def check_quota(endpoint, threshold \\ 10) do
    case Repo.get_by(RateLimitState, endpoint: endpoint) do
      %{remaining: remaining, reset_at: reset_at} when remaining < threshold ->
        Logger.warning("[RateLimit] Approaching limit for #{endpoint}: #{remaining} remaining until #{reset_at}")
        {:warning, remaining, reset_at}

      %{remaining: 0} ->
        {:error, :rate_limit_exceeded}

      _ ->
        :ok
    end
  end

  defp parse_header(headers, key) do
    headers
    |> Enum.find_value(fn {k, v} -> if String.downcase(k) == key, do: v end)
    |> to_integer()
  end
end
```

### Pattern 3: Duplicate Detection with SHA-256 Hashing
**What:** Hash caption + media_ids before posting, check against recent posts
**When to use:** Before every tweet creation to prevent 403 duplicate errors
**Example:**
```elixir
# Source: https://www.djm.org.uk/posts/cryptographic-hash-functions-elixir-generating-hex-digests-md5-sha1-sha2/
defmodule ClippsterServer.Social.TwitterDuplicateDetector do
  @moduledoc """
  Detects duplicate tweet content using SHA-256 hashing.

  X returns 403 "Status is a duplicate" when posting identical content.
  Store hashes of recent tweets to prevent duplicate submission.
  """

  alias ClippsterServer.Repo
  alias ClippsterServer.Social.PostSubmission

  @lookback_hours 24  # Check last 24 hours of posts

  def check_duplicate(account_id, text, media_ids \\ []) do
    content_hash = generate_hash(text, media_ids)

    # Query recent posts by same account with same hash
    since = DateTime.utc_now() |> DateTime.add(-@lookback_hours, :hour)

    duplicate =
      PostSubmission
      |> where([p], p.organization_social_account_id == ^account_id)
      |> where([p], p.content_hash == ^content_hash)
      |> where([p], p.inserted_at >= ^since)
      |> where([p], p.status in ["published", "publishing"])
      |> limit(1)
      |> Repo.one()

    case duplicate do
      nil -> {:ok, content_hash}
      post -> {:error, :duplicate_content, post}
    end
  end

  defp generate_hash(text, media_ids) do
    # Combine text and media_ids for hash input
    content = text <> Enum.join(media_ids, ",")

    :crypto.hash(:sha256, content)
    |> Base.encode16(case: :lower)
  end
end
```

### Pattern 4: PulseKit Event Logging for X API Interactions
**What:** Emit structured events for all X API calls with rate limit metadata
**When to use:** After every X API request (success or failure)
**Example:**
```elixir
# Source: Existing PulseKit usage in post_submission_controller.ex
defmodule ClippsterServer.Social.Platforms.Twitter do
  defp log_api_call(endpoint, method, status, headers, opts \\ []) do
    event = %{
      type: "x_api_call",
      endpoint: endpoint,
      method: method,
      status: status,
      rate_limit: extract_rate_limit(headers),
      duration_ms: opts[:duration_ms],
      error: opts[:error],
      account_id: opts[:account_id],
      timestamp: DateTime.utc_now()
    }

    pulse_capture(event)
  end

  defp extract_rate_limit(headers) do
    %{
      limit: parse_header(headers, "x-rate-limit-limit"),
      remaining: parse_header(headers, "x-rate-limit-remaining"),
      reset: parse_header(headers, "x-rate-limit-reset")
    }
  end

  defp pulse_capture(event) do
    if Code.ensure_loaded?(PulseKit) do
      try do
        PulseKit.capture(event)
      rescue
        _ -> :ok
      end
    end
  end
end
```

### Anti-Patterns to Avoid
- **Immediate retry on 429:** X returns `Retry-After` header—always respect it, don't hammer the API
- **Retrying 400/403 errors:** These are permanent—fix the request, don't retry blindly
- **Ignoring rate limit headers:** Proactive quota tracking prevents hitting limits mid-operation
- **Duplicate check after posting:** X already rejected it with 403—check BEFORE posting
- **Silent failures:** Always log API errors to PulseKit for debugging

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Exponential backoff algorithm | Custom sleep loop with manual backoff calculation | Tesla.Middleware.Retry or retry library | Production-tested full jitter algorithm, prevents thundering herd |
| Rate limit tracking | In-memory map with manual cleanup | Database-backed state with Ecto | Survives restarts, queryable for monitoring |
| Content hashing | Custom hash function or string comparison | :crypto.hash(:sha256, content) | Erlang stdlib, cryptographically secure, O(1) lookup with hash index |
| Circuit breakers | Manual failure counting | Fuse (Erlang library) | Mature pattern, prevents cascade failures |
| Retry-After parsing | String parsing and timezone conversion | Tesla's use_retry_after_header: true | Handles edge cases, respects X's guidance |

**Key insight:** Reliability infrastructure has subtle edge cases (jitter, thundering herd, timezone bugs). Use battle-tested libraries that handle these correctly rather than reimplementing.

## Common Pitfalls

### Pitfall 1: Not Distinguishing Transient vs Permanent Errors
**What goes wrong:** Retrying 400/403 errors wastes quota and delays failure notification
**Why it happens:** Treating all non-200 responses as retryable
**How to avoid:** Explicit should_retry logic—only retry 429, 5xx, and network errors
**Warning signs:** Logs show repeated 400 errors, users report slow failure notifications

### Pitfall 2: Ignoring Retry-After Header on 429
**What goes wrong:** Continuing to retry every few seconds while rate limited, burning through quota
**Why it happens:** Generic exponential backoff without header inspection
**How to avoid:** Use Tesla's `use_retry_after_header: true` or parse manually
**Warning signs:** Burst of 429 errors in logs, rate limit windows fully exhausted

### Pitfall 3: App-Level Quota Tracking Without Per-User Breakdown
**What goes wrong:** Can't identify which user is consuming quota, hard to debug limit hits
**Why it happens:** Aggregating all requests without attribution
**How to avoid:** Log account_id with every API call, query rate_limit_state by account
**Warning signs:** Hit rate limits but can't identify source, users blame each other

### Pitfall 4: Duplicate Detection Only on Exact Text Match
**What goes wrong:** Media changes but text stays same, or vice versa—still triggers duplicate error
**Why it happens:** Hashing text without media_ids, or media_ids without text
**How to avoid:** Hash concatenated `text + media_ids` as single content fingerprint
**Warning signs:** 403 "duplicate" errors despite "different" content, users confused

### Pitfall 5: No Jitter in Exponential Backoff
**What goes wrong:** Multiple workers retry simultaneously, creating thundering herd
**Why it happens:** Pure exponential backoff (2^n * base_delay) synchronizes retry attempts
**How to avoid:** Use Tesla's jitter_factor or retry library's exponential_backoff with randomization
**Warning signs:** Retry spikes in metrics, API performance degrades during retry storms

### Pitfall 6: Rate Limit State Not Persisted Across Restarts
**What goes wrong:** After deployment, app doesn't know quota was exhausted, hits limits immediately
**Why it happens:** Storing rate limit state in ETS or GenServer state only
**How to avoid:** Persist to database with Ecto, check on startup
**Warning signs:** 429 errors spike after deployments, quota resets not visible

## Code Examples

Verified patterns from official sources:

### Transient vs Permanent Error Classification
```elixir
# Source: https://docs.x.com/x-api/fundamentals/response-codes-and-errors
defmodule ClippsterServer.Social.TwitterErrors do
  @transient_errors [429, 500, 502, 503, 504]
  @permanent_errors [400, 401, 403, 404, 409]

  def classify_error(status_code) when status_code in @transient_errors do
    {:transient, "Retry with exponential backoff"}
  end

  def classify_error(status_code) when status_code in @permanent_errors do
    {:permanent, "Fix request or auth, do not retry"}
  end

  def classify_error(_status_code), do: {:unknown, "Review error manually"}

  def should_retry?({:transient, _}), do: true
  def should_retry?({:permanent, _}), do: false
  def should_retry?({:unknown, _}), do: false
end
```

### Parsing Retry-After Header
```elixir
# Source: https://docs.x.com/x-api/fundamentals/rate-limits
defmodule ClippsterServer.Social.TwitterRetry do
  def get_retry_delay(headers) do
    case parse_retry_after(headers) do
      {:ok, seconds} -> {:ok, seconds * 1000}  # Convert to milliseconds
      :error -> {:error, :no_retry_after}
    end
  end

  defp parse_retry_after(headers) do
    headers
    |> Enum.find_value(fn {k, v} ->
      if String.downcase(k) == "retry-after", do: v
    end)
    |> case do
      nil -> :error
      value -> {:ok, String.to_integer(value)}
    end
  end
end
```

### HTTPoison with retry Library (If Not Using Tesla)
```elixir
# Source: https://hexdocs.pm/retry/Retry.html
defmodule ClippsterServer.Social.Platforms.Twitter do
  import Retry

  def create_tweet_with_retry(access_token, text, opts \\ []) do
    retry with: exponential_backoff() |> randomize |> cap(60_000) |> expiry(300_000) do
      case create_tweet(access_token, text, opts) do
        {:ok, result} ->
          result

        {:error, reason} when reason in [:timeout, :econnrefused, :nxdomain] ->
          raise "Transient network error"

        {:error, {:api_error, status}} when status in [429, 500, 502, 503, 504] ->
          raise "Transient API error"

        {:error, reason} ->
          # Permanent error - don't retry
          {:error, reason}
      end
    after
      result -> {:ok, result}
    else
      error -> error
    end
  end
end
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Generic HTTP retry | Tesla.Middleware.Retry with jitter | Tesla 1.4+ (2021) | Prevents thundering herd, respects Retry-After |
| Manual rate limit tracking | Parse x-rate-limit-* headers | X API v2 launch (2020) | Standardized headers across all endpoints |
| String comparison for duplicates | SHA-256 content hashing | Twitter API v1.1+ | O(1) lookup with database hash indexes |
| ETS-only rate limiting | Hammer with Redis backend | Hammer 6.0+ (2020) | Multi-node deployments, persistent state |
| Silent API failures | Structured event logging (PulseKit, Sentry) | 2023+ | Production debugging, error aggregation |

**Deprecated/outdated:**
- **v1.1 error codes:** X API v2 uses standard HTTP status codes (no custom "error code 187")
- **upload.twitter.com endpoint:** Replaced by api.x.com/2/media/upload (already handled in Phase 2)
- **ExRated for distributed systems:** Hammer is current standard (Redis-backed, multi-node)

## Open Questions

1. **App-Level vs Per-User Rate Limits for OAuth 2.0**
   - What we know: X docs say "per-user limits" for OAuth 2.0, headers track individual user quota
   - What's unclear: How to aggregate across users for app-wide monitoring (X doesn't expose app-level quota endpoint)
   - Recommendation: Sum remaining quota across all active social accounts, alert when aggregate < 20%

2. **Duplicate Detection Time Window**
   - What we know: X compares with "recent tweets," unclear exact window (hours? days?)
   - What's unclear: Official docs don't specify lookback period
   - Recommendation: Start with 24-hour window, monitor for 403 duplicates, extend if needed

3. **Rate Limit Persistence Strategy**
   - What we know: Database persists across restarts, Cachex is faster for hot reads
   - What's unclear: Is dual-layer (Cachex + DB) worth complexity for rate limits?
   - Recommendation: Start with DB only (simple), add Cachex if rate limit checks show up in profiling

4. **Retry-After Header Reliability**
   - What we know: X docs mention Retry-After for 429, Tesla can parse it
   - What's unclear: Does X always include it, or only sometimes?
   - Recommendation: Implement fallback to exponential backoff if header missing

## Sources

### Primary (HIGH confidence)
- [X API Response Codes & Errors](https://docs.x.com/x-api/fundamentals/response-codes-and-errors) - Error classification (transient vs permanent)
- [X API Rate Limits](https://docs.x.com/x-api/fundamentals/rate-limits) - Rate limit headers, time windows, per-user vs app-level
- [Tesla.Middleware.Retry HexDocs](https://hexdocs.pm/tesla/Tesla.Middleware.Retry.html) - Exponential backoff configuration, jitter algorithm
- [retry Library HexDocs](https://hexdocs.pm/retry/Retry.html) - Composable backoff strategies for HTTPoison
- [Erlang :crypto Module](https://www.erlang.org/doc/man/crypto.html) - SHA-256 hashing for duplicate detection

### Secondary (MEDIUM confidence)
- [Fixed: X(Twitter) 429 Too Many Requests Error](https://apidog.com/blog/x-twitter-429-error/) - Retry-After header behavior, best practices
- [Hammer Rate Limiter GitHub](https://github.com/ExHammer/hammer) - Pluggable backends, Redis support for distributed systems
- [Cryptographic Hash Functions in Elixir](https://www.djm.org.uk/posts/cryptographic-hash-functions-elixir-generating-hex-digests-md5-sha1-sha2/) - :crypto.hash usage examples
- [PulseKit Hex](https://hex.pm/packages/pulsekit) - Version 1.0.0 (Jan 2026), event capture API
- [ExternalService GitHub](https://github.com/jvoegele/external_service) - Circuit breaker + retry pattern example

### Tertiary (LOW confidence - requires validation)
- [Twitter Engineering: Search](https://blog.twitter.com/engineering/en_us/a/2011/the-engineering-behind-twitter-s-new-search-experience) - MinHash algorithm for duplicate detection (internal use, not public API)
- Community reports: 24-hour duplicate check window (unverified, inferred from user reports)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Tesla and retry library are production-proven, :crypto is Erlang stdlib
- Architecture: HIGH - Patterns verified from official X docs and Tesla/retry documentation
- Pitfalls: MEDIUM-HIGH - Based on common failure modes in X API community forums and Tesla issues
- Duplicate detection: MEDIUM - SHA-256 approach verified, but 24-hour window is inferred (X doesn't document exact period)
- App-level quota tracking: MEDIUM - X docs confirm per-user limits but don't provide app-wide endpoint

**Research date:** 2026-02-09
**Valid until:** 2026-03-09 (30 days for stable APIs, X API v2 is mature)
