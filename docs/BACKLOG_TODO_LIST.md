# Backlog todo list

Working notes for follow-up work. No implementation in this change—context gathered from the repo on 2026-04-01.

**Subtitle-related items** in this file mean **`ProjectWorkspaceDialog.vue` / `ManualPOIEditor.vue` / `SubtitlePropertiesPanel.vue` and export parity**, not the OpenCut editor under `client/src/editor/`.

---

## Fix transitions in the video editor

**Context:** Transition types and preview math live in `client/src/types/index.ts` (`VideoEditorTransition`, `detectSourceTransitions`, `calculateTransitionState` with crossfade, slide, wipe, zoom). The OpenCut-style editor under `client/src/editor/` did not show obvious imports of `calculateTransitionState` in a quick search—transitions may be partially wired (types/presets vs playback/export). **Next:** Trace how edits overlap in the timeline, where transition effects are applied in preview vs FFmpeg export, and reproduce the specific broken behavior (preview only, export only, or both).

---

## Fix org public page (needs the correct counts for everything)

**Context:** Public stats are assembled server-side in `server/lib/clippster_server/organizations.ex` (`get_public_profile_by_slug/1`): `campaigns_total`, `campaigns_running` (`status == "active"`), `campaigns_completed` (`status == "completed"`), `clippers_count` (members with `role == "member"` only), `streamers_count` (enabled streamer creator profiles). Consumed by `client/src/pages/OrgPublicProfilePage.vue`, `landing/src/pages/OrgPublicProfilePage.tsx`, and `client/src/services/orgPublicProfilesApi.ts`. **Next:** Compare live DB statuses for “ended” campaigns vs `completed`, whether non-`member` roles should count as clippers, and whether draft/paused campaigns should affect “total.”

---

## Fix campaigns — when they end, the org needs to still be able to see all completed campaigns

**Context:** Org listing uses `listOrganizationCampaigns(organizationId)` with no status filter in `client/src/components/organization/OrganizationCampaigns.vue`; the API `Campaigns.list_organization_campaigns/2` only filters when `status` is passed (`server/lib/clippster_server/campaigns.ex`, `campaign_controller.ex` `org_index`). Marketplace listing (`list_active_campaigns`) intentionally hides past `ends_at` while status is still `active` until auto-complete runs. **Next:** If org UI still “loses” campaigns, check for another surface (e.g. assets page), race before `auto_complete_expired_campaigns`, or client-side filtering; confirm completed rows exist in DB after end date.

---

## Subtitle export parity — project workspace (`16:9`) and manual POI (per aspect ratio)

**Scope (important):** This is **not** the OpenCut timeline video editor under `client/src/editor/`. It is the **clip / VOD workflow**: project workspace dialog, manual POI editor, and the subtitle styling UI.

**Goal:** Burned-in or exported subtitles must match **exactly** what the user configured in:

1. **`client/src/components/SubtitlePropertiesPanel.vue`** — style and copy edits emitted via `@updateSettings` / related handlers (the panel is mounted from `ProjectWorkspaceDialog.vue` on the subtitles tab, `@updateSettings="onSubtitleSettingsUpdate"`).
2. **`client/src/components/poi/ManualPOIEditor.vue`** — per–aspect-ratio placement and settings via `subtitlePositionOverride`, `subtitleSettings`, `POITargetPanel`, and emits `subtitlePositionChange` / `subtitleSettingsChange`.

**Workspace (`ProjectWorkspaceDialog.vue`):** Preview defaults include `16:9` (`previewAspectRatio`); `VideoPlayer` receives `activeSubtitleSettings` and position props. Fixes here are about **persisting the same payload the panel edits** and ensuring the **build/export path** reads that payload for the `16:9` (and any selected preview ratio) output, not only the in-dialog preview.

**Manual POI (`ManualPOIEditor.vue`):** Each aspect ratio can diverge; export must apply the correct overrides **per output ratio**, not a single global subtitle layout.

**Next:** Trace end-to-end from `SubtitlePropertiesPanel` → DB / clip fields → Rust/FFmpeg subtitle generation (`client/src-tauri/...`, e.g. subtitle burn-in), and separately from `ManualPOIEditor` emits → whatever stores per-ratio overrides → export. Diff preview state vs what the encoder receives for `16:9` and for each manual POI ratio.

---

## Fix downloading audio — must navigate away and back to audio library to see newest download

