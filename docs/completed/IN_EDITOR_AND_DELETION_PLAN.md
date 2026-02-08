# In Editor Badging & Project Deletion Behavior

## Goals
- Show an “In Editor” badge in ProjectWorkspaceDialog for clips opened in ClipEditorDialog.
- Persist the state across sessions; both ProjectWorkspaceDialog and VideoEditor read the same source of truth.
- In VideoEditor, in-editor clips appear inline with other projects (no separate section) and remain clickable to continue editing.
- Project deletion removes raw videos and unbuilt/unopened clips, but retains built clips (My Clips) and in-editor clips until explicit removal rules are met.

## Data Model & Persistence
- Create a localStorage-backed store/composable (`useInEditorClips`):
  - Entry: `{ clipId, projectId?, projectNameSnapshot, origin: 'project' | 'other', assetPath, createdAt }`.
  - Methods: `addClip`, `clearClip`, `clearMany`, `isInEditor`, `listClips(filter)`, `hydrate/persist`.
- Asset path handling:
  - Prefer stable built asset URLs/paths; store directly.
  - If only raw/project-tied asset exists when adding to In Editor, copy/move to a project-independent safe directory and store that path (skip if already built).
- Badge state derives from this store; no extra flags.

## UI Touchpoints
- ProjectWorkspaceDialog.vue
  - On “Edit clip” → `addClip` with metadata (clipId, projectId, projectNameSnapshot, origin='project', assetPath).
  - Render badge: if `isInEditor(clipId)` → show “In Editor” badge (use existing badge style).
  - Manual clear action (per clip) calls `clearClip`; this also removes it from VideoEditor since the store is shared.

- ClipEditorDialog.vue
  - On mount/clip change: call `addClip` (idempotent).
  - On export success: prompt “Clear ‘In Editor’ for this clip?” If yes → `clearClip`; if no → keep.
  - If export yields new built asset path, update stored `assetPath`.
  - If manual delete-from-editor exists, offer to clear.

- VideoEditor.vue
  - Consume the same store; merge in-editor clips into the existing project list/grid (no extra section).
  - Display project name via `projectNameSnapshot` (fallback “Unknown project”).
  - Click opens the clip in the editor using stored `clipId/assetPath`.
  - Removal: manual delete/clear or export-confirmed clear. No auto-clear on project deletion.
  - Support bulk delete: selection uses `clearClip` for in-editor entries.

## Project Deletion Semantics
- Raw videos: delete files from disk; remove DB records.
- Unbuilt/unopened clips (not built, not In Editor): delete records and any local clip files.
- Built clips: keep (needed for My Clips); files remain until deleted from My Clips.
- In Editor clips: keep; ensure `assetPath` is project-independent (copy/move if needed). Do not clear on project deletion.
- Preserve `project_name` snapshot on retained clips (already done) and set `project_id = NULL`.
- Child projects: apply the same rules when deleting segments/children.
- Update delete confirmation text to reflect: raw videos deleted; unbuilt/unopened clips deleted; built and in-editor clips retained.

## Storage Locations
- Ensure a stable, project-independent directory for:
  - Built clips (existing location).
  - In-editor cached assets when source was project-tied raw (safe directory via Tauri invoke or file helper).

## My Clips Interaction
- Built clips continue to appear in My Clips; deletion there removes files.
- In Editor clips are separate until exported or manually cleared; exporting can add/update My Clips but only clears In Editor if user confirms.

## Edge Cases
- Project deleted: in-editor entries still open from stored `assetPath`; if missing, show error with option to clear.
- Idempotency: `addClip` should not duplicate entries; updates refresh metadata/assetPath.
- Fallback label if `projectNameSnapshot` missing: “Unknown project”.
- Manual clear available in both ProjectWorkspaceDialog and VideoEditor; changes propagate because of shared store.

## Testing Checklist
1) Open clip from project → badge shows; VideoEditor shows entry inline.
2) Export with “Yes, clear” → entry disappears from badge/VideoEditor; built clip in My Clips remains.
3) Export with “No” → entry stays; built clip appears/updates in My Clips.
4) Manual clear from ProjectWorkspaceDialog and VideoEditor removes entry.
5) Delete project with:
   - Unbuilt/unopened clips → removed and files deleted.
   - Built clips → retained; still in My Clips; files present.
   - In Editor clips → retained; still openable; assetPath survives.
   - Raw videos → deleted from disk.
6) Child project deletion respects the same rules.
7) Missing assetPath on open → error surfaced; user can clear.
8) LocalStorage persistence across reloads is verified.

## Files to Modify
- New store: `client/src/stores/useInEditorClips.ts` (or composable).
- `client/src/components/ProjectWorkspaceDialog.vue`: addClip on edit, badge, manual clear.
- `client/src/components/clip-editor/ClipEditorDialog.vue`: addClip on open, export prompt to clear, optional assetPath update.
- `client/src/pages/VideoEditor.vue`: merge in-editor entries into project list, support delete/clear/bulk.
- `client/src/pages/Projects.vue` + `client/src/services/database/projects.ts`: enforce deletion rules (remove unbuilt/unopened clips, raw files; retain built and in-editor), ensure safe asset relocation if needed.
- File utilities/Tauri invoke for safe copy/move to non-project directory if required.

## Migration/Data
- If needed, one-time check to ensure `project_name` snapshots exist on clips and to identify built vs unbuilt via `built_file_path` flags; otherwise rely on current schema.
