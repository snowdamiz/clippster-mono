# Roadmap: Clippster v1.0 Official X API Posting

## Overview

Add direct posting to X (Twitter) via official X API v2 with OAuth 2.0 PKCE authentication, chunked video upload with async processing, tweet creation with media attachments, and production-grade reliability through rate limiting and error handling. This integration achieves feature parity with Instagram posting while respecting X-specific constraints.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: OAuth 2.0 PKCE Authentication** - Connect X accounts and manage tokens ✓
- [x] **Phase 2: Chunked Video Upload** - Upload and process video media for X ✓
- [x] **Phase 3: Tweet Creation & Scheduling** - Post clips to X immediately or scheduled ✓
- [x] **Phase 4: Rate Limiting & Reliability** - Production-grade error handling and quota management ✓
- [x] **Phase 5: Web Admin Dashboard Parity** - Ship website admin dashboard with identical app UI/behavior ✓

## Phase Details

### Phase 1: OAuth 2.0 PKCE Authentication
**Goal**: Users can connect organization and personal X accounts with secure OAuth 2.0 PKCE flow and automatic token refresh

**Depends on**: Nothing (first phase)

**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07

**Success Criteria** (what must be TRUE):
  1. User can connect an organization X account via OAuth 2.0 PKCE flow from organization settings
  2. User can connect a personal/clipper X account via OAuth 2.0 PKCE flow from profile settings
  3. User can view connected X account profile information including username, display name, and avatar
  4. X access tokens refresh automatically before 2-hour expiry without user intervention
  5. User can disconnect an X account and remove all stored tokens

**Plans:** 2 plans

Plans:
- [x] 01-01-PLAN.md — Twitter Platform module with OAuth 2.0 PKCE + runtime config
- [x] 01-02-PLAN.md — Auth controllers, router routes, and TokenRefreshWorker update

### Phase 2: Chunked Video Upload
**Goal**: System can upload video clips to X using chunked upload with async processing validation

**Depends on**: Phase 1

**Requirements**: UPLOAD-01, UPLOAD-02, UPLOAD-03, UPLOAD-04

**Success Criteria** (what must be TRUE):
  1. System validates video format before upload and shows clear errors for invalid videos
  2. System uploads videos using three-phase chunked upload regardless of file size
  3. System generates presigned R2 URLs for X to download video during processing
  4. System polls video processing status until succeeded or failed before marking media ready
  5. System handles upload failures with proper error messages visible to user

**Plans:** 2 plans

Plans:
- [x] 02-01-PLAN.md — VideoValidator and TwitterChunkedUpload modules (INIT/APPEND/FINALIZE/STATUS)
- [x] 02-02-PLAN.md — Wire publish_media/3, add media.write scope, R2 presigned URL integration

### Phase 3: Tweet Creation & Scheduling
**Goal**: Users can post clips to X immediately or schedule for future times with full post tracking

**Depends on**: Phase 2

**Requirements**: POST-01, POST-02, POST-03, POST-04, POST-05, POST-06

**Success Criteria** (what must be TRUE):
  1. User can post a clip to X immediately with caption up to 280 characters
  2. User can schedule a clip post to X for a future date and time
  3. User can view scheduled X posts in the scheduled posts list
  4. User can cancel a scheduled X post before it publishes
  5. User can retry a failed X post from the post history
  6. User can see X post status, post URL, and posted timestamp for successful posts

**Plans:** 2 plans

Plans:
- [x] 03-01-PLAN.md — Twitter.create_tweet/3 and platform-specific caption validation
- [x] 03-02-PLAN.md — Wire two-step Twitter posting into ScheduledPostWorker and PostSubmissionController

### Phase 4: Rate Limiting & Reliability
**Goal**: System handles X API rate limits, retries transient failures, and prevents duplicate posts

**Depends on**: Phase 3

**Requirements**: REL-01, REL-02, REL-03, REL-04, REL-05

**Success Criteria** (what must be TRUE):
  1. System tracks app-level rate limit quota across all users and warns when approaching limits
  2. System retries transient failures with exponential backoff without user intervention
  3. System marks permanent failures immediately and notifies user with clear error message
  4. System detects duplicate content before posting and prevents 403 duplicate errors
  5. System logs all X API interactions for debugging failed posts

**Plans:** 2 plans

Plans:
- [x] 04-01-PLAN.md — TwitterApiClient with retry + TwitterRateLimiter + DB migration
- [x] 04-02-PLAN.md — TwitterDuplicateDetector + wire into Twitter module and publishing flows

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. OAuth 2.0 PKCE Authentication | 2/2 | ✓ Complete | 2026-02-09 |
| 2. Chunked Video Upload | 2/2 | ✓ Complete | 2026-02-09 |
| 3. Tweet Creation & Scheduling | 2/2 | ✓ Complete | 2026-02-09 |
| 4. Rate Limiting & Reliability | 2/2 | ✓ Complete | 2026-02-09 |
| 5. Web Admin Dashboard Parity | 1/1 | ✓ Complete | 2026-02-20 |

### Phase 5: Web Admin Dashboard Parity

**Goal:** Website admins access the same admin dashboard UI and functionality as the app implementation
**Depends on:** Phase 4

**Success Criteria** (what must be TRUE):
  1. Website exposes admin routes matching app admin paths (`/admin/*`)
  2. Non-admin users cannot access website admin routes
  3. Website admin surface recreates app admin UI and behavior natively in React
  4. Deep links work consistently across `/admin/*` and `/dashboard/admin/*`

**Plans:** 1 plan

Plans:
- [x] 05-01-PLAN.md — Native React admin dashboard parity in landing (no iframe/embed)
