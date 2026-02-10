# Phase 2: Chunked Video Upload - Research

**Researched:** 2026-02-09
**Domain:** X API v2 Media Upload / Cloudflare R2 Presigned URLs / Video Processing
**Confidence:** MEDIUM-HIGH

## Summary

Phase 2 implements X API v2 chunked media upload for videos using the three-phase INIT/APPEND/FINALIZE workflow with asynchronous processing validation. The X API requires all video uploads to use the chunked upload endpoint at `https://api.x.com/2/media/upload` with OAuth 2.0 user context authentication and the `media.write` scope. Videos must be processed asynchronously with polling until the processing state reaches "succeeded" before the media_id can be used in tweet creation.

The implementation pattern follows a multi-step workflow: (1) validate video format/size locally, (2) INIT the upload session to receive a media_id, (3) split video into 1MB chunks and APPEND each sequentially, (4) FINALIZE to trigger processing, (5) poll STATUS endpoint respecting check_after_secs until processing succeeds. For videos stored in Cloudflare R2, the system must generate presigned URLs (using existing ExAws.S3 infrastructure) so X can download the video during processing.

The project already has HTTPoison for HTTP requests and ExAws.S3 for R2 integration. No additional dependencies are required. The existing Platform behavior pattern and TokenRefreshWorker provide the foundation.

**Primary recommendation:** Implement chunked upload as a synchronous multi-step function (not GenServer) that blocks until processing succeeds, using 1MB chunks and exponential backoff polling with the check_after_secs guidance from X.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| HTTPoison | 2.2+ | HTTP client for X API requests | Already in project, used for Instagram, supports multipart/form-data |
| ExAws.S3 | 2.5+ | R2 presigned URL generation | Already in project, S3-compatible API works with R2 |
| Jason | 1.2+ | JSON encoding/decoding | Already in project, handles X API responses |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| hackney | 1.20+ | HTTP client backend for HTTPoison | Already in project, required by ExAws |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Synchronous upload function | GenServer with async upload | GenServer adds complexity; chunked upload is request-scoped, not long-lived process |
| FFmpex for validation | Manual file inspection | FFmpex adds external dependency; basic validation (size, extension) sufficient for MVP |
| Custom retry logic | Existing library | Custom is simpler for this specific polling pattern with check_after_secs |

**Installation:**
No new dependencies required. All libraries already in mix.exs.

## Architecture Patterns

### Recommended Module Structure
```
lib/clippster_server/social/platforms/
├── twitter.ex                    # Add publish_media implementation
lib/clippster_server/social/
├── twitter_chunked_upload.ex     # New: Chunked upload logic (INIT/APPEND/FINALIZE/STATUS)
├── video_validator.ex            # New: Validate format before upload
```

### Pattern 1: Synchronous Multi-Step Upload with Polling
**What:** A single function that orchestrates INIT → APPEND (chunks) → FINALIZE → poll STATUS until succeeded. Blocks the calling process until complete or timeout.
**When to use:** Request-scoped uploads where the caller needs to know the final media_id immediately. Simplifies error handling and state management.
**Example:**
```elixir
# Source: Architecture pattern derived from X API workflow
def upload_video(access_token, video_url, opts \\ []) do
  with {:ok, video_binary} <- fetch_video(video_url),
       {:ok, _} <- validate_video(video_binary, opts),
       {:ok, media_id} <- init_upload(access_token, byte_size(video_binary)),
       :ok <- append_chunks(access_token, media_id, video_binary),
       {:ok, processing_info} <- finalize_upload(access_token, media_id),
       {:ok, _} <- poll_until_ready(access_token, media_id, processing_info) do
    {:ok, media_id}
  end
end
```

### Pattern 2: Chunked Binary Upload with Multipart Form Data
**What:** Split binary into fixed-size chunks (1MB recommended) and upload each via multipart/form-data POST with segment_index.
**When to use:** All X API video uploads (required by API).
**Example:**
```elixir
# Source: HTTPoison multipart approach
defp append_chunk(access_token, media_id, chunk_binary, segment_index) do
  url = "https://api.x.com/2/media/upload"

  body = {:multipart, [
    {"command", "APPEND"},
    {"media_id", media_id},
    {"segment_index", "#{segment_index}"},
    {:file, chunk_binary, {"form-data", [name: "media"]}, []}
  ]}

  headers = [
    {"Authorization", "Bearer #{access_token}"},
    {"Content-Type", "multipart/form-data"}
  ]

  HTTPoison.post(url, body, headers, @http_options)
end
```

