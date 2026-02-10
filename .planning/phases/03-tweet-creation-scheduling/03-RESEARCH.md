# Phase 3: Tweet Creation & Scheduling - Research

**Researched:** 2026-02-09
**Domain:** X (Twitter) API v2 Tweet Creation, Background Job Scheduling, Phoenix/Elixir Patterns
**Confidence:** HIGH

## Summary

Phase 3 implements tweet creation with media attachments and scheduling infrastructure for X (Twitter). The codebase already has Phase 2's chunked media upload working (returns `media_id`), and Phase 1's OAuth 2.0 PKCE authentication. This phase connects those pieces by calling X API v2 `POST /2/tweets` with the `media_id`, then leveraging the existing `ScheduledPostWorker` (polling-based GenServer) and `post_submissions` table infrastructure that's already battle-tested for Instagram.

**Primary recommendation:** Follow Instagram's two-endpoint pattern (upload media, create tweet with media_id) and reuse existing scheduling infrastructure. X API has strict 280-character limit and 24-hour media_id expiration, so schedule tweets close to upload time and validate caption length client-side.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| X API v2 | 2026 | Tweet creation endpoint | Official X API, OAuth 2.0 compliant |
| HTTPoison | (existing) | HTTP client for API calls | Already used in Twitter.ex and Instagram.ex |
| Jason | (existing) | JSON encoding/decoding | Elixir standard for JSON |
| Ecto | (existing) | Database ORM for post_submissions | Phoenix standard for database operations |
| GenServer | (stdlib) | ScheduledPostWorker polling loop | Elixir standard for stateful processes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Phoenix.PubSub | (existing) | Real-time UI updates | Optional: notify UI when scheduled posts publish |
| Logger | (stdlib) | Structured logging | Always - track tweet creation flow |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ScheduledPostWorker GenServer | Oban background jobs | Oban adds PostgreSQL/SQLite dependency, more robust but existing GenServer pattern works |
| Polling (1-minute interval) | X webhook API | X webhooks require paid tier, polling is simpler for MVP |
| v2 POST /tweets | v1.1 POST statuses/update | v1.1 is legacy, v2 is current standard |

**Installation:**
```bash
# No new dependencies - use existing HTTPoison, Jason, Ecto
```

## Architecture Patterns

### Recommended Project Structure
```
lib/clippster_server/social/
├── platforms/
│   └── twitter.ex           # Add create_tweet/3 function
├── post_submission.ex        # Already has scheduling changesets
├── scheduled_post_worker.ex  # Already polls and publishes
└── social.ex                 # Already has schedule_post, retry_failed_post
```

