# Codebase Concerns

**Analysis Date:** 2026-01-27

## Security Considerations

### JWT Token Verification Gap
- Issue: Payment controller performs JWT decode without signature verification
- Files: `server/lib/clippster_server_web/controllers/payment_controller.ex` (line 636-660)
- Risk: Tokens can be forged or tampered with. The `decode_token/1` function explicitly notes "Simple JWT decode without verification (for development)" and decodes the payload directly without verifying the signature against a secret key
- Current mitigation: Auth plug uses proper verification via `TokenGenerator.verify_token/1`, but payment controller bypasses this
- Recommendations: Use `TokenGenerator.verify_token/1` consistently throughout; never decode JWTs without signature verification in production; remove comment acknowledging this is for development only

### Unvalidated v-html Usage
- Issue: Release notes rendered with `v-html` without sanitization
- Files: `client/src/components/MandatoryUpdateDialog.vue` (uses `v-html="formatReleaseNotes(state.updateInfo.body)"`)
- Risk: If release notes from update service are compromised, XSS injection is possible
- Current mitigation: None detected
- Recommendations: Use DOMPurify or similar HTML sanitizer before rendering; implement strict CSP headers; consider plain text or markdown rendering instead

### Debug Mode in Production Code
- Issue: Multiple debug/diagnostic flags left in release code
- Files:
  - `client/src-tauri/pumpfun-service/record-livestream.mjs` (line 76: `const DEBUG_SYNC = true`)
  - `client/src-tauri/src/dvr.rs` (multiple `println!()` debug outputs)
  - `client/src-tauri/src/waveform.rs` (debug print statements at lines 454, 468, 476, 501, 514)
  - `server/lib/clippster_server_web/plugs/auth_plug.ex` (line 17-26: `IO.puts()` logs with token info)
- Risk: Exposes implementation details, may leak sensitive information in logs, performance impact
- Recommendations: Use conditional debug logging behind environment flags; strip debug code from release builds; implement structured logging (bunyan, slog, etc.)

### Verbose Auth Logging
- Issue: Auth plug logs token lengths and header formats to stdout
- Files: `server/lib/clippster_server_web/plugs/auth_plug.ex` (lines 17-26)
- Risk: Sensitive auth information in plaintext logs; visible in production if stdout captured
- Recommendations: Use structured logging with redaction; log auth events at debug level only; never log token content or length

## Tech Debt

### Unimplemented Duration Detection
- Issue: Video duration detection stub returns error
- Files: `client/src/composables/useVideoOperations.ts` (lines 240-256)
- Impact: Duration-dependent features cannot work; users cannot see video duration before processing
- Fix approach: Implement FFmpeg command via Tauri backend to extract duration from video metadata

### Unimplemented Update Command
- Issue: Item update in clip editor is stubbed out
- Files: `client/src/components/clip-editor/ClipEditorDialog.vue` (line 388)
- Impact: UI calls unimplemented function; updates silently fail with only console log
- Fix approach: Implement command handler that syncs changes to database

### Watermark Persistence Not Ready
- Issue: Watermark panel has TODO for database persistence
- Files: `client/src/components/clip-editor/panels/WatermarkPanel.vue` (line 197)
- Impact: Watermark settings not saved between sessions; users lose custom watermarks
- Fix approach: Implement database storage layer for watermark configurations per user/org

### Unverified Stripe Webhook Integration
- Issue: Stripe subscription checkout not implemented
- Files: `docs/completed/SUBSCRIPTION_PLAN.md` (line 491)
- Impact: No subscription flow for premium features; revenue path blocked
- Fix approach: Implement Stripe integration with webhook verification

### Incomplete Livestream Monitoring
- Issue: Livestream monitoring has commented-out debug code
- Files: `client/src/composables/useLivestreamMonitoring.ts` (line 941)
- Impact: Twitch progress tracking disabled; monitoring incomplete
- Fix approach: Re-enable monitoring with proper logging; test with actual Twitch streams

## Performance Bottlenecks

### Large Vue Components
- Issue: Multiple monolithic component files with complex logic
- Files:
  - `client/src/pages/Projects.vue` (7,346 lines)
  - `client/src/components/organization/OrganizationCampaigns.vue` (6,147 lines)
  - `client/src/pages/Clips.vue` (4,468 lines)
  - `client/src/components/ClipsTab.vue` (3,027 lines)
  - `client/src/components/Timeline.vue` (2,915 lines)
- Cause: Single-file components lack separation of concerns; rendering all functionality at once
- Improvement path: Extract sub-components; implement lazy loading for tabs/panels; use virtual scrolling for lists