### Pattern 3: Exponential Backoff Polling with check_after_secs
**What:** Poll STATUS endpoint using the check_after_secs value from processing_info, with exponential backoff fallback if not provided.
**When to use:** After FINALIZE, to wait for X to process the video.
**Example:**
```elixir
# Source: X API processing_info guidance
defp poll_until_ready(access_token, media_id, processing_info, max_attempts \\ 60) do
  check_after = Map.get(processing_info, "check_after_secs", 5)
  do_poll(access_token, media_id, check_after, 0, max_attempts)
end

defp do_poll(access_token, media_id, wait_seconds, attempt, max_attempts) do
  :timer.sleep(wait_seconds * 1000)

  case get_status(access_token, media_id) do
    {:ok, %{"processing_info" => %{"state" => "succeeded"}}} ->
      {:ok, :ready}

    {:ok, %{"processing_info" => %{"state" => "failed", "error" => error}}} ->
      {:error, {:processing_failed, error}}

    {:ok, %{"processing_info" => info}} when attempt < max_attempts ->
      next_wait = Map.get(info, "check_after_secs", wait_seconds)
      do_poll(access_token, media_id, next_wait, attempt + 1, max_attempts)

    _ ->
      {:error, :timeout}
  end
end
```

### Pattern 4: R2 Presigned URL for Video Download During Processing
**What:** Generate presigned URL for video in R2 so X can download it during processing (alternative to uploading binary chunks).
**When to use:** When video is already in R2 storage and uploading chunks would be redundant.
**Example:**
```elixir
# Source: Existing ClippsterServer.Storage module
alias ClippsterServer.Storage

# Generate presigned URL with 1 hour expiration
{:ok, presigned_url} = Storage.presigned_url(video_key, expires_in: 3600)

# Pass presigned_url as media_url in INIT if using async processing with URL
```

### Anti-Patterns to Avoid
- **Uploading full video as single request:** X requires chunked upload for videos; single POST will fail
- **5MB chunks:** While technically allowed, 5MB chunks have higher timeout/failure rates; use 1MB
- **Polling without check_after_secs:** Ignoring API guidance causes rate limiting; always respect the returned interval
- **Not validating before upload:** X will reject invalid videos after full upload; validate format/size first
- **GenServer for single upload:** Adds complexity without benefit; uploads are request-scoped operations

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Video codec validation | Custom FFmpeg parser | File extension + size checks (MVP), FFmpex library (later) | Full codec validation requires FFmpeg binary; basic validation sufficient for MVP |
| HTTP retry logic | Custom exponential backoff | check_after_secs from X API | X tells us exactly when to retry; custom logic ignores their guidance |
| Presigned URL generation | Custom S3 signature v4 | ExAws.S3.presigned_url | Already in project, handles complex signing correctly |
| Chunk splitting | Manual binary manipulation | Erlang :binary.part/3 or Enum.chunk_every/2 | Built-in functions handle edge cases correctly |

**Key insight:** X API provides specific guidance (check_after_secs, processing state machine) that eliminates need for custom retry logic. Use their workflow, don't reinvent it.

## Common Pitfalls

### Pitfall 1: Missing media.write Scope
**What goes wrong:** Upload fails with 403 "not permitted to use OAuth2 on this endpoint" despite valid access token.
**Why it happens:** X API v2 media upload requires the `media.write` scope in addition to tweet.write. Phase 1 may not have included this scope.
**How to avoid:** Ensure authorize_url includes `media.write` in scope parameter. User must re-authenticate if scope changes.
**Warning signs:** 403 errors on INIT command, error message mentions OAuth2 permissions.

