# Backlog todo list

Working notes for follow-up work. No implementation in this change—context gathered from the repo on 2026-04-01.

**Subtitle-related items** in this file mean **`ProjectWorkspaceDialog.vue` / `ManualPOIEditor.vue` / `SubtitlePropertiesPanel.vue` and export parity**, not the OpenCut editor under `client/src/editor/`.

---

## Fix transitions in the video editor

**Context:** Transition types and preview math live in `client/src/types/index.ts` (`VideoEditorTransition`, `detectSourceTransitions`, `calculateTransitionState` with crossfade, slide, wipe, zoom). The OpenCut-style editor under `client/src/editor/` did not show obvious imports of `calculateTransitionState` in a quick search—transitions may be partially wired (types/presets vs playback/export). **Next:** Trace how edits overlap in the timeline, where transition effects are applied in preview vs FFmpeg export, and reproduce the specific broken behavior (preview only, export only, or both).

---

## ~~Fix org public page (needs the correct counts for everything)~~ ✅ COMPLETED

**Status:** Fixed public profile stats calculation in `server/lib/clippster_server/organizations.ex` (`get_public_profile_by_slug/1`).

**Changes:**
- **campaigns_total**: Now excludes draft campaigns (not public) and only counts `active`, `paused`, and `completed` campaigns
- **clippers_count**: Now includes all organization members (owner, admin, member) instead of just "member" role
- Campaign statuses confirmed: `draft`, `active`, `paused`, `completed` (no "ended" status exists; auto-completion moves campaigns from `active` to `completed` when `ends_at` is reached)

---

## ~~Fix campaigns — when they end, the org needs to still be able to see all completed campaigns~~ ✅ COMPLETED

**Status:** Fixed campaign completion workflow and added Active/Completed sections to the UI (like CreatorProfiles.vue).

**Root Cause:** The `Campaigns.auto_complete_expired_campaigns/0` function existed but was never being called. No worker was scheduled to run it periodically.

**Changes:**

**Backend (Auto-completion):**
- Created `server/lib/clippster_server/campaigns/campaign_completion_worker.ex` - GenServer that runs hourly to check for expired campaigns
- Added the worker to the application supervisor in `server/lib/clippster_server/application.ex`
- Worker runs immediately on startup and then every hour
- Logs the number of campaigns completed on each run
- Verified budget exhaustion completion already works (line 1194-1198 in `campaigns.ex`)

**Frontend (UI Organization):**
- Added separate **sections** to `OrganizationCampaigns.vue` following the CreatorProfiles.vue pattern
- **"Active & Draft Campaigns"** section: Shows `draft`, `active`, and `paused` campaigns
- **"Completed Campaigns"** section: Shows `completed` campaigns only
- Each section has a header with icon, title, and campaign count
- Both sections are visible on the same page (no tabs - sections with dividers)
- Verified campaign details view works for all statuses (navigates to detail route)

**Technical Details:**
- The API was already correct - `listOrganizationCampaigns` returns all campaigns without filtering
- Campaigns complete automatically in two ways:
  1. When `ends_at` date passes (via CampaignCompletionWorker)
  2. When budget is exhausted (via existing payment processing code)
- Organizations can now see active and completed campaigns in clearly separated sections on the same page
- Campaigns will automatically transition to "completed" status within 1 hour of their `ends_at` time

---

## ~~Subtitle export parity — project workspace (`16:9`) and manual POI (per aspect ratio)~~ ✅ COMPLETED

**Status:** Fixed subtitle export for 16:9 in project workspace and per-aspect-ratio handling in manual POI editor.

---

## ~~Fix downloading audio — must navigate away and back to audio library to see newest download~~

**Status:** ✅ FIXED

**Solution:** Fixed race condition between Tauri event and database save. Changed from duplicate listeners to sequential flow:
1. Global `useAudioDownloads` listener receives `download-complete` event
2. Saves to database
3. Dispatches `audio-library-updated` custom event AFTER database save completes
4. `AudioLibrary.vue` listens to custom event and reloads the list

**Files Modified:**
- `client/src/composables/useAudioDownloads.ts` - Added custom event dispatch after DB save
- `client/src/pages/AudioLibrary.vue` - Changed from Tauri event to custom window event