### Excessive Console Logging
- Issue: 1,627 console.log calls across 197 files
- Files: Widespread throughout `client/src/services/`, `client/src/composables/`, `client/src/components/`
- Cause: Debugging logs left in production code
- Impact: Performance degradation in browser DevTools; log spam obscures real issues; potential data leaks
- Improvement path: Replace with conditional debug flag; use structured logging library; remove debug logs before release

### Waveform Generation at High Resolution
- Issue: Waveform generates 16,000 peaks regardless of viewport
- Files: `client/src-tauri/src/waveform.rs` (line 19: `const TARGET_PEAKS: u32 = 16000`)
- Cause: Frontend expected to downsample; inefficient for typical timeline zoom levels
- Impact: High memory usage; slow rendering on lower-end devices; unnecessary computation
- Improvement path: Reduce default peak count to 4000-8000; implement adaptive resolution based on zoom level

### Inefficient JSON.parse Without Try-Catch
- Issue: Multiple JSON.parse calls without error handling
- Files: 22+ files including `useLivestreamMonitoring.ts`, `useLivestreamViewer.ts`, `useChunkedClipDetection.ts`, `useTranscriptData.ts`, `useDownloads.ts`
- Impact: Silent failures; corrupted data crashes editor; confusing error messages
- Improvement path: Wrap all JSON.parse in try-catch; add type guards; use defensive parsing library

### Stream Recording Buffer Overflow Risk
- Issue: Video queue may overflow before encoder starts, dropping early frames
- Files: `client/src-tauri/pumpfun-service/record-livestream.mjs` (lines 1909-1930)
- Cause: Frame queuing before encoder initialization; BUGFIX comment indicates known issue
- Impact: Lost frames; video-audio sync issues; corrupted stream recordings
- Improvement path: Pre-allocate bounded queue; implement backpressure; start encoder before accepting frames

## Fragile Areas

### Timestamp Synchronization (DVR/PumpFun)
- Files: `client/src-tauri/pumpfun-service/record-livestream.mjs` (lines 1902-1930)
- Why fragile: Video/audio timestamp sync depends on accurate baseline detection; overflow can corrupt synchronization; multiple timestamp offset calculations
- Safe modification: Add comprehensive logging of timestamp transitions; implement unit tests for sync scenarios; add validation that video/audio timings are within tolerance
- Test coverage: No dedicated test suite detected for stream recording sync

### Video Processing Pipeline
- Files: `client/src-tauri/src/clips/video_processor.rs` (4,314 lines)
- Why fragile: Complex FFmpeg filter chain generation; multiple conditional branches for different codecs/effects; subtle off-by-one errors in frame calculations
- Safe modification: Separate filter generation logic; add pre-flight validation of filter strings; implement regression tests for each effect type
- Test coverage: Limited; requires integration tests with actual video files

### JWT Authentication Flow
- Files: `server/lib/clippster_server_web/plugs/auth_plug.ex`, `server/lib/clippster_server_web/controllers/payment_controller.ex`
- Why fragile: Multiple verification paths; payment controller bypasses proper verification; inconsistent error handling
- Safe modification: Consolidate token verification logic; create shared JWT verification module; add audit logging for auth failures
- Test coverage: Appears limited; needs comprehensive auth test suite

### Database State During Video Processing
- Files: Async operations in `client/src/composables/`, backend video processor
- Why fragile: Long-running operations may leave state inconsistent if interrupted; no transaction management visible for multi-step processes
- Safe modification: Implement explicit state machines for processing steps; add rollback logic; use database transactions for multi-step updates
- Test coverage: No visible test files for processing workflows

## Scaling Limits

### Concurrent Stream Recording
- Current capacity: Single-threaded frame processing in MediaRecorder
- Limit: Browser can only handle 1-2 high-quality streams; no connection pooling for multiple streams
- Scaling path: Implement stream pooling; offload to native code; add quality adaptation based on CPU usage

### Database Query Performance
- Current capacity: No pagination or indexing strategy documented
- Limit: Large tables (clips, projects, transcripts) will slow down without proper indexes
- Scaling path: Add database indexes on frequently-queried fields; implement cursor-based pagination; add query result caching

### Waveform Cache Storage
- Current capacity: Stores 16,000-peak waveforms for each video in temp directory
- Limit: No cleanup strategy; temp directory grows unbounded
- Scaling path: Implement LRU cache; add automatic cleanup for old waveforms; compress cached data

### Memory Usage During Clip Build
- Current capacity: Entire timeline loaded into memory; all track data retained
- Limit: Large projects (>100 clips, >2hr video) will consume significant RAM
- Scaling path: Implement virtual scrolling; lazy-load timeline segments; stream video processing

## Dependencies at Risk