### Pitfall 2: Not Respecting check_after_secs
**What goes wrong:** Rate limiting errors (429) during STATUS polling, or wasted API calls polling too frequently.
**Why it happens:** X returns check_after_secs (typically 5 seconds) but developers poll every 1 second or use fixed intervals.
**How to avoid:** Always use the check_after_secs value from processing_info. If missing, default to 5 seconds, not less.
**Warning signs:** 429 rate limit errors during polling, X API telling you to slow down.

### Pitfall 3: Uploading Chunks Out of Order
**What goes wrong:** Upload fails or produces corrupted video.
**Why it happens:** APPEND requests sent concurrently or with wrong segment_index values.
**How to avoid:** Upload chunks sequentially with segment_index starting at 0, incrementing by 1. Wait for each APPEND to complete before starting next.
**Warning signs:** X returns errors about missing segments or invalid segment_index.

### Pitfall 4: Not Validating Video Before Upload
**What goes wrong:** Full video uploads (takes minutes), then FINALIZE fails due to invalid format/size.
**Why it happens:** Skipping validation step to save time.
**How to avoid:** Check file size (<= 512MB for non-premium), extension (MP4/MOV), duration (<= 140s) BEFORE calling INIT.
**Warning signs:** FINALIZE returns format errors after long upload, wasted time and bandwidth.

### Pitfall 5: Using v1.1 upload.twitter.com Endpoint
**What goes wrong:** Endpoint deprecated after March 31, 2025; will stop working.
**Why it happens:** Old documentation or examples reference v1.1 endpoint.
**How to avoid:** Use `https://api.x.com/2/media/upload` for all upload commands (INIT/APPEND/FINALIZE/STATUS).
**Warning signs:** Warnings in X developer console, deprecation notices in API responses.

### Pitfall 6: Timeout on Large Files Without Chunking
**What goes wrong:** HTTPoison timeout (default 30s) trying to upload full 512MB video.
**Why it happens:** Not splitting into chunks or uploading as single request.
**How to avoid:** Always chunk videos into 1MB pieces, upload incrementally. Each APPEND completes quickly.
**Warning signs:** :timeout errors from HTTPoison, uploads failing on large files but succeeding on small ones.

### Pitfall 7: Presigned URL Expires During Processing
**What goes wrong:** X processing fails because presigned URL expired before download completed.
**Why it happens:** Default 1 hour expiration too short for large videos or slow processing.
**How to avoid:** Generate presigned URLs with longer expiration (3-6 hours) for video uploads. X may take time to download and process.
**Warning signs:** Processing fails with download errors, presigned URL errors in X API response.

## Code Examples

Verified patterns from official sources and existing project code:

### INIT Command
```elixir
# Source: X API v2 chunked upload docs
defp init_upload(access_token, total_bytes, media_type \\ "video/mp4") do
  url = "https://api.x.com/2/media/upload"

  body = URI.encode_query(%{
    "command" => "INIT",
    "media_type" => media_type,
    "total_bytes" => total_bytes,
    "media_category" => "tweet_video"
  })

  headers = [
    {"Authorization", "Bearer #{access_token}"},
    {"Content-Type", "application/x-www-form-urlencoded"}
  ]

  case HTTPoison.post(url, body, headers, timeout: 30_000, recv_timeout: 30_000) do
    {:ok, %HTTPoison.Response{status_code: 200, body: response_body}} ->
      case Jason.decode(response_body) do
        {:ok, %{"media_id_string" => media_id}} -> {:ok, media_id}
        _ -> {:error, :invalid_response}
      end
    {:ok, %HTTPoison.Response{status_code: status, body: error_body}} ->
      {:error, {:init_failed, status, error_body}}
    {:error, reason} ->
      {:error, reason}
  end
end
```