**Context:** `client/src/pages/AudioLibrary.vue` listens for Tauri `download-complete` and calls `loadAudioFiles()` (~1034+). Download flow is also described in `docs/AUDIO_DOWNLOAD_PLAYLIST_PLAN.md`. **Next:** Confirm events fire when the library page is already mounted; check for duplicate listeners, unmount cleanup, or DB commit timing vs event.

---

## Fix adding to playlist in audio library — first create forces a second visit to add the track

**Context:** In `AudioLibrary.vue`, the “Create New Playlist” control inside the add-to-playlist dialog closes the add dialog and opens the create dialog **without** passing the pending track or auto-adding after create:

```427:428:client/src/pages/AudioLibrary.vue
                <button
                  @click="showAddToPlaylistDialog = false; showCreatePlaylistDialog = true"
```

`createPlaylist()` reloads playlists but does not call `addAudioToPlaylist` for `selectedAudioForPlaylist`. **Next:** Preserve `selectedAudioForPlaylist` through create, or after `createAudioPlaylist` resolve the new id and add the track in one flow.

---

## Add subtitle options to manual clipping

**Context:** Separate from **Subtitle export parity** above (which is about matching `SubtitlePropertiesPanel` + `ManualPOIEditor` to export). This item is about **manual clip creation** paths (`Timeline.vue`, `createManualClip` in `client/src/services/database/manual-clips.ts`) and whether those flows expose the same subtitle controls as the rest of the clip workflow. **Next:** Decide product scope; if manual clips should use the same settings, wire UI + storage consistent with `ProjectWorkspaceDialog` / POI data model.

---

## Add text box to project workspace / per aspect ratio

**Context:** `ProjectWorkspaceDialog.vue` already composes watermarks, subtitles, and social overlays for preview; per-ratio state is partially modeled via `previewAspectRatio` and watermark/subtitle hooks. **Next:** Align with existing overlay/text pipeline (e.g. caption nodes / branding) and storage model for per-ratio layout.

---

## Add text box to manual clipping

**Context:** Same manual clip path as above; `ManualPOIEditor.vue` is the rich manual POI surface. **Next:** Specify whether “text box” means burn-in overlay, editor-only annotation, or export metadata; then hook into the same build path as other overlays.

---

## Run a thorough audit and fix all PowerShell dialog opening across the app

**Context:** The desktop app uses `@tauri-apps/plugin-dialog` (`open`, `save`) in many places—e.g. `Projects.vue`, `Clips.vue`, `AudioLibrary.vue`, `ExportButton.vue`, composables (`useVideoOperations`, `useAssetOperations`, etc.). On Windows, misconfiguration or plugin behavior can flash a PowerShell/console window when spawning the native dialog. **Next:** Inventory all `open`/`save` usages; confirm Tauri v2 dialog plugin and Windows `windows_subsystem` settings; test each flow on Windows for console flash.

---

## Fix built clips page taking forever to load

**Context:** `client/src/pages/Clips.vue` `loadClips()` calls `getAllClipsWithBuilds()` then per-clip work: transcript IDs, `thumbnailStore.loadThumbnails`, and for each clip with `project_id`, `getProjectInfo` + `loadRawVideosForProject` sequentially (~2020+). That pattern is a strong N+1 / sequential load candidate. **Next:** Profile network and Tauri calls; batch project/video fetches and defer non-visible thumbnail work.

---

## Fix built clips sidebar taking forever to load in calendar

**Context:** `client/src/components/calendar/ClipsSidebar.vue` `loadClips()` uses `getAllClips()`, then `loadBuilds()` (per-clip `getClipBuilds`), then thumbnail store loads—same structural cost as `BuiltClipsView.vue` in the editor. **Next:** Add a single API or Rust command that returns clips+completed builds; parallelize with a concurrency limit; lazy-load thumbnails for visible rows only.

---

## Fix org enable pool balance (owner gets 400 on toggle-pool-fallback)

**Context:** Client: `client/src/composables/useOrganization.ts` ~620 posts to `/organizations/:id/credits/toggle-pool-fallback`; UI in `client/src/pages/organization/OrganizationBilling.vue` ~1086. Server: `organization_controller.ex` `toggle_pool_fallback/2` requires `Organizations.get_member_allocation(org_id, member_id)`; if missing, responds **400** `"Member allocation not found"` (see ~871–874). **Likely cause:** Owner (or target user) has no `MemberCreditAllocation` row, so toggling pool fallback cannot persist. **Next:** Confirm whether owners should auto-get an allocation record, or the UI should hide/disable the toggle when `allocation` is null; align product rule with `Organizations.allocate` / onboarding.

---
