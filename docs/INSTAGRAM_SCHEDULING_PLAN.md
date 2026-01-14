# Instagram Scheduling & Posting Plan

## 1) Product / UX flows
- ✅ Entry points: From a built clip → "Share → Instagram → Schedule". *(Implemented: PublishDialog.vue for org, UserPublishDialog.vue for personal with scheduling support)*
- ✅ Inputs: Caption (enforce IG limits), scheduled date/time, IG account selector, org/campaign/creator context selection.
  - Caption with 2200 char limit: ✅ Implemented
  - Scheduled date/time: ✅ Implemented (date/time picker in both dialogs)
  - IG account selector: ✅ Implemented
  - Creator profile selector: ✅ Implemented (optional in PublishDialog)
- Defaults and account eligibility:
  - ✅ If clipper is working on a creator assigned by an org (or picked an org/campaign) and that org has an IG linked/assigned:
    - ✅ "Allow personal accounts" toggle on organizations
    - ✅ `scheduling_enabled` toggle on organizations
  - ⚠️ If multiple orgs/campaigns for the same creator: clipper chooses org/campaign first - partial support via campaign_id field
  - ✅ If the creator profile was created by the clipper (or is not in any org), clipper can use personal IG freely.
- ✅ States: pending, scheduled, publishing, published, failed, canceled; show timestamps and post URL when available.
- ✅ Actions: cancel/edit while queued; retry after failure (with guardrails). *(ScheduledPostsList.vue with edit/cancel dialogs)*
- Visibility to orgs:
  - ✅ Auto-visible when posted via org IG.
  - ✅ If posted via personal IG, org sees it when clipper submits the post link. *(ExternalPostSubmitDialog.vue, ExternalPostSubmission schema)*

## 2) Data model
- ✅ `post_submissions` table (extended via migration `20260115000002_add_instagram_scheduling_fields.exs`):
  - ✅ `id`, `organization_id`, `organization_creator_profile_id`, `submitted_by_user_id`, `platform`
  - ✅ `organization_social_account_id` (for org IG)
  - ✅ `user_social_account_id` (for personal IG)
  - ✅ `owner_type` (`org` or `user`)
  - ✅ `campaign_id`, `clip_id`
  - ✅ `caption`, `media_url`, `media_type`, `post_id`, `post_url`, `error_message`
  - ✅ `scheduled_at`, `started_at`, `completed_at`, `locked_at`, `attempts`, `max_attempts`
  - ✅ `status` (pending/scheduled/publishing/published/failed/canceled), timestamps, indexes
- ✅ `external_post_submissions` table for link submissions
- ✅ Social accounts:
  - ✅ `organization_social_accounts` table - org-owned accounts with encrypted tokens, `token_expires_at`
  - ✅ `clipper_social_accounts` table - user-owned accounts with encrypted tokens
  - ✅ `social_account_assignments` - link clippers to org accounts
- ✅ Organizations: `allow_personal_instagram`, `scheduling_enabled` fields

## 3) Backend APIs & logic
- ✅ Auth/connect:
  - ✅ Admin-only for org IG connections (`InstagramAuthController`)
  - ✅ Clippers can connect their own IG accounts (`UserInstagramAuthController`, `ClipperProfileController`)
- ✅ Scheduling API (`SchedulingController`):
  - ✅ `POST /social/schedule` - schedule a post for future publishing
  - ✅ `GET /social/scheduled` - list user's scheduled posts
  - ✅ `GET /social/scheduled/:id` - get a scheduled post
  - ✅ `PUT /social/scheduled/:id` - update a scheduled post
  - ✅ `POST /social/scheduled/:id/cancel` - cancel a scheduled post
  - ✅ External post submissions: `POST/GET /organizations/:org_id/external-posts`, approve/reject endpoints
  - ✅ Existing: `POST /organizations/:org_id/posts/publish` for immediate publish
  - ✅ Existing: `POST /user/instagram/publish` for user immediate publish
- ✅ Queue/worker (`ScheduledPostWorker`):
  - ✅ Polls every minute for posts ready to publish
  - ✅ Row locking to prevent duplicate processing
  - ✅ Token handling: decrypt via `TokenEncryption`, refresh via `TokenRefreshWorker`
  - ✅ Media: presign R2/private URLs in `instagram.ex`
  - ✅ Publish: `Instagram.publish_media` with caption, ig_user_id; store post ID/URL
  - ✅ Retry policy: exponential backoff, distinguishes transient vs permanent errors
  - ✅ Idempotency: optimistic locking via `locked_at` field
- ✅ Cancellation/edit:
  - ✅ `cancel_changeset`, `update_scheduled_changeset` in PostSubmission
  - ✅ `can_edit?`, `can_cancel?` helper functions
- ✅ Observability: PulseKit events throughout `instagram.ex`, `PostSubmissionController`, `ScheduledPostWorker`