### APPEND Command with Multipart Form Data
```elixir
# Source: HTTPoison multipart + X API APPEND docs
defp append_chunk(access_token, media_id, chunk_binary, segment_index) do
  url = "https://api.x.com/2/media/upload"

  body = {:multipart, [
    {"command", "APPEND"},
    {"media_id", media_id},
    {"segment_index", "#{segment_index}"},
    {:file, chunk_binary, {"form-data", [name: "media"]}, []}
  ]}

  headers = [
    {"Authorization", "Bearer #{access_token}"},
    {"Content-Type", "multipart/form-data"}
  ]

  case HTTPoison.post(url, body, headers, timeout: 60_000, recv_timeout: 60_000) do
    {:ok, %HTTPoison.Response{status_code: 200}} -> :ok
    {:ok, %HTTPoison.Response{status_code: status, body: error_body}} ->
      {:error, {:append_failed, segment_index, status, error_body}}
    {:error, reason} ->
      {:error, reason}
  end
end
```

### FINALIZE Command
```elixir
# Source: X API v2 chunked upload docs
defp finalize_upload(access_token, media_id) do
  url = "https://api.x.com/2/media/upload"

  body = URI.encode_query(%{
    "command" => "FINALIZE",
    "media_id" => media_id
  })

  headers = [
    {"Authorization", "Bearer #{access_token}"},
    {"Content-Type", "application/x-www-form-urlencoded"}
  ]

  case HTTPoison.post(url, body, headers, timeout: 30_000, recv_timeout: 30_000) do
    {:ok, %HTTPoison.Response{status_code: 200, body: response_body}} ->
      case Jason.decode(response_body) do
        {:ok, %{"processing_info" => info}} -> {:ok, info}
        {:ok, _} -> {:ok, %{}} # No processing_info means immediate success
        _ -> {:error, :invalid_response}
      end
    {:ok, %HTTPoison.Response{status_code: status, body: error_body}} ->
      {:error, {:finalize_failed, status, error_body}}
    {:error, reason} ->
      {:error, reason}
  end
end
```

### STATUS Command (GET)
```elixir
# Source: X API v2 STATUS endpoint docs
defp get_status(access_token, media_id) do
  url = "https://api.x.com/2/media/upload?command=STATUS&media_id=#{media_id}"

  headers = [
    {"Authorization", "Bearer #{access_token}"}
  ]

  case HTTPoison.get(url, headers, timeout: 30_000, recv_timeout: 30_000) do
    {:ok, %HTTPoison.Response{status_code: 200, body: response_body}} ->
      Jason.decode(response_body)
    {:ok, %HTTPoison.Response{status_code: status, body: error_body}} ->
      {:error, {:status_check_failed, status, error_body}}
    {:error, reason} ->
      {:error, reason}
  end
end
```

### Video Validation
```elixir
# Source: X API video requirements + requirements doc
defp validate_video(video_binary, opts \\ []) do
  # X API non-premium limits
  max_size = opts[:max_size] || 512 * 1024 * 1024  # 512MB
  max_duration = opts[:max_duration] || 140  # 140 seconds

  size = byte_size(video_binary)

  cond do
    size > max_size ->
      {:error, {:validation_failed, "Video exceeds 512MB limit"}}

    size == 0 ->
      {:error, {:validation_failed, "Video file is empty"}}

    true ->
      # For MVP: basic validation passes
      # Later: Add FFmpeg codec/duration check
      :ok
  end
end
```

### Presigned URL Generation
```elixir
# Source: Existing ClippsterServer.Storage module
alias ClippsterServer.Storage

# Generate presigned URL for R2-stored video
def generate_video_presigned_url(video_key) do
  # Longer expiration for video processing
  Storage.presigned_url(video_key, expires_in: 21_600)  # 6 hours
end
```

