# Batch Social Media Posting

Add multi-clip × multi-account batch posting with parallel uploads, per-clip captions, and post-now/schedule-later per clip.

---

## Current State

**Single-clip publish flow (Clips.vue):**
1. User clicks "Publish" on one build → `PlatformSelectDialog` (Instagram or Twitter)
2. `PublishDestinationDialog` → personal account or organization
3. Video file read from disk → converted to data URL → File object → uploaded to R2 via `uploadMediaForPost` / `uploadUserMediaForPost`
4. `InstagramPublishDialog` or `TwitterPublishDialog` → caption, schedule toggle, publish

**Backend:** `PostSubmission` schema already supports `scheduled_at`, `clip_id`, `media_url`, `caption`, per-platform validation. `ScheduledPostWorker` GenServer polls every minute and publishes due posts. Upload endpoints exist for both org (`/organizations/:id/posts/upload-media`) and personal (`/user/posts/upload-media`).

**Key limitation:** Everything is single-clip, single-account, sequential. No batch upload, no multi-account selection, no multi-clip selection for posting.

---

## Architecture

### UX Flow (3 steps)

**Step 1 — Selection (on Clips.vue)**
- Add a "Batch Post" button in the header actions bar (next to existing bulk delete)
- Reuse the existing `selectedBuilds` multi-select mechanism (checkboxes on build cards)
- "Batch Post" button enabled when ≥1 build is selected
- Clicking opens the new `BatchPostWizard.vue` dialog

**Step 2 — Account & Platform Selection (BatchPostWizard Step 1)**
- Full-page modal wizard with steps indicator
- Lists all available accounts (personal Instagram, personal Twitter, org Instagram, org Twitter) with checkboxes for multi-select
- Accounts grouped by: "My Personal Accounts" and per-organization sections
- Each account shows platform icon, @username, org badge
- User checks one or more accounts → Next button

**Step 3 — Upload & Caption (BatchPostWizard Step 2)**
- Shows a grid/list of all selected clips × selected accounts = posting matrix
- **Parallel upload phase**: All unique clip files upload to R2 in parallel (max 3 concurrent). Progress bar per clip. Each clip only uploads once even if posting to multiple accounts (same `media_url` reused).
- Once all uploads complete, transition to caption entry phase
- Each row = one clip → one account posting job. Shows: thumbnail, clip name, account @username, platform icon
- Per-row fields: caption textarea, "Post Now" / "Schedule" toggle, date/time picker if scheduled
- "Apply caption to all" button to set same caption across all rows
- "Post All" button submits everything

### Data Flow

```
Selected Builds (local file paths)
  ↓
Read files from disk via Tauri `read_file_as_data_url`
  ↓
Upload unique files in parallel to R2 (reuse media_url per clip)
  ↓
For each (clip, account) pair:
  → POST /social/schedule (if scheduled)
  → POST /organizations/:id/posts/publish OR /user/instagram/publish OR /user/twitter/publish (if immediate)
```

### Backend Changes

**New endpoint: `POST /api/social/batch-publish`**
- Accepts array of post jobs: `[{ media_url, platform, caption, scheduled_at?, account_type, account_id, organization_id?, clip_id?, ... }]`
- Iterates and creates `PostSubmission` records for each
- For immediate posts: kicks off async publish tasks in parallel
- For scheduled posts: creates with `status: "scheduled"`
- Returns array of results (success/error per job)
- This avoids N separate HTTP requests from the client

**New endpoint: `POST /api/social/batch-upload`** (optional optimization)
- Accepts multiple files in one multipart request
- Returns array of `{ clip_id, media_url, thumbnail_url }`
- Reduces HTTP overhead vs N separate upload calls

---

## Files to Create

| File | Purpose |
|------|---------|
| `client/src/components/BatchPostWizard.vue` | Multi-step wizard dialog (account selection → upload/caption) |
| `client/src/composables/useBatchUpload.ts` | Parallel file upload logic with progress tracking |
| `client/src/services/batchPostApi.ts` | API client for batch publish/upload endpoints |
| `server/lib/clippster_server_web/controllers/batch_post_controller.ex` | Backend controller for batch endpoints |

## Files to Modify

| File | Change |
|------|--------|
| `client/src/pages/Clips.vue` | Add "Batch Post" button, wire to wizard dialog |
| `server/lib/clippster_server_web/router.ex` | Add batch routes |
| `server/lib/clippster_server/social.ex` | Add `batch_create_posts/2` context function |
| `landing/src/components/dashboard/` | Mirror batch posting if applicable (per sync rule) |

---

## Implementation Phases

### Phase 1: Backend batch endpoints
1. Create `BatchPostController` with `batch_publish` action
2. Add `POST /api/social/batch-publish` route
3. Implement `Social.batch_create_posts/2` — iterates jobs, creates PostSubmission records, kicks off immediate publishes via Task.async
4. Return per-job results array

### Phase 2: Frontend upload composable
1. Create `useBatchUpload.ts` — accepts array of `{ clipId, filePath, thumbnailPath }`, reads files via Tauri, uploads to R2 in parallel (concurrency limit 3), tracks per-file progress, deduplicates by clipId
2. Returns reactive `uploads` array with `{ clipId, status, progress, mediaUrl, thumbnailUrl, error }`

### Phase 3: Batch API service
1. Create `batchPostApi.ts` with `batchPublish(jobs[])` function
2. Types for batch request/response

### Phase 4: BatchPostWizard UI
1. **Step 1 — Account Selection**: Load all accounts (personal + org), checkboxes, platform icons, grouped sections
2. **Step 2 — Upload & Caption**: 
   - On entering step 2, immediately start parallel uploads
   - Show upload progress per clip (progress bars)
   - Once uploads complete, show caption grid
   - Each row: clip thumbnail + name, account icon + @username, caption textarea, post-now/schedule toggle + datetime picker
   - "Apply to all" for caption
   - Submit button calls `batchPublish`
3. Success/error summary at end

### Phase 5: Clips.vue integration
1. Add "Batch Post" button next to existing bulk delete button
2. Wire `selectedBuilds` to `BatchPostWizard`
3. Pass selected build data (file paths, thumbnails, clip IDs) as props

### Phase 6: Landing app sync
1. Check if landing app has equivalent clips/posting UI
2. If so, add batch posting there too

---

## Key Design Decisions

- **Parallel uploads**: Max 3 concurrent to avoid overwhelming the server. Each unique clip file uploads once; the resulting `media_url` is reused across all accounts for that clip.
- **Per-clip caption + scheduling**: Every (clip, account) pair gets its own caption and post-now/schedule choice. "Apply to all" is a convenience shortcut.
- **Single batch API call**: Instead of N individual publish calls, one `batch-publish` endpoint reduces latency and enables server-side parallelism.
- **Reuse existing PostSubmission schema**: No new DB tables needed. Each batch job creates a standard `PostSubmission` record. The `ScheduledPostWorker` handles scheduled ones automatically.
- **Wizard UX**: Two-step wizard keeps the flow clean — first pick WHERE to post, then handle WHAT to say for each.