---

## ~~Fix adding to playlist in audio library — first create forces a second visit to add the track~~

**Status:** ✅ FIXED

**Solution:** When user clicks "Create New Playlist" from the add-to-playlist dialog, the pending audio selection is now automatically added to the newly created playlist in one flow. Added `skipDialog` parameter to `addToPlaylist()` to prevent duplicate success toasts, and combined the success message shows "Created & Added" with track count.

**Flow:**
1. User clicks "Add to Playlist" on an audio file (or bulk selects multiple)
2. User clicks "Create New Playlist" in the dialog
3. User enters playlist name and creates it
4. Audio is automatically added to the new playlist
5. Single success toast: "Created '{name}' and added {count} track(s)"

**Files Modified:**
- `client/src/pages/AudioLibrary.vue` - Updated `createPlaylist()` to capture new playlist ID and call `addToPlaylist()`, added `skipDialog` param to `addToPlaylist()`

---

## Add subtitle options to manual clipping

**Context:** Separate from **Subtitle export parity** above (which is about matching `SubtitlePropertiesPanel` + `ManualPOIEditor` to export). This item is about **manual clip creation** paths (`Timeline.vue`, `createManualClip` in `client/src/services/database/manual-clips.ts`) and whether those flows expose the same subtitle controls as the rest of the clip workflow. **Next:** Decide product scope; if manual clips should use the same settings, wire UI + storage consistent with `ProjectWorkspaceDialog` / POI data model.

---

## Add text box to project workspace / per aspect ratio

**Context:** `ProjectWorkspaceDialog.vue` already composes watermarks, subtitles, and social overlays for preview; per-ratio state is partially modeled via `previewAspectRatio` and watermark/subtitle hooks. **Next:** Align with existing overlay/text pipeline (e.g. caption nodes / branding) and storage model for per-ratio layout.

---

## Add text box to manual clipping

**Context:** Same manual clip path as above; `ManualPOIEditor.vue` is the rich manual POI surface. **Next:** Specify whether "text box" means burn-in overlay, editor-only annotation, or export metadata; then hook into the same build path as other overlays.

---

## ✅ COMPLETED: Run a thorough audit and fix all PowerShell dialog opening across the app

**Status:** ✅ **FIXED** - April 4, 2026

**What was done:**
1. ✅ Inventoried all 21 dialog plugin usages across the codebase
2. ✅ Verified Tauri v2 configuration and Windows subsystem settings
3. ✅ Audited all Rust process spawning code
4. ✅ Fixed 3 missing `CREATE_NO_WINDOW` flags in:
   - `sidecar/mod.rs` - Remotion renderer Node.js process
   - `audio.rs` - taskkill command for FFmpeg cleanup
   - `commands/convert_video.rs` - FFmpeg video conversion
5. ✅ Created comprehensive audit document: `docs/POWERSHELL_DIALOG_AUDIT.md`

**Details:** See `docs/POWERSHELL_DIALOG_AUDIT.md` for complete findings, fixes, and testing procedure.

**Note:** The Tauri dialog plugin itself does not spawn processes - it uses native OS APIs. If PowerShell flashes still occur, they are likely from background processes (FFmpeg, yt-dlp) spawning coincidentally with dialog opening. All process spawns now have proper `CREATE_NO_WINDOW` flags.

**Testing:** Requires Windows machine to verify. All code-level issues have been fixed.

---

## ✅ COMPLETED: Fix built clips page taking forever to load

**Status:** COMPLETED

**Summary:** Implemented comprehensive performance optimizations including batched/parallel data loading, IndexedDB persistent caching, and lazy thumbnail loading. Expected improvement from 5-10+ seconds to <1 second for initial load, with subsequent loads being nearly instant due to caching.

**Files Modified:**
- `client/src/pages/Clips.vue` - Refactored loadClips() with batching/parallelization
- `client/src/stores/clipThumbnails.ts` - Added IndexedDB integration and lazy loading
- `client/src/utils/persistentCache.ts` - New IndexedDB cache utility

**Documentation:** See `docs/performance/built-clips-page-optimization.md` for full details.