## 4) Frontend
- ✅ Share/Schedule modal:
  - ✅ IG account picker in `PublishDialog.vue` - shows assigned accounts for members, all for admins
  - ✅ Caption field with 2200 char limit and hashtag count validation (30 max)
  - ✅ Date/time picker with minimum 5 minutes in future validation
  - ✅ Schedule toggle with relative time display
- ✅ Scheduled posts management (`ScheduledPostsList.vue`):
  - ✅ Status filters (all/scheduled/publishing/published/failed/canceled)
  - ✅ Status chips, chosen account, errors, post URL
  - ✅ Scheduled time, attempts display
  - ✅ Edit dialog for caption and schedule time
  - ✅ Cancel confirmation dialog
- ✅ Link submission UI (`ExternalPostSubmitDialog.vue`):
  - ✅ Platform selector (Instagram, TikTok, YouTube, Twitter)
  - ✅ Post URL input with platform validation
  - ✅ Creator profile and campaign selection
  - ✅ Optional analytics input (views, likes)
- ✅ Admin/org views (`PostSubmissionsList.vue`, `OrganizationSocial.vue`):
  - ✅ Org can see posts made via org IG automatically
  - ✅ External post submissions list with approve/reject
  - ✅ Filters by status, platform, creator, member
- ✅ API service (`schedulingApi.ts`):
  - ✅ All scheduling CRUD operations
  - ✅ External post submission operations
  - ✅ Helper functions for date formatting and validation

## 5) Policy/eligibility rules
- ✅ Org-assigned creator + org IG present:
  - ✅ "Allow personal accounts" toggle on organizations
  - ✅ `scheduling_enabled` toggle on organizations
- ⚠️ Multi-org/campaign creator:
  - ⚠️ Context selection via campaign_id - full UI grouping not implemented
- ✅ Independent/self-created creator (or no org context):
  - ✅ Personal IG allowed by default (`UserPublishDialog.vue`)
- ✅ Visibility to orgs:
  - ✅ Auto when posted via org IG
  - ✅ Personal IG link submission via `ExternalPostSubmission`

## 6) Compliance & constraints (Instagram Graph)
- ✅ Scopes: `instagram_business_content_publish`, `instagram_business_basic`, `instagram_business_manage_insights` configured
- ✅ Business/Creator accounts - Instagram API integration complete in `instagram.ex`
- ✅ Caption limits: 2,200 chars enforced client-side, 30 hashtags validated in both frontend and backend
- ✅ PARTIAL - Media constraints: supports MP4 video/reels; ❌ no explicit validation for duration/aspect ratio pre-queue
- ✅ Rate limits: timeout handling, exponential backoff in `AnalyticsSyncWorker` and `ScheduledPostWorker`

## 7) Security & audit
- ✅ Tokens encrypted at rest (`TokenEncryption` module); refresh via `TokenRefreshWorker` for org and user accounts
- ✅ Audit trails:
  - ✅ `connected_at`, `submitted_by_user_id` tracked
  - ✅ Status transitions with timestamps (`posted_at`, `started_at`, `completed_at`, `last_synced_at`)
  - ✅ `attempts` counter for retry tracking
- ✅ Org controls: `allow_personal_instagram`, `scheduling_enabled` per organization

## 8) Rollout & testing
- ✅ Organization-level `scheduling_enabled` toggle
- ❌ Dry-run mode in staging - not implemented
- ❌ Tests: No automated tests found for Instagram posting flow

---

## Implementation Summary

### ✅ Fully Completed
- Instagram OAuth for org accounts (`InstagramAuthController`)
- Instagram OAuth for user/clipper accounts (`UserInstagramAuthController`)
- Token encryption and automatic refresh (`TokenEncryption`, `TokenRefreshWorker`)
- Immediate publish to Instagram for orgs (`PostSubmissionController`, `PublishDialog.vue`)
- Immediate publish to Instagram for users (`UserPostsController`, `UserPublishDialog.vue`)
- **Scheduling** - Full scheduling support with date/time picker, schedule toggle, scheduled status
- **ScheduledPostWorker** - GenServer that polls and publishes scheduled posts with retry logic
- **Cancel/edit queued posts** - Edit/cancel dialogs in `ScheduledPostsList.vue`
- **Link submission** - `ExternalPostSubmission` schema and `ExternalPostSubmitDialog.vue`
- **Org policy rules** - `allow_personal_instagram`, `scheduling_enabled` on organizations
- Post analytics sync (`AnalyticsSyncWorker`, `PostSubmissionsList.vue`)
- Media upload to R2 with presigned URLs
- PulseKit observability/logging
- Hashtag validation (30 max) in frontend and backend
- API service for scheduling operations (`schedulingApi.ts`)

### ⚠️ Partially Completed
- Multi-org/campaign context selection UI (backend supports campaign_id, frontend grouping not complete)
- Media constraint validation (duration/aspect ratio not pre-validated)

### ❌ Not Implemented
- **Automated tests** - No test coverage for Instagram flow
- **Dry-run mode** - Staging dry-run not implemented