### Pattern 1: Two-Step Tweet Creation (Upload → Tweet)
**What:** Upload media first (Phase 2), then create tweet with media_id
**When to use:** All tweets with video attachments (X requirement)
**Example:**
```elixir
# Phase 2 already implemented (Twitter.publish_media/3 returns media_id):
{:ok, %{media_id: media_id}} = Twitter.publish_media(access_token, media_url, opts)

# Phase 3 adds tweet creation:
def create_tweet(access_token, text, opts \\ []) do
  url = "https://api.x.com/2/tweets"

  body = %{
    "text" => text
  }
  |> maybe_add_media(opts[:media_ids])
  |> Jason.encode!()

  headers = [
    {"Authorization", "Bearer #{access_token}"},
    {"Content-Type", "application/json"}
  ]

  case HTTPoison.post(url, body, headers, @http_options) do
    {:ok, %HTTPoison.Response{status_code: 201, body: response_body}} ->
      case Jason.decode(response_body) do
        {:ok, %{"data" => %{"id" => post_id, "text" => text}}} ->
          # Construct post_url from username and post_id
          username = get_username_from_profile(access_token)
          post_url = "https://x.com/#{username}/status/#{post_id}"
          {:ok, %{post_id: post_id, post_url: post_url}}
        {:ok, %{"errors" => errors}} ->
          {:error, extract_error_message(errors)}
        _ ->
          {:error, :invalid_response}
      end
    {:ok, %HTTPoison.Response{status_code: status, body: body}} ->
      {:error, extract_error(body, {:api_error, status})}
    {:error, reason} ->
      {:error, reason}
  end
end

defp maybe_add_media(body, nil), do: body
defp maybe_add_media(body, media_ids) when is_list(media_ids) do
  Map.put(body, "media", %{"media_ids" => media_ids})
end
```
**Source:** [POST /2/tweets Official Docs](https://docs.x.com/x-api/posts/create-post)

### Pattern 2: Immediate vs Scheduled Post Flow
**What:** Reuse existing Instagram scheduling pattern
**When to use:** All tweet creation requests
**Example:**
```elixir
# Immediate post (status: "pending", no scheduled_at)
def post_immediately(attrs, user) do
  with {:ok, post} <- Social.create_immediate_post(attrs, user),
       {:ok, result} <- publish_post_now(post) do
    Social.mark_post_published(post, result)
  end
end

# Scheduled post (status: "scheduled", has scheduled_at)
def post_scheduled(attrs, user) do
  Social.schedule_post(attrs, user)
  # ScheduledPostWorker will pick it up when scheduled_at arrives
end
```

### Pattern 3: ScheduledPostWorker Integration
**What:** Existing GenServer polls every minute for scheduled posts
**When to use:** All scheduled tweets
**Example:**
```elixir
# Already implemented in ScheduledPostWorker:
# 1. Polls get_scheduled_posts_ready_to_publish/2
# 2. Locks post with lock_post_for_publishing/1
# 3. Calls Platform.call("twitter", :publish_media, [...]) for upload
# 4. Calls Platform.call("twitter", :create_tweet, [...]) for tweet (NEW)
# 5. Updates post with mark_post_published/2

# Need to modify ScheduledPostWorker.do_publish/3 to handle Twitter:
defp do_publish(%PostSubmission{platform: "twitter"} = post, account, access_token) do
  # 1. Upload media (already done by publish_media)
  case Platform.call("twitter", :publish_media, [access_token, post.media_url, opts]) do
    {:ok, %{media_id: media_id}} ->
      # 2. Create tweet with media_id (NEW)
      tweet_opts = %{
        media_ids: [media_id],
        caption: post.caption
      }
      case Platform.call("twitter", :create_tweet, [access_token, post.caption, tweet_opts]) do
        {:ok, result} ->
          handle_publish_success(post, result)
        {:error, reason} ->
          handle_publish_failure(post, inspect(reason), classify_error(reason))
      end
    {:error, reason} ->
      handle_publish_failure(post, inspect(reason), classify_error(reason))
  end
end
```

### Pattern 4: Post URL Construction
**What:** X API doesn't return post_url, must construct from username and post_id
**When to use:** After successful tweet creation
**Example:**
```elixir
def construct_post_url(access_token, post_id) do
  case get_user_profile(access_token) do
    {:ok, %{username: username}} ->
      "https://x.com/#{username}/status/#{post_id}"
    _ ->
      "https://x.com/i/status/#{post_id}"  # Fallback: /i/ redirects work
  end
end
```

### Anti-Patterns to Avoid
- **Uploading media more than 24 hours before tweeting:** Media IDs expire after 24 hours (sometimes 15 days for large videos), but safest to tweet immediately after upload
- **Not validating caption length client-side:** X API enforces 280 characters strictly, validate before scheduling
- **Assuming media.media_ids is optional:** If you uploaded media, you MUST include media_ids in tweet body or you'll get "media already used" errors
- **Using v1.1 POST statuses/update:** Deprecated, use v2 POST /2/tweets
- **Not handling "Your media IDs are invalid" gracefully:** Common error if media_id expired or typo, retry with fresh upload

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Background job scheduling | Custom cron system | ScheduledPostWorker GenServer (existing) | Already battle-tested with Instagram, handles locking, retries, transient failures |
| HTTP retries with backoff | Manual retry logic | HTTPoison's timeout + classify_error transient/permanent | Existing pattern in ScheduledPostWorker handles 429, 5xx |
| OAuth token refresh | Manual token check on each call | TokenRefreshWorker + maybe_refresh_org_token (existing) | Already refreshes tokens hourly, single-use refresh token handling |
| Post state machine | Custom status tracking | PostSubmission schema with status field | Already has pending → scheduled → publishing → published/failed flow |
| Media expiration handling | Custom TTL tracking | Upload immediately before scheduling OR re-upload on retry | Simpler than tracking expiration timestamps |

**Key insight:** Phoenix/Elixir already has robust patterns for scheduled background work. X API quirks (24hr media expiration, 280 char limit) are validation problems, not architecture problems.

## Common Pitfalls

### Pitfall 1: "Your media IDs are invalid" Error
**What goes wrong:** Tweet creation fails with 400 error even though media_id was just returned from upload
**Why it happens:**
- Media ID expired (24 hours passed since upload)
- Typo in media_id (string vs integer conversion)
- Missing `media.write` OAuth scope
- Media ID was already used in another tweet
**How to avoid:**
- Upload media immediately before creating tweet (< 1 minute gap)
- Store media_id as string, pass as string in array
- Verify `media.write` scope in OAuth flow (Phase 1 already has this)
- Don't reuse media_ids across posts
**Warning signs:**
- Scheduled posts failing with "invalid media" after long delays
- Error rate correlates with time between upload and tweet creation

### Pitfall 2: 280 Character Limit Enforcement
**What goes wrong:** Users paste long captions, scheduled post fails at publish time
**Why it happens:** X API strictly enforces 280 characters (not 280 UTF-8 bytes, 280 characters including emojis as single char)
**How to avoid:**
- Validate caption length in PostSubmission.create_changeset (already validates max 2200, update to 280 for Twitter)
- Add platform-specific validation: `if platform == "twitter", validate_length(:caption, max: 280)`
- Show character counter in UI
**Warning signs:**
- Failed posts with error message containing "text too long"
- Caption validation passes but API rejects

### Pitfall 3: Media Expiration on Scheduled Posts
**What goes wrong:** Schedule a post for 48 hours from now, media_id expires before posting
**Why it happens:** X media_ids expire after 24 hours (standard) or 15 days (large videos), but scheduler doesn't know this
**How to avoid:**
- **Option A:** Don't upload media until scheduled time arrives (store media_url, upload in ScheduledPostWorker)
- **Option B:** Limit scheduling window to 23 hours for Twitter
- **Option C:** Re-upload media if post fails with "invalid media" error (retry logic)
**Warning signs:**
- Scheduled posts work fine for < 24hr scheduling but fail for > 24hr
- Manual retry succeeds (new media_id)

### Pitfall 4: Missing post_url in Response
**What goes wrong:** X API only returns post_id, not post_url like Instagram does
**Why it happens:** X API v2 is minimal by default, need to construct URL yourself
**How to avoid:**
- Cache username from get_user_profile in SocialAccount
- Construct: `https://x.com/#{username}/status/#{post_id}`
- Fallback: `https://x.com/i/status/#{post_id}` (redirects work)
**Warning signs:**
- post_url is nil in database
- UI shows broken links

### Pitfall 5: Single-Use Refresh Tokens
**What goes wrong:** Token refresh works once, then fails with "invalid refresh token"
**Why it happens:** X uses single-use refresh tokens (each refresh invalidates old token and returns new one)
**How to avoid:**
- Phase 1 already handles this in Twitter.refresh_tokens/1
- MUST save new refresh_token from response
- TokenRefreshWorker already does this correctly
**Warning signs:**
- First post succeeds, subsequent posts fail with token errors
- Token refresh succeeds once then fails

### Pitfall 6: Rate Limits on POST /tweets
**What goes wrong:** Burst of scheduled posts hit rate limit (429 error)
**Why it happens:**
- Free tier: 1 post per 24 hours
- Basic tier: 100 posts per 24 hours (user-level)
- Pro tier: Higher limits
**How to avoid:**
- Check tier before scheduling bulk posts
- ScheduledPostWorker already classifies 429 as transient, retries with backoff
- Space scheduled posts 1-2 minutes apart minimum
**Warning signs:**
- Multiple scheduled posts fail simultaneously with 429
- Works in dev, fails in production with many users

## Code Examples

Verified patterns from official sources:

### X API v2 Create Tweet Request
```bash
# Source: https://docs.x.com/x-api/posts/create-post
curl --request POST \
  --url https://api.x.com/2/tweets \
  --header 'Authorization: Bearer <token>' \
  --header 'Content-Type: application/json' \
  --data '{
    "text": "Check out this clip!",
    "media": {
      "media_ids": ["1234567890123456789"]
    }
  }'
```

### X API v2 Create Tweet Response
```json
{
  "data": {
    "id": "1346889436626259968",
    "text": "Check out this clip!"
  }
}
```
**Note:** Response does NOT include post_url, username, or permalink. Must construct manually.

**Source:** [POST /2/tweets API Reference](https://developer.x.com/en/docs/x-api/tweets/manage-tweets/api-reference/post-tweets)

### Elixir Implementation in Twitter.ex
```elixir
# Add to lib/clippster_server/social/platforms/twitter.ex

@tweets_url "https://api.x.com/2/tweets"

@doc """
Creates a tweet with optional media attachments.

## Parameters
- access_token: OAuth 2.0 Bearer token
- text: Tweet text (max 280 characters)
- opts: Keyword list with optional:
  - :media_ids - List of media_id strings from prior upload
  - :reply_to_tweet_id - Tweet ID to reply to
  - :quote_tweet_id - Tweet ID to quote

## Returns
- {:ok, %{post_id: string, post_url: string}} on success
- {:error, reason} on failure
"""
def create_tweet(access_token, text, opts \\ []) do
  Logger.info("[Twitter] Creating tweet, text length: #{String.length(text)}")

  body = build_tweet_body(text, opts)

  headers = [
    {"Authorization", "Bearer #{access_token}"},
    {"Content-Type", "application/json"}
  ]

  case HTTPoison.post(@tweets_url, body, headers, @http_options) do
    {:ok, %HTTPoison.Response{status_code: 201, body: response_body}} ->
      handle_tweet_success(response_body, access_token)

    {:ok, %HTTPoison.Response{status_code: status, body: body}} ->
      Logger.error("[Twitter] Tweet creation failed: #{status} - #{body}")
      {:error, extract_error(body, {:api_error, status})}

    {:error, reason} ->
      Logger.error("[Twitter] HTTP error creating tweet: #{inspect(reason)}")
      {:error, reason}
  end
end

defp build_tweet_body(text, opts) do
  body = %{"text" => text}

  body = if media_ids = opts[:media_ids] do
    Map.put(body, "media", %{"media_ids" => media_ids})
  else
    body
  end

  body = if reply_id = opts[:reply_to_tweet_id] do
    Map.put(body, "reply", %{"in_reply_to_tweet_id" => reply_id})
  else
    body
  end

  body = if quote_id = opts[:quote_tweet_id] do
    Map.put(body, "quote_tweet_id", quote_id)
  else
    body
  end

  Jason.encode!(body)
end

defp handle_tweet_success(response_body, access_token) do
  case Jason.decode(response_body) do
    {:ok, %{"data" => %{"id" => post_id}}} ->
      # X API doesn't return post_url, construct it
      case get_user_profile(access_token) do
        {:ok, %{username: username}} ->
          post_url = "https://x.com/#{username}/status/#{post_id}"
          Logger.info("[Twitter] Tweet created: #{post_url}")
          {:ok, %{post_id: post_id, post_url: post_url}}

        {:error, _} ->
          # Fallback: /i/ redirects to actual tweet
          post_url = "https://x.com/i/status/#{post_id}"
          Logger.warning("[Twitter] Could not get username, using /i/ URL")
          {:ok, %{post_id: post_id, post_url: post_url}}
      end

    {:ok, %{"errors" => errors}} ->
      error_msg = extract_error_from_errors(errors)
      Logger.error("[Twitter] Tweet creation error: #{error_msg}")
      {:error, error_msg}

    _ ->
      Logger.error("[Twitter] Invalid response format")
      {:error, :invalid_response}
  end
end
```

### Platform Callback Updates
```elixir
# Update @behaviour ClippsterServer.Social.Platform
# Add new required callback:

@callback create_tweet(access_token :: String.t(), text :: String.t(), opts :: keyword()) ::
  {:ok, %{post_id: String.t(), post_url: String.t()}} | {:error, term()}
```

### ScheduledPostWorker Modifications
```elixir
# Modify do_publish in scheduled_post_worker.ex to handle Twitter

defp do_publish(%PostSubmission{platform: "twitter"} = post, account, access_token) do
  Logger.info("[ScheduledPostWorker] Publishing Twitter post #{post.id}")

  # Step 1: Upload media (returns media_id)
  media_opts = %{
    filename: extract_filename(post.media_url),
    ig_user_id: get_platform_user_id(account)
  }

  case Platform.call("twitter", :publish_media, [access_token, post.media_url, media_opts]) do
    {:ok, %{media_id: media_id}} ->
      Logger.info("[ScheduledPostWorker] Media uploaded: #{media_id}")

      # Step 2: Create tweet with media_id
      tweet_opts = [
        media_ids: [media_id]
      ]

      case Platform.call("twitter", :create_tweet, [access_token, post.caption || "", tweet_opts]) do
        {:ok, result} ->
          handle_publish_success(post, result)

        {:error, reason} ->
          error_type = classify_error(reason)
          handle_publish_failure(post, inspect(reason), error_type)
      end

    {:error, reason} ->
      error_type = classify_error(reason)
      handle_publish_failure(post, inspect(reason), error_type)
  end
end

# Keep existing Instagram handler
defp do_publish(%PostSubmission{platform: "instagram"} = post, account, access_token) do
  # ... existing code
end
```

### Caption Validation (PostSubmission Schema)
```elixir
# Update validate_caption in post_submission.ex

defp validate_caption(changeset) do
  platform = get_field(changeset, :platform)
  caption = get_field(changeset, :caption) || ""

  changeset = case platform do
    "twitter" ->
      validate_length(changeset, :caption, max: 280, message: "Twitter captions limited to 280 characters")
    "instagram" ->
      validate_length(changeset, :caption, max: 2200, message: "Instagram captions limited to 2,200 characters")
    _ ->
      validate_length(changeset, :caption, max: 2200)
  end

  # Hashtag validation (applies to all platforms)
  hashtag_count = Regex.scan(~r/#\w+/, caption) |> length()

  if hashtag_count > 30 do
    add_error(changeset, :caption, "cannot have more than 30 hashtags")
  else
    changeset
  end
end
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| v1.1 POST statuses/update | v2 POST /2/tweets | 2021-2022 | Separate media upload (v1.1) from tweet creation (v2) |
| Single refresh_token reuse | Single-use refresh tokens | 2021 | Must save new refresh_token on each refresh |
| Webhooks for all events | Polling + selective webhooks | 2023 | Webhooks require paid tier, polling is free tier compatible |
| 140 character limit | 280 character limit | 2017 | Standard limit doubled, but API enforces strictly |
| Extended tweets (4000+ chars) | 280 only via API | 2023+ | Twitter Blue users can post long tweets in UI, but API still 280 max |

**Deprecated/outdated:**
- **v1.1 POST statuses/update with media:** Use v2 POST /2/tweets with media.media_ids from v1.1 upload
- **Assuming webhooks work on free tier:** Requires paid API access
- **Reusing media_ids indefinitely:** Expire after 24 hours (standard) or 15 days (large video)

## Open Questions

1. **Media ID expiration handling for far-future scheduled posts**
   - What we know: Media IDs expire after 24 hours (sometimes 15 days for large videos)
   - What's unclear: Should we block scheduling > 23 hours or re-upload on publish?
   - Recommendation: **Option A for MVP:** Store media_url, upload media in ScheduledPostWorker right before tweeting. This matches Instagram's pattern and avoids expiration issues.

2. **Rate limit handling for bulk scheduled posts**
   - What we know: Basic tier = 100 posts per 24 hours per user, Free tier = 1 post per 24 hours
   - What's unclear: Should we enforce rate limits in scheduler or let X API reject?
   - Recommendation: Let API reject with 429, ScheduledPostWorker already handles as transient error and retries. Add rate limit warning in UI when scheduling many posts.

3. **Username caching strategy**
   - What we know: Need username to construct post_url, but get_user_profile requires extra API call
   - What's unclear: Cache username in SocialAccount.platform_username or call on every tweet?
   - Recommendation: Cache username in SocialAccount.platform_username (already exists), update on token refresh. Use cached value for post_url construction.

## Sources

### Primary (HIGH confidence)
- [X API Create Post Documentation](https://docs.x.com/x-api/posts/create-post) - POST /2/tweets endpoint structure
- [X API POST /2/tweets Reference](https://developer.x.com/en/docs/x-api/tweets/manage-tweets/api-reference/post-tweets) - Request/response format
- [X API Rate Limits Documentation](https://docs.x.com/x-api/fundamentals/rate-limits) - Rate limit tiers
- Existing codebase: `scheduled_post_worker.ex`, `post_submission.ex`, `twitter.ex` - Verified patterns

### Secondary (MEDIUM confidence)
- [X API Media Upload Tutorial](https://developer.x.com/en/docs/tutorials/tweeting-media-v2) - Two-step upload + tweet workflow
- [X Developer Community: Media IDs Invalid](https://devcommunity.x.com/t/tweet-with-media-throws-error-your-media-ids-are-invalid-v2-api/241544) - Common pitfalls
- [Media ID Expiration Discussion](https://devcommunity.x.com/t/media-ids-expires-after-secs-of-1-day-is-too-short-any-way-to-change/86155) - 24-hour expiration confirmed

### Tertiary (LOW confidence)
- Community reports of 280 character limit still enforced via API despite Twitter Blue - needs verification with actual API test

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - X API v2 is official, HTTPoison/Jason/Ecto already in use
- Architecture: HIGH - Instagram pattern is battle-tested, applies directly to Twitter
- Pitfalls: MEDIUM-HIGH - Media expiration confirmed via docs, "invalid media_ids" error common in community

**Research date:** 2026-02-09
**Valid until:** 2026-03-09 (30 days - X API v2 is stable, but rate limits and tiers may change)