**Previous Context:** `client/src/pages/Clips.vue` `loadClips()` calls `getAllClipsWithBuilds()` then per-clip work: transcript IDs, `thumbnailStore.loadThumbnails`, and for each clip with `project_id`, `getProjectInfo` + `loadRawVideosForProject` sequentially (~2020+). That pattern was a strong N+1 / sequential load candidate.

---

## ✅ COMPLETED: Fix built clips sidebar taking forever to load in calendar

**Status:** COMPLETED

**Summary:** Applied the same comprehensive performance optimizations to the Content Calendar's ClipsSidebar component. Implemented parallelized build loading, lazy thumbnail loading with priority, and IndexedDB persistent caching. Expected improvement from 3-8 seconds to <500ms for initial load, with subsequent loads being nearly instant.

**Files Modified:**
- `client/src/components/calendar/ClipsSidebar.vue` - Parallelized loadBuilds(), added lazy loading, integrated IndexedDB caching

**Documentation:** See `docs/performance/content-calendar-sidebar-optimization.md` for full details.

**Previous Context:** `client/src/components/calendar/ClipsSidebar.vue` `loadClips()` uses `getAllClips()`, then `loadBuilds()` (per-clip `getClipBuilds`), then thumbnail store loads—same structural cost as the main Built Clips page.

---

## ~~Fix org enable pool balance (owner gets 400 on toggle-pool-fallback)~~ ✅ COMPLETED

**Status:** Fixed by auto-creating member allocation when toggling pool fallback setting.

**Root Cause:** The `toggle_pool_fallback` endpoint expected a `MemberCreditAllocation` record to exist for the member, but owners and admins might not have one yet (allocations are only created when credits are explicitly allocated). When toggling the setting for a user without an allocation, the server returned 400 "Member allocation not found".

**Solution:** Changed the endpoint to use `get_or_create_member_allocation/2` instead of `get_member_allocation/2`, which automatically creates an allocation with default values if one doesn't exist.

**Changes:**
- **server/lib/clippster_server_web/controllers/organization_controller.ex** (toggle_pool_fallback/2):
  - Changed from `get_member_allocation` to `get_or_create_member_allocation`
  - Removed the `allocation when not is_nil(allocation)` guard clause
  - Simplified error handling by removing the "Member allocation not found" case
  - Updated docstring to reflect auto-creation behavior

- **server/lib/clippster_server/organizations.ex**:
  - Changed `get_or_create_member_allocation/2` from `defp` to `def` to make it public
  - Added docstring explaining it creates allocations with default values if needed

**Technical Details:**
- `MemberCreditAllocation` records track:
  - `hours_allocated`: Credits allocated to this member
  - `hours_used`: Credits used by this member
  - `allow_pool_fallback`: Whether member can use org pool when their allocation runs out
- Creating an allocation with defaults (0 hours) is safe and appropriate - it establishes the fallback setting without granting credits
- The UI already handles `nil` allocations gracefully (shows 0 remaining, disabled fallback)
- Now when toggling fallback for any member (owner, admin, or regular member), it works correctly

---

## ✅ COMPLETED: Fix VOD Library (Projects page) taking forever to load

**Status:** COMPLETED

**Summary:** Optimized the VOD Library / Projects page with comprehensive performance improvements. Parallelized all clip and video queries, implemented lazy thumbnail loading, and added IndexedDB persistent caching. Expected improvement from 10-20+ seconds to <1 second for initial load, with subsequent loads being nearly instant.

**Files Modified:**
- `client/src/pages/Projects.vue` - Parallelized clip/video loading, added lazy thumbnail loading, integrated IndexedDB caching

**Key Optimizations:**
- Parallelized clip count queries (30 projects: 30 parallel queries vs 30 sequential)
- Parallelized video loading (30 projects: 30 parallel queries vs 30 sequential)
- Lazy thumbnail loading (first 20 immediately, rest deferred)
- IndexedDB caching for project thumbnails (24-hour TTL)
- Extracted complex fallback logic to separate helper functions

**Documentation:** See `docs/performance/projects-vod-library-optimization.md` for full details.

**Previous Context:** Sequential loop in `loadProjects()` querying clips and videos one project at a time, then loading thumbnails with complex nested fallback logic. Classic N+1 problem with 60+ sequential queries for 30 projects.

---