### Outdated Stream Recording Stack
- Risk: Custom Node.js-based recording service (`pumpfun-service/`) duplicates browser MediaRecorder functionality
- Impact: Maintenance burden; potential for desync between implementations; security gaps
- Migration plan: Consolidate to single recording implementation; consider WebRTC for multi-participant streams; evaluate established recording libraries

### Tauri Backend Stability
- Risk: Complex Rust FFmpeg integration; multiple encoding pathways (VP8, H.264, VP9); custom WebM parsing
- Impact: Bugs in video processing affect all users; difficult to debug cross-platform issues
- Migration plan: Add comprehensive error recovery; implement automatic fallback encoders; add detailed logging for post-mortem analysis

### Browser MediaRecorder API
- Risk: Limited cross-browser codec support; implementation variations; no standardized error handling
- Impact: Recording failures on some browsers; unpredictable behavior
- Migration plan: Add polyfill detection; implement codec negotiation; graceful degradation for unsupported browsers

## Missing Critical Features

### Error Recovery & Resilience
- Problem: No visible error recovery for interrupted recordings, failed uploads, or network disconnections
- Blocks: Users cannot resume interrupted operations; sessions lost on network glitch
- Recommendations: Implement checkpoint/resume for long operations; add retry logic with exponential backoff; persist operation state

### Comprehensive Audit Logging
- Problem: No centralized audit trail for security events, payment transactions, or user actions
- Blocks: Cannot investigate security incidents; no compliance audit trail
- Recommendations: Add structured audit logging to all sensitive operations; store in immutable log; implement log analysis

### Request Cancellation
- Problem: Only 3 AbortController usages across entire client codebase
- Blocks: Long-running requests continue after user navigation; resource leaks accumulate
- Recommendations: Add AbortController to all fetch/invoke calls; clean up subscriptions on component unmount; implement request timeout defaults

## Test Coverage Gaps

### Stream Recording Synchronization
- What's not tested: Video/audio timestamp alignment during DVR recording; frame drop handling; overflow scenarios
- Files: `client/src-tauri/pumpfun-service/record-livestream.mjs`, `client/src/composables/useDvrRecording.ts`
- Risk: Sync issues discovered in production; users report audio desync without diagnosis path
- Priority: High - streaming is core feature; sync issues are user-facing

### JWT Authentication Paths
- What's not tested: Token expiry handling; malformed token rejection; concurrent token refresh; payment controller token verification
- Files: `server/lib/clippster_server_web/plugs/auth_plug.ex`, payment controller
- Risk: Auth bypass vulnerabilities; silent failures in payment processing
- Priority: High - security critical

### Large Component Rendering
- What's not tested: Performance with large datasets (100+ projects, 1000+ clips); memory leaks on rapid navigation
- Files: `client/src/pages/Projects.vue`, `client/src/components/ClipsTab.vue`, Timeline components
- Risk: App becomes unusable with real data; memory leaks on long sessions
- Priority: Medium - affects UX at scale

### Video Processing Edge Cases
- What's not tested: Very long videos (>12 hours); unusual aspect ratios; damaged/corrupted source files; concurrent processing
- Files: `client/src-tauri/src/clips/video_processor.rs`
- Risk: Processing fails silently; users unaware of corruption; system hangs
- Priority: Medium - affects content creators

### Database Transaction Integrity
- What's not tested: Concurrent updates to same clip; partial failure during multi-step operations; rollback scenarios
- Files: Backend database layer (not thoroughly analyzed)
- Risk: Inconsistent database state; duplicate clips; lost data
- Priority: High - data integrity critical

## Known Bugs

### Frame Drop Before Encoder Start
- Symptoms: Early frames missing from recording; video-audio sync offset; timestamp baseline misalignment
- Files: `client/src-tauri/pumpfun-service/record-livestream.mjs` (lines 1909-1930)
- Trigger: Happens when frames are queued faster than encoder can process them before encoder initialization completes
- Workaround: BUGFIX attempts to detect and adjust baseline timestamp, but only partially addresses root cause

### Uninitialized Video Duration
- Symptoms: Duration detection fails; returns "not implemented" error; downstream processes cannot estimate encoding time
- Files: `client/src/composables/useVideoOperations.ts` (line 248)
- Trigger: Whenever video duration is needed
- Workaround: None; feature is completely non-functional

### Twitch Progress Monitoring Disabled
- Symptoms: Twitch livestream progress not displayed; monitoring incomplete
- Files: `client/src/composables/useLivestreamMonitoring.ts` (line 941: "// DEBUG: Commented out to see Twitch progress")
- Trigger: On livestream monitoring
- Workaround: Re-enable commented code (lines nearby), but quality of implementation unknown

---

*Concerns audit: 2026-01-27*
