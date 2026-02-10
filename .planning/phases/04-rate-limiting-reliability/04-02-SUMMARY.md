---
phase: 04-rate-limiting-reliability
plan: 02
subsystem: social/twitter-api
tags: [duplicate-detection, content-hashing, reliability, twitter]

dependency_graph:
  requires:
    - phase: 04-01
      provides: "TwitterApiClient and TwitterRateLimiter infrastructure"
  provides:
    - "TwitterDuplicateDetector.check_duplicate/3 - SHA-256 duplicate detection"
    - "TwitterDuplicateDetector.generate_hash/2 - Content hash generator"
    - "Duplicate detection in ScheduledPostWorker Twitter flow"
    - "Duplicate detection in PostSubmissionController Twitter flow"
    - "content_hash storage on post_submissions after publish"
  affects:
    - "Phase 05+ Twitter publishing will benefit from duplicate prevention"
    - "Analytics tracking can now deduplicate content via content_hash"

tech_stack:
  added: []
  patterns:
    - "Pre-flight duplicate detection to prevent API quota waste"
    - "Two-stage content hashing: caption-only pre-check, caption+media final hash"
    - "24-hour lookback window for duplicate detection"

key_files:
  created:
    - path: "server/lib/clippster_server/social/twitter_duplicate_detector.ex"
      lines: 102
      exports: ["check_duplicate/3", "generate_hash/2"]
  modified:
    - path: "server/lib/clippster_server/social/platforms/twitter.ex"
      change: "Wired TwitterApiClient into exchange_code, refresh_tokens, get_user_profile, create_tweet"
    - path: "server/lib/clippster_server/social/post_submission.ex"
      change: "Added content_hash field and included in publish_changeset"
    - path: "server/lib/clippster_server/social/scheduled_post_worker.ex"
      change: "Added duplicate check before Twitter publish, store content_hash after success"
    - path: "server/lib/clippster_server_web/controllers/post_submission_controller.ex"
      change: "Added duplicate check before Twitter publish, store content_hash after success"

decisions:
  - context: "Content hash composition"
    decision: "Use caption + sorted media IDs for hash, SHA-256 encoding"
    rationale: "Matches X API duplicate detection behavior; sorting ensures consistent hashing regardless of media order"
    alternatives: ["Caption only (rejected - misses media duplicates)", "Include timestamps (rejected - would never match)"]

  - context: "Duplicate detection window"
    decision: "24-hour lookback window"
    rationale: "X API enforces duplicate detection; 24 hours balances catching duplicates vs allowing intentional reposts"
    alternatives: ["Infinite lookback (rejected - too restrictive)", "No window (rejected - defeats purpose)"]

  - context: "Two-stage hashing strategy"
    decision: "Pre-check with caption only, final hash with caption + media_id"
    rationale: "Media hasn't uploaded yet at pre-check time; final hash includes media_id for accurate future duplicate detection"
    alternatives: ["Wait for upload to hash (rejected - wastes API quota on media upload)", "Caption-only always (rejected - misses media duplicates)"]

  - context: "Query scope for duplicates"
    decision: "Check per-account (org or user social account ID)"
    rationale: "Same content posted to different accounts is allowed; per-account prevents false positives"
    alternatives: ["Global duplicate check (rejected - too restrictive)", "Per-organization (rejected - personal accounts would share)"]

  - context: "TwitterApiClient integration scope"
    decision: "Only X API endpoints (not analytics or video download)"
    rationale: "TwitterApiClient retry/rate-limit logic designed for X API; analytics uses twitterapi.io (different rate limits), video download hits R2/external URLs (no retry needed)"
    alternatives: ["All HTTPoison calls (rejected - wrong retry behavior for non-X endpoints)"]

metrics:
  duration: "3m"
  tasks_completed: 2
  files_created: 1
  files_modified: 4
  tests_added: 0
  completed_date: "2026-02-10"

---

# Phase 04 Plan 02: Duplicate Detection & TwitterApiClient Integration Summary

**Duplicate detection with SHA-256 content hashing and TwitterApiClient wired into all X API calls**

## Performance

