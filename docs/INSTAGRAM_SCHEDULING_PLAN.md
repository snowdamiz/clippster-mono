# Instagram Scheduling & Posting Plan

## 1) Product / UX flows
- Entry points: From a built clip → "Share → Instagram → Schedule".
- Inputs: Caption (enforce IG limits), scheduled date/time (user/org TZ), IG account selector, org/campaign/creator context selection (if multiple).
- Defaults and account eligibility:
  - If clipper is working on a creator assigned by an org (or picked an org/campaign) and that org has an IG linked/assigned:
    - Only that org IG is usable unless the org toggled “allow personal accounts”.
    - If allowed, default = org IG; personal IGs also selectable.
  - If multiple orgs/campaigns for the same creator: clipper chooses org/campaign first; that choice determines default IG and personal-allowed flag.
  - If the creator profile was created by the clipper (or is not in any org), clipper can use personal IG freely.
- States: queued, publishing, posted, failed, canceled; show timestamps and post URL when available.
- Actions: cancel/edit while queued; retry after failure (with guardrails).
- Visibility to orgs:
  - Auto-visible when posted via org IG.
  - If posted via personal IG, org sees it only when clipper submits the post link to that org/campaign/creator.

## 2) Data model
- Extend `post_submissions` (or add if missing):
  - `id`, `organization_id` (nullable for personal/no-org), `campaign_id` (nullable), `creator_id`, `clip_id`, `platform="instagram"`.
  - `owner_type` (`org` or `user`), `organization_social_account_id` (for org IG), `user_social_account_id` (for personal IG).
  - `status`, `scheduled_at`, `started_at`, `completed_at`, `locked_at`, `attempts`, `max_attempts`.
  - `caption`, `media_url`, `media_type`, `platform_post_id`, `platform_post_url`, `error_code`, `error_message`.
  - Timestamps; indexes on `status`, `scheduled_at`, `organization_social_account_id`, `user_social_account_id`.
- Social accounts:
  - Support owner scoping: org-owned vs user-owned; encrypted tokens; `token_expires_at`.
  - For org IG assignment: link to creators/campaigns and eligible clippers.

## 3) Backend APIs & logic
- Auth/connect:
  - Keep admin-only for org IG connections.
  - Allow clippers to connect their own IG accounts (user-owned records), no org gate.
- Scheduling API:
  - `POST /clips/:clip_id/social/schedule` with `platform=instagram`, `scheduled_at`, `caption`, `account_id` (+ flags to disambiguate org vs user), `org_id`/`campaign_id`/`creator_id` context.
  - Validate: membership, context eligibility, org rules (personal allowed?), media readiness, caption limits, future time, and that the chosen account is permitted for that context.
- Queue/worker:
  - Enqueue job at `scheduled_at`; worker locks row, sets `publishing`.
  - Token handling: decrypt, refresh if near expiry; fail with actionable error if refresh/auth fails.
  - Media: presign R2/private URLs as already supported.
  - Publish: call `Instagram.publish_media` with caption, ig_user_id; store post ID/URL.
  - Retry policy: transient (5xx/429) exponential backoff with cap; permanent (auth/permission/media) fail fast.
  - Idempotency: unique job per submission + row lock.
- Cancellation/edit:
  - Allowed while queued and not locked; update schedule/caption/account or cancel.
- Observability: structured logs with submission id/org/clip/account; metrics for status counts, latency, retries; PulseKit events with context.

## 4) Frontend
- Share/Schedule modal:
  - Context selector (org/campaign/creator) shown when multiple; determines eligible accounts and personal-allowed flag.
  - IG account picker: show only org IG if personal disallowed; otherwise group as “Org account (default)” and “My accounts”.
  - Caption field with char/hashtag limits; date/time picker with TZ hint; validation inline.
- Clip detail → “Social posts” table:
  - Status chips, scheduled time, chosen account, attempts, errors, post URL; actions: retry, cancel/edit while queued.
- Link submission UI (for personal IG visibility to org):
  - On creator profile: “Submit IG post link” with fields: IG URL, clip selection, org/campaign selection (if applicable), optional notes.
  - Status: pending/accepted if org wants approval; otherwise auto-accept.
- Admin/org views:
  - Org can see posts made via org IG automatically; for personal IG, only those with submitted links to that org/campaign/creator.
  - Filters by status, org/campaign, creator, account, user.

## 5) Policy/eligibility rules
- Org-assigned creator + org IG present:
  - If org disallows personal: only org IG is shown/usable.
  - If org allows personal: default to org IG; personal IG selectable.
- Multi-org/campaign creator:
  - Clipper must pick org/campaign up front; that drives default IG and personal-allowed flag.
- Independent/self-created creator (or no org context):
  - Personal IG allowed by default; org rules don’t apply.
- Visibility to orgs:
  - Auto when posted via org IG.
  - For personal IG: org visibility only when the clipper submits the link to that org/campaign/creator; analytics only if we have a token for that posting account.

## 6) Compliance & constraints (Instagram Graph)
- Scopes: `instagram_business_content_publish`, `instagram_business_basic`.
- Business/Creator accounts only, linked FB Page as required.
- Caption limits: 2,200 chars, 30 hashtags (enforce client + server).
- Media constraints: MP4/H.264/AAC; ≤15 minutes; aspect ratio 4:5–16:9; validate server-side pre-queue.
- Rate limits: handle 429 with backoff; log usage.

## 7) Security & audit
- Tokens encrypted at rest; refresh paths for org and user accounts.
- Audit trails: who connected the account; who scheduled; which account (org vs user) was used; status transitions with timestamps.
- Org kill switch: disable personal IG usage per org; revoke org accounts as needed.

## 8) Rollout & testing
- Feature flag by org for scheduling + personal-allowed toggle.
- Dry-run mode in staging; real IG test account validation.
- Tests: happy path schedule/post; token refresh; expired/invalid tokens; rate-limit retries; cancellation; validation failures; org-policy enforcement (personal disallowed vs allowed); link-submission visibility rules.
