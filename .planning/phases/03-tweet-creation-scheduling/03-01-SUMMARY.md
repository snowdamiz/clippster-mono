---
phase: 03-tweet-creation-scheduling
plan: 01
subsystem: social/twitter
status: complete
completed_at: 2026-02-10T02:42:14Z
executor: sonnet-4.5

tags:
  - twitter
  - x-api
  - tweet-creation
  - validation
  - caption-limits

dependency_graph:
  requires:
    - phase: 02
      plan: 02
      artifact: "Twitter.publish_media/3 with media_id return"
  provides:
    - "Twitter.create_tweet/3 for X API v2 tweet creation"
    - "Platform-specific caption validation (280 chars for Twitter)"
  affects:
    - "server/lib/clippster_server/social/platforms/twitter.ex"
    - "server/lib/clippster_server/social/post_submission.ex"
    - phase: 03
      plan: 02
      note: "ScheduledPostWorker will call create_tweet/3"

tech_stack:
  added:
    - component: "Twitter.create_tweet/3"
      tech: "X API v2 POST /2/tweets"
      purpose: "Create tweets with optional media attachments"
  patterns:
    - "OAuth 2.0 Bearer token authentication"
    - "Username-based post URL construction with /i/ fallback"
    - "Platform-specific schema validation"

key_files:
  created: []
  modified:
    - path: "server/lib/clippster_server/social/platforms/twitter.ex"
      changes:
        - "Added @tweets_url module attribute"
        - "Added create_tweet/3 public function"
        - "Added build_tweet_body/2 helper"
        - "Added handle_tweet_success/2 helper"
      lines_added: 83
    - path: "server/lib/clippster_server/social/post_submission.ex"
      changes:
        - "Updated validate_caption/1 with platform-specific limits"
        - "Added 280-char limit for Twitter"
        - "Added platform-aware error messages"
      lines_added: 12

decisions:
  - decision: "Use get_user_profile/1 fallback to /i/ URL for post_url construction"
    rationale: "Profile fetch may fail but we still need a valid URL; /i/ format works without username"
    alternatives: ["Always use /i/ format", "Require username in opts"]
    impact: "More reliable post URL generation even if profile API is unavailable"

  - decision: "Enforce 280-char limit at schema level for Twitter"
    rationale: "Prevent scheduling posts that will fail at publish time due to API limits"
    alternatives: ["Validate only at publish time", "Soft validation with warnings"]
    impact: "Catches validation errors early in the UX flow"

  - decision: "Support optional media_ids in create_tweet/3"
    rationale: "Matches X API design where upload and tweet creation are separate operations"
    alternatives: ["Combine upload and tweet creation", "Always require media"]
    impact: "Flexible API that supports text-only tweets and media tweets"

metrics:
  duration_minutes: 1.9
  tasks_completed: 2
  files_modified: 2
  commits: 2
  tests_added: 0
  deviations: 0
---

# Phase 03 Plan 01: Tweet Creation Foundation Summary

**One-liner:** Added Twitter.create_tweet/3 for X API v2 posting with platform-specific 280-character caption validation.

## What Was Built

### 1. Twitter.create_tweet/3 Function

Implemented complete tweet creation flow in Twitter platform module:

- **Endpoint:** POST https://api.x.com/2/tweets
- **Authentication:** OAuth 2.0 Bearer token
- **Request body:** JSON with `text` and optional `media.media_ids`
- **Response handling:**
  - 201 success → parse `data.id` as post_id
  - Non-201 → extract error via existing error handler
- **Post URL construction:**
  - Primary: Fetch username via `get_user_profile/1`, build `https://x.com/{username}/status/{post_id}`
  - Fallback: Use `https://x.com/i/status/{post_id}` if profile fetch fails
- **Logging:** Info for start/success, error for failures
- **Timeout:** Uses existing `@http_options` (30 seconds)

**Helper functions added:**
- `build_tweet_body/2` - Constructs JSON request body with optional media_ids
- `handle_tweet_success/2` - Parses response and builds post_url with fallback

### 2. Platform-Specific Caption Validation

Updated `PostSubmission.validate_caption/1` to enforce per-platform character limits:

| Platform  | Max Length | Error Message                              |
|-----------|------------|--------------------------------------------|
| Twitter   | 280 chars  | "Twitter captions limited to 280 characters" |
| Instagram | 2200 chars | "caption cannot exceed 2,200 characters"   |
| Others    | 2200 chars | "caption cannot exceed 2,200 characters"   |

**Preserved existing validation:**
- Hashtag limit (max 30)
- All validation runs in same changeset pipeline

## Implementation Notes

### API Design
The `create_tweet/3` function is NOT a Platform behaviour callback - it's a Twitter-specific function called via `Platform.call("twitter", :create_tweet, [...])`. This matches the pattern established by `publish_media/3` where X's API requires separate upload and creation operations.

### Post URL Fallback Strategy
We call `get_user_profile/1` after successful tweet creation to build the canonical URL format. If that fails (network issue, rate limit, etc.), we fall back to the `/i/` URL format which X supports without requiring the username. This ensures we always return a valid URL.

### Validation Timing
Platform-specific caption validation happens at schema level (create/schedule changeset), not at publish time. This provides immediate feedback in the UI and prevents users from scheduling posts that will fail at publish time.

## Deviations from Plan

None - plan executed exactly as written.

## Integration Points

### Upstream Dependencies
- **Phase 02-02:** Requires `Twitter.publish_media/3` which returns media_id for video uploads
- **Existing:** Uses `get_user_profile/1` for username resolution
- **Existing:** Uses `extract_error/2` and `extract_error_from_errors/1` helpers

### Downstream Consumers
- **Phase 03-02:** ScheduledPostWorker will call `create_tweet/3` when publishing scheduled tweets
- **PostSubmissionController:** Can now validate Twitter captions at 280 chars before saving

## Verification Results

1. **Compilation:** Clean compilation with `mix compile --warnings-as-errors` (zero warnings)
2. **Function existence:** `def create_tweet` confirmed at line 244
3. **Module attribute:** `@tweets_url` confirmed at line 27
4. **Endpoint:** `api.x.com/2/tweets` confirmed in module attribute
5. **Twitter validation:** `"twitter" -> 280` confirmed at line 354
6. **Platform-specific error:** Confirmed at line 359

## Self-Check: PASSED

All commits and files verified:

**Commits:**
- FOUND: 298d726 (Task 1 - Twitter.create_tweet/3)
- FOUND: ec3cb88 (Task 2 - Platform-specific validation)

**Files:**
- FOUND: server/lib/clippster_server/social/platforms/twitter.ex
- FOUND: server/lib/clippster_server/social/post_submission.ex

All implementation artifacts present and committed successfully.
