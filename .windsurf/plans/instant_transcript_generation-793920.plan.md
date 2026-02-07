# Transcript-Only Button + 2nd Run Credit Integration

Add a "Transcribe" button alongside the existing "Detect Clips" button on project cards and folder segment cards, using the existing transcription-only credit system (0.3 credits/min server-side). Once a transcript exists, clip detection uses the cheaper "2nd run" rate (0.7 credits/min instead of 1.0).

---

## Current Credit Rates (no changes needed)

| Operation | Server Rate | Frontend Display |
|---|---|---|
| Transcription only (`/clips/transcribe`) | **0.3 credits/min** | New — needs confirmation dialog |
| Clip detection 1st run (no transcript) | 1.0 credits/min | 1.0 credits/min |
| Clip detection 2nd run (transcript exists) | 0.7 credits/min | 0.75 credits/min |
| Multimodal | 2x multiplier | 2x multiplier |

## Where the Buttons Go

### 1. Folder Dialog → Segments Tab (segment card hover overlay)
`Projects.vue` lines 586-614 — each segment card has a hover overlay with action buttons:
- ▶ Open Workspace
- ✨ Detect Clips  
- **NEW: 📝 Transcribe** (between Detect and Delete)
- 🗑 Delete

### 2. Project Cards (main grid)
`Projects.vue` lines 338-348 — project card action buttons:
- ▶ Open  
- ✨ Detect Clips
- **NEW: 📝 Transcribe**
- ✏ Edit / 🗑 Delete

### 3. ProjectWorkspaceDialog → MediaPanel header area
Already has "Detect" button. Add "Transcribe" button next to it (or show "Transcribed ✓" badge if already done).

---

## Implementation Plan

### Phase 1: Transcription-Only Composable
**New file: `client/src/composables/useTranscriptionOnly.ts`**

Extracts the transcription-only workflow from `useChunkedClipDetection.ts`:
- `transcribeProject(projectId, options?)` — main entry point
- Checks if transcript already exists (`getTranscriptByRawVideoId`)
- If not: initializes chunked transcript session, transcribes each chunk via `/clips/transcribe`, stitches into full transcript, saves to DB
- Dispatches `transcript-updated` event on completion
- Exposes reactive `progress`, `isTranscribing`, `error` state
- Supports `organizationId` for org credit deduction (passed to API)
- Supports cancellation

This reuses existing infrastructure:
- `useChunkedTranscriptCache` for session management
- `useAudioChunking` (Rust) for audio extraction
- `/clips/transcribe` API endpoint (already charges 0.3 credits/min)
- `createTranscript` + `createTranscriptSegment` for DB storage

### Phase 2: Transcription Confirmation Dialog
**New file: `client/src/components/TranscriptionConfirmDialog.vue`**

Similar to `ClipDetectionConfirmDialog.vue` but simpler (no prompt selection, no multimodal toggle):
- Shows video duration and estimated credit cost (0.3 credits/min)
- Credit source selector (personal vs org) via `useCreditSource`
- "Already transcribed" badge if transcript exists
- Confirm/Cancel buttons
- Admin bypass (free)

### Phase 3: Add Transcribe Buttons
**Modified file: `client/src/pages/Projects.vue`**

Add "Transcribe" button in 3 places:

**a) Folder segment card hover overlay** (lines ~594-606):
```html
<button v-if="canTranscribe(project.id)" @click.stop="startTranscription(project)">
  <FileText :size="20" />
</button>
```

**b) Project card actions** (lines ~341-348):
```html
<button v-if="canTranscribe(project.id)" @click.stop="startTranscription(project)">
  <FileText class="project-card__action-icon" />
</button>
```

**c) New functions:**
- `canTranscribe(projectId)` — has video, not already transcribing
- `isTranscribed(projectId)` — check if transcript exists in DB
- `startTranscription(project)` — auth check, show confirmation dialog, run transcription
- Track transcription state per project (similar to detection tracking)

**d) Show "Transcribed" badge on segment cards** when transcript exists (similar to "Detecting..." badge)

### Phase 4: Transcribe Button in ProjectWorkspaceDialog
**Modified files:**
- `client/src/components/ProjectWorkspaceDialog.vue` — add transcribe action
- `client/src/components/MediaPanel.vue` — show "Transcribe" button in header when no transcript exists

When transcript exists, the `isTranscribed` computed (already at line 363) returns `true`, and `ClipDetectionConfirmDialog` already shows the cheaper 2nd-run rate.

### Phase 5: Transcript Status Tracking
**Modified file: `client/src/pages/Projects.vue`**

Need to track which projects have transcripts to show correct UI state:
- Load transcript status when loading project videos (batch query)
- Add `projectTranscripts` reactive map: `projectId → boolean`
- New DB helper: `hasTranscriptForProject(projectId)` in `transcripts.ts`
- Refresh after transcription completes

---

## File Change Summary

### New Files
| File | Purpose |
|------|---------|
| `client/src/composables/useTranscriptionOnly.ts` | Transcription-only workflow composable |
| `client/src/components/TranscriptionConfirmDialog.vue` | Credit confirmation dialog for transcription |

### Modified Files
| File | Changes |
|------|---------|
| `client/src/pages/Projects.vue` | Add Transcribe buttons on project cards + folder segments, tracking state |
| `client/src/components/ProjectWorkspaceDialog.vue` | Add transcribe action in workspace |
| `client/src/components/MediaPanel.vue` | Show Transcribe button in header |
| `client/src/services/database/transcripts.ts` | Add `hasTranscriptForProject()` helper |

### Unchanged (already working)
| File | Why |
|------|-----|
| Server `clips_controller.ex` | `/clips/transcribe` already charges 0.3 credits/min |
| `ClipDetectionConfirmDialog.vue` | Already shows cheaper rate when `isTranscribed` is true |
| `useChunkedClipDetection.ts` | Already reuses existing transcripts via `getTranscriptByRawVideoId` |
| `TranscriptPanel.vue` | Already has full word-level display, editing, search |
| `useTranscriptData.ts` | Already loads transcript reactively |

## Implementation Order
1. Phase 1 — `useTranscriptionOnly.ts` composable
2. Phase 2 — `TranscriptionConfirmDialog.vue`
3. Phase 5 — Transcript status tracking in Projects.vue
4. Phase 3 — Transcribe buttons in Projects.vue
5. Phase 4 — Transcribe in ProjectWorkspaceDialog/MediaPanel

## Key Behavior Flow
```
User clicks "Transcribe" on segment card
  → TranscriptionConfirmDialog shows cost (0.3 credits/min × duration)
  → User confirms → useTranscriptionOnly runs in background
  → Audio extracted → chunks transcribed → full transcript saved to DB
  → "Transcribed ✓" badge appears on segment card
  → User later clicks "Detect Clips"
  → ClipDetectionConfirmDialog shows 0.75 credits/min (2nd run rate)
  → useChunkedClipDetection finds existing transcript → skips transcription
  → Only AI clip detection runs → cheaper for user
```