- **Duration:** 3 minutes
- **Started:** 2026-02-10T03:20:49Z
- **Completed:** 2026-02-10T03:23:58Z
- **Tasks:** 2
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- Created TwitterDuplicateDetector module with SHA-256 content hashing and 24-hour duplicate detection window
- Wired TwitterApiClient into Twitter platform module for all X API HTTP calls (exchange_code, refresh_tokens, get_user_profile, create_tweet)
- Integrated duplicate detection into both publishing flows (ScheduledPostWorker and PostSubmissionController)
- Added content_hash field to PostSubmission schema and stored after successful publish
- Preserved HTTPoison for non-X API calls (analytics via twitterapi.io, video download from R2/external URLs)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create TwitterDuplicateDetector and wire TwitterApiClient** - `70f4a70` (feat)
2. **Task 2: Wire duplicate check and content_hash storage into publishing flows** - `0d281c3` (feat)

**Plan metadata:** (will be added after state updates)

## Files Created/Modified

**Created:**
- `server/lib/clippster_server/social/twitter_duplicate_detector.ex` - Duplicate detection with SHA-256 hashing, 24-hour lookback window

**Modified:**
- `server/lib/clippster_server/social/platforms/twitter.ex` - Wired TwitterApiClient for X API calls
- `server/lib/clippster_server/social/post_submission.ex` - Added content_hash field
- `server/lib/clippster_server/social/scheduled_post_worker.ex` - Duplicate check + content_hash storage
- `server/lib/clippster_server_web/controllers/post_submission_controller.ex` - Duplicate check + content_hash storage

## Decisions Made

1. **Two-stage hashing strategy:** Pre-check uses caption only (media not uploaded yet), final hash includes media_id for accurate future duplicate detection
2. **24-hour lookback window:** Balances catching duplicates vs allowing intentional reposts
3. **Per-account duplicate detection:** Same content on different accounts is allowed, prevents false positives
4. **Selective TwitterApiClient integration:** Only X API endpoints use retry/rate-limit logic; analytics (twitterapi.io) and video downloads (R2/external) remain as raw HTTPoison

## Deviations from Plan

None - plan executed exactly as written.

## Technical Highlights

**Duplicate Detection Flow:**
1. Pre-flight check: `TwitterDuplicateDetector.check_duplicate(account_id, caption, [])`
2. If duplicate: Return permanent error, don't waste API quota
3. If not duplicate: Upload media, create tweet
4. After success: `TwitterDuplicateDetector.generate_hash(caption, [media_id])` stored as content_hash

**Content Hash Algorithm:**
```elixir
# Combine text + sorted media IDs
content = text <> Enum.join(Enum.sort(media_ids), ",")

# SHA-256 hex encoding
:crypto.hash(:sha256, content) |> Base.encode16(case: :lower)
```

**TwitterApiClient Integration:**
- `exchange_code`: OAuth token exchange now has retry + logging
- `refresh_tokens`: Single-use refresh token with retry + logging
- `get_user_profile`: User profile fetch with retry + logging
- `create_tweet`: Tweet creation with retry + rate limit tracking + logging
- Non-X APIs preserved: `fetch_video_binary` (R2/external), `get_tweet_analytics` (twitterapi.io)

**Query Strategy:**
- Matches by content_hash + account_id
- Checks posts in ["published", "publishing"] status
- Queries last 24 hours from inserted_at timestamp
- Returns first match (most recent duplicate)

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 04 complete. All 5 requirements delivered:
- REL-01: TwitterRateLimiter parses headers, stores quota per endpoint (Plan 01) ✓
- REL-02: TwitterApiClient retries 429/5xx with exponential backoff (Plan 01) ✓
- REL-03: TwitterApiClient returns immediately on 400/403/404 (Plan 01) ✓
- REL-04: TwitterDuplicateDetector prevents duplicate posts (Plan 02) ✓
- REL-05: TwitterApiClient logs all X API calls via PulseKit (Plan 01) ✓

Ready for Phase 05 or next milestone planning.

## Self-Check: PASSED

Verified all created files exist:
- FOUND: server/lib/clippster_server/social/twitter_duplicate_detector.ex

Verified commits exist:
- FOUND: 70f4a70 (Task 1: Create TwitterDuplicateDetector and wire TwitterApiClient)
- FOUND: 0d281c3 (Task 2: Wire duplicate check into publishing flows)

All artifacts verified successfully.

---
*Phase: 04-rate-limiting-reliability*
*Completed: 2026-02-10*