### Chunk Splitting
```elixir
# Source: Elixir binary operations
defp split_into_chunks(binary, chunk_size \\ 1_024_000) do  # 1MB default
  total_size = byte_size(binary)
  chunk_count = ceil(total_size / chunk_size)

  for i <- 0..(chunk_count - 1) do
    offset = i * chunk_size
    length = min(chunk_size, total_size - offset)
    :binary.part(binary, offset, length)
  end
end
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| v1.1 upload.twitter.com | v2 api.x.com/2/media/upload | March 2025 | Must use new endpoint, OAuth 2.0 required |
| OAuth 1.0a only | OAuth 2.0 user context | 2024-2025 | Requires PKCE flow, media.write scope |
| tweet.write scope sufficient | media.write scope required | 2024-2025 | Must request additional scope during auth |
| plays/video_views metrics | views metric unified | 2024-2025 | Not relevant for Phase 2, but good to know |

**Deprecated/outdated:**
- upload.twitter.com/1.1/media/upload.json: Deprecated March 31, 2025 - use api.x.com/2/media/upload
- OAuth 1.0a for media upload: Still works but OAuth 2.0 is recommended path forward
- Command-based endpoints with separate /initialize, /append, /finalize paths: Initial v2 approach had issues, use command parameter instead

## Open Questions

1. **Should we implement FFmpeg validation or stick with basic checks?**
   - What we know: FFmpex library available but adds external dependency
   - What's unclear: Will X API validation be sufficient, or will users hit errors after upload?
   - Recommendation: Start with basic validation (size, extension), add FFmpeg in Phase 4 if needed

2. **Should we support uploading from R2 via presigned URL instead of binary chunks?**
   - What we know: X API may support downloading from URL during INIT (async processing)
   - What's unclear: Official docs don't clearly document passing media_url parameter in INIT
   - Recommendation: Implement chunk upload first (documented), investigate URL approach as optimization later

3. **What timeout values should we use for large video processing?**
   - What we know: X API recommends polling until succeeded, check_after_secs typically 5 seconds
   - What's unclear: Maximum processing time for 512MB video, when to give up
   - Recommendation: 60 polling attempts (5 minutes total) with check_after_secs intervals, surface timeout to user

4. **How should we handle concurrent uploads from same user?**
   - What we know: Each upload gets unique media_id, uploads are independent
   - What's unclear: X API rate limits on INIT/APPEND/FINALIZE commands for free tier
   - Recommendation: Sequential uploads per user, investigate rate limits during testing

## Sources

### Primary (HIGH confidence)
- X API v2 Chunked Media Upload Docs: https://docs.x.com/x-api/media/quickstart/media-upload-chunked
- ExAws.S3 presigned_url documentation: https://hexdocs.pm/ex_aws_s3/ExAws.S3.html
- Cloudflare R2 Presigned URLs: https://developers.cloudflare.com/r2/api/s3/presigned-urls/
- Existing project code: ClippsterServer.Storage, ClippsterServer.Social.Platforms.Twitter

### Secondary (MEDIUM confidence)
- [X Developer Community: media.write scope requirement](https://devcommunity.x.com/t/how-to-upload-media-to-twitter-api-v2-using-oauth-2-0/238518)
- [X Developer Community: v2 media upload announcement](https://devcommunity.x.com/t/announcing-media-upload-endpoints-in-the-x-api-v2/234175)
- [X Developer Community: chunked upload limits](https://devcommunity.x.com/t/new-chunked-media-upload-initialize-and-finalize-endpoint-limits-too-low/242138)
- [X Video Size Guide 2026](https://postfa.st/sizes/x/video)
- [Elixir Forum: HTTPoison multipart binary upload](https://elixirforum.com/t/httpoison-file-upload-from-binary/4220)
- [X Developer Community: chunk sizing best practice](https://devcommunity.x.com/t/video-media-upload-chunk-sizing/253466)

### Tertiary (LOW confidence)
- WebSearch results about FFmpeg validation in Elixir (no specific 2026 updates found)
- WebSearch results about R2 range request issues (community reports, not official Cloudflare stance)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project, documented usage
- Architecture patterns: MEDIUM-HIGH - X API workflow well-documented, HTTPoison multipart verified from community examples
- Pitfalls: MEDIUM - Based on developer community reports and X API migration timeline, not first-hand experience
- Video validation: LOW-MEDIUM - X API requirements documented, but FFmpeg integration pattern uncertain

**Research date:** 2026-02-09
**Valid until:** 2026-03-09 (30 days) - X API v2 media endpoints are stable, but rate limits and free tier features may change

**Notes:**
- No CONTEXT.md exists for this phase, all implementation approaches at Claude's discretion
- Phase 1 OAuth implementation may need scope update to include media.write
- Existing Platform behavior pattern provides clear integration point
- HTTPoison and ExAws.S3 already proven in Instagram integration
