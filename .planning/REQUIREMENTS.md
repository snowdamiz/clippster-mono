# Requirements: Clippster

**Defined:** 2026-02-09
**Core Value:** Content creators can generate, edit, and distribute short-form clips from long-form video with minimal manual effort

## v1 Requirements

Requirements for milestone v1.0: Official X API Posting. Each maps to roadmap phases.

### Authentication

- [ ] **AUTH-01**: User can connect an organization X account via OAuth 2.0 with PKCE
- [ ] **AUTH-02**: User can connect a personal/clipper X account via OAuth 2.0 with PKCE
- [ ] **AUTH-03**: X access tokens and refresh tokens are stored encrypted using existing TokenEncryption
- [ ] **AUTH-04**: X access tokens refresh automatically before 2-hour expiry via TokenRefreshWorker
- [ ] **AUTH-05**: X refresh token single-use rotation updates both tokens atomically in database
- [ ] **AUTH-06**: User can view connected X account profile (username, display name, avatar)
- [ ] **AUTH-07**: User can disconnect an X account from organization or personal profile

### Video Upload

- [ ] **UPLOAD-01**: System uploads video to X via chunked upload (INIT/APPEND/FINALIZE)
- [ ] **UPLOAD-02**: System polls X media processing status until succeeded or failed with timeout
- [ ] **UPLOAD-03**: System generates presigned R2 URLs for X to download video during processing
- [ ] **UPLOAD-04**: System validates video format before upload (512MB, MP4/MOV, H.264, 140s max)

### Posting

- [ ] **POST-01**: User can post a clip to X immediately with caption (280 char limit)
- [ ] **POST-02**: User can schedule a clip post to X for a future time
- [ ] **POST-03**: System tracks post status (pending, publishing, published, failed) in post_submissions
- [ ] **POST-04**: System stores X post_id and post_url after successful publish
- [ ] **POST-05**: User can cancel a scheduled X post before it publishes
- [ ] **POST-06**: User can retry a failed X post

### Reliability

- [ ] **REL-01**: System parses X rate limit headers on every response and tracks app-level quota
- [ ] **REL-02**: System retries transient failures (429, 5xx) with exponential backoff
- [ ] **REL-03**: System marks permanent failures (400, 403, 404) without retry
- [ ] **REL-04**: System detects duplicate content before posting to avoid X's 403 duplicate error
- [ ] **REL-05**: System logs all X API interactions via PulseKit for debugging

## v1.1 Requirements

Requirements for milestone v1.1: Admin Dashboard Web Parity.

### Admin Web Parity

- [x] **ADMIN-01**: Website exposes admin routes matching app admin path surface (`/admin/*`)
- [x] **ADMIN-02**: Website enforces admin/moderator-only access for admin routes
- [x] **ADMIN-03**: Website admin experience renders the exact app admin UI implementation
- [x] **ADMIN-04**: Embedded admin context receives active auth session via secure cross-context sync

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhancements

- **ENH-01**: User can add alt text to video posts for accessibility (1,000 char limit)
- **ENH-02**: User can set reply settings on X posts (anyone, following, mentioned, verified)
- **ENH-03**: System validates video codec/resolution/bitrate before upload with user-friendly errors
- **ENH-04**: User can preview how post will appear on X before publishing
- **ENH-05**: User can bulk schedule multiple clips to X with time offsets
- **ENH-06**: User can view account health dashboard (token status, failed posts, quota usage)

### Advanced

- **ADV-01**: User can post multi-video threads to X (sequential posts with reply_to)
- **ADV-02**: System fetches X post analytics via official API (replacing twitterapi.io for posted content)
- **ADV-03**: System suggests optimal posting times based on X engagement patterns

## Out of Scope

| Feature | Reason |
|---------|--------|
| Replace twitterapi.io for analytics | Current read-only stats work fine for external submissions, separate concern |
| X Premium features (4K+ chars, 4hr video) | API enforces standard limits even for Premium users |
| Poll creation | X polls can't include media attachments, incompatible with video posting |
| Image posting | Clippster is video-focused, images add minimal value for clip distribution |
| Multiple video carousels | X limitation: 1 video per post maximum |
| Thread posting | High complexity, sequential API calls with failure recovery, defer to v2 |
| Native X scheduling | X API v2 has no scheduling endpoints, use existing ScheduledPostWorker |
| TikTok/YouTube API | Separate milestones |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| AUTH-05 | Phase 1 | Complete |
| AUTH-06 | Phase 1 | Complete |
| AUTH-07 | Phase 1 | Complete |
| UPLOAD-01 | Phase 2 | Complete |
| UPLOAD-02 | Phase 2 | Complete |
| UPLOAD-03 | Phase 2 | Complete |
| UPLOAD-04 | Phase 2 | Complete |
| POST-01 | Phase 3 | Complete |
| POST-02 | Phase 3 | Complete |
| POST-03 | Phase 3 | Complete |
| POST-04 | Phase 3 | Complete |
| POST-05 | Phase 3 | Complete |
| POST-06 | Phase 3 | Complete |
| REL-01 | Phase 4 | Complete |
| REL-02 | Phase 4 | Complete |
| REL-03 | Phase 4 | Complete |
| REL-04 | Phase 4 | Complete |
| REL-05 | Phase 4 | Complete |
| ADMIN-01 | Phase 5 | Complete |
| ADMIN-02 | Phase 5 | Complete |
| ADMIN-03 | Phase 5 | Complete |
| ADMIN-04 | Phase 5 | Complete |

**Coverage:**
- v1 + v1.1 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0

---
*Requirements defined: 2026-02-09*
*Last updated: 2026-02-20 after phase 5 completion*
