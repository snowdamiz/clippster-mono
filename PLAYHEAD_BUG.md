# Playhead Lag Bug Handoff

## Overview

This document captures the current understanding of the timeline playhead lag bug in `client/src/editor`, the changes attempted so far, the current code state, and the most likely remaining causes.

Current status at handoff:

- The playhead follows the cursor again while dragging.
- The original user complaint is still unresolved: dragging the playhead still feels laggy.
- The user reports that the lag gets worse the faster they drag.
- The user explicitly asked not to change the existing debounced seek behavior.

## User-Reported Behavior

The original request was:

- In the video editor under `/client/src/editor`, dragging the playhead feels laggy.
- The debounce already in place is intentional and should not be changed.
- The requested fix was to make the playhead animated and optimistic during dragging so the timeline feels smooth.

Observed behavior over this debugging session:

- Initial state: playhead drag felt laggy.
- After the first optimistic-preview change: user reported no visible improvement.
- After a later refactor: a regression caused the playhead to stay in place until mouseup.
- That regression has been fixed.
- Latest user report: the playhead follows the cursor again, but the lag is still there.

## Important Constraints

- Do not remove or fundamentally alter the existing debounced seek concept in `useTimelinePlayhead`.
- The fix needs to preserve a responsive timeline drag experience.
- The existing repo currently has unrelated TypeScript errors outside this work area, so full `vue-tsc` is noisy.

## Primary Code Paths

### Timeline drag path

- [`client/src/editor/composables/timeline/useTimelinePlayhead.ts`](./client/src/editor/composables/timeline/useTimelinePlayhead.ts)
  - Handles scrubbing state.
  - Calculates raw mouse time and snapped seek time.
  - Currently uses a local optimistic path plus imperative DOM transform updates.

- [`client/src/editor/components/timeline/Timeline.vue`](./client/src/editor/components/timeline/Timeline.vue)
  - Owns timeline-level refs.
  - Wires the playhead ref into `useTimelinePlayhead`.

- [`client/src/editor/components/timeline/TimelinePlayhead.vue`](./client/src/editor/components/timeline/TimelinePlayhead.vue)
  - Pure UI playhead component.
  - Currently presentational only.
  - Receives the real DOM ref through `v-model:playhead-ref`.

### Playback side effects that appear relevant

- [`client/src/editor/core/managers/playback-manager.ts`](./client/src/editor/core/managers/playback-manager.ts)
  - `seek()` at lines 44-54 updates `currentTime`, notifies listeners, and dispatches `playback-seek`.
  - Playback loop at lines 139-170 dispatches `playback-update` every frame while playing.

- [`client/src/editor/components/preview/PreviewPanel.vue`](./client/src/editor/components/preview/PreviewPanel.vue)
  - Uses `useEditor()` with broad subscriptions at line 16.
  - Runs a RAF render loop at lines 111-146.
  - Reads `editor.playback.getCurrentTime()` on every loop iteration at line 124.
  - When a new frame is needed, it calls `renderToCanvas()`, which can be expensive.

- [`client/src/editor/core/managers/audio-manager.ts`](./client/src/editor/core/managers/audio-manager.ts)
  - Subscribes to playback/timeline/media at lines 42-46.
  - Listens to `playback-seek` at lines 47-49.
  - `handleSeek()` at lines 91-101 restarts or stops audio playback in response to seeks.

- [`client/src/editor/components/timeline/TimelineElement.vue`](./client/src/editor/components/timeline/TimelineElement.vue)
  - Timeline element waveform/playhead rendering uses playback time.
  - Current local changes try to suppress playback-driven waveform updates during scrubbing at lines 200-229.

## Current Working Hypothesis

The remaining lag is most likely not the playhead DOM movement itself anymore.

The strongest current hypothesis is:

1. Dragging the playhead still triggers frequent debounced `editor.playback.seek()` calls.
2. Each committed seek still fans out into heavy downstream work:
   - `PlaybackManager.seek()` notifies playback subscribers and dispatches `playback-seek`.
   - `AudioManager` reacts to seeks and may stop/restart playback internals.
   - `PreviewPanel` continues to render frames based on playback time.
   - Other reactive consumers may still wake up even after some subscription narrowing.
3. That heavy work likely blocks the main thread enough that the drag feels worse as pointer velocity increases.

In short:

- The timeline UI now has an optimistic path.
- The expensive preview/audio/playback side effects are probably still overwhelming the main thread.
- That would explain why the playhead still feels laggy even after several UI-side optimizations.

## Changes Attempted So Far

### 1. Added optimistic preview time during drag

Files:

- [`client/src/editor/composables/timeline/useTimelinePlayhead.ts`](./client/src/editor/composables/timeline/useTimelinePlayhead.ts)
- [`client/src/editor/components/timeline/Timeline.vue`](./client/src/editor/components/timeline/Timeline.vue)
- [`client/src/editor/components/timeline/TimelinePlayhead.vue`](./client/src/editor/components/timeline/TimelinePlayhead.vue)

Intent:

- Separate raw drag motion from snapped seek time.
- Show a smoother visual preview while preserving the existing seek debounce.

Result:

- User reported no visible improvement.

### 2. Added transform-based playhead movement and visual feedback

Files:

- [`client/src/editor/components/timeline/TimelinePlayhead.vue`](./client/src/editor/components/timeline/TimelinePlayhead.vue)

Intent:

- Move the playhead with transform-based motion instead of layout-heavy left positioning only.
- Add small visual enhancements so the handle feels more responsive.

Result:

- Did not solve the reported lag.

### 3. Reduced playback-driven reactivity in timeline components

Files:

- [`client/src/editor/composables/useEditor.ts`](./client/src/editor/composables/useEditor.ts)
- [`client/src/editor/components/timeline/Timeline.vue`](./client/src/editor/components/timeline/Timeline.vue)
- [`client/src/editor/components/timeline/TimelineRuler.vue`](./client/src/editor/components/timeline/TimelineRuler.vue)
- [`client/src/editor/composables/timeline/element/useElementSelection.ts`](./client/src/editor/composables/timeline/element/useElementSelection.ts)
- [`client/src/editor/components/timeline/TimelineTrackContent.vue`](./client/src/editor/components/timeline/TimelineTrackContent.vue)
- [`client/src/editor/components/timeline/TimelineElement.vue`](./client/src/editor/components/timeline/TimelineElement.vue)

Intent:

- Add selective manager subscriptions to `useEditor()`.
- Prevent the main timeline subtree from rerendering on every playback change.
- Suppress waveform/playhead updates in elements during scrubbing.

Result:

- User still reported no visible improvement.

### 4. Switched playhead drag updates to imperative RAF DOM writes

Files:

- [`client/src/editor/composables/timeline/useTimelinePlayhead.ts`](./client/src/editor/composables/timeline/useTimelinePlayhead.ts)

Intent:

- Move the playhead with `requestAnimationFrame`-queued DOM transforms during drag.
- Avoid relying on reactive component rerenders during the drag itself.

Result:

- This was the most promising structural change.
- However, an integration bug initially broke it.

### 5. Regression introduced and fixed: playhead held still until mouseup

Cause:

- The playhead DOM ref channel was accidentally changed from `v-model` to a plain prop, so the composable never received the element to move imperatively.

Files involved:

- [`client/src/editor/components/timeline/TimelinePlayhead.vue`](./client/src/editor/components/timeline/TimelinePlayhead.vue)
- [`client/src/editor/components/timeline/Timeline.vue`](./client/src/editor/components/timeline/Timeline.vue)

Current result:

- The regression is fixed.
- The playhead follows the cursor again.
- The lag remains.

## Current Uncommitted Code State

There are active uncommitted changes in these files:

- `client/src/editor/composables/useEditor.ts`
- `client/src/editor/composables/timeline/useTimelinePlayhead.ts`
- `client/src/editor/composables/timeline/element/useElementSelection.ts`
- `client/src/editor/components/timeline/Timeline.vue`
- `client/src/editor/components/timeline/TimelinePlayhead.vue`
- `client/src/editor/components/timeline/TimelineTrackContent.vue`
- `client/src/editor/components/timeline/TimelineElement.vue`
- `client/src/editor/components/timeline/TimelineRuler.vue`

Also note:

- `AGENTS.md` and `CLAUDE.md` are dirty but unrelated.
- Some touched timeline files have large formatting-only diff noise in addition to the actual behavior changes.

## Most Useful Current Evidence

### Evidence pointing away from the playhead DOM as the main remaining issue

- The playhead now has a direct imperative transform update path in `useTimelinePlayhead`.
- The playhead component no longer subscribes to playback state directly.
- The user still reports lag after those changes.

### Evidence pointing toward preview/audio/playback side effects

- `PlaybackManager.seek()` always notifies listeners and dispatches `playback-seek`.
- `AudioManager` listens to `playback-seek` and performs non-trivial work in response.
- `PreviewPanel` continuously renders based on playback time and can skip frames when rendering is slow.
- The lag gets worse with faster drag input, which is consistent with repeated costly side effects.

## Best Next Steps For The Takeover Agent

### 1. Verify whether the remaining lag is caused by preview/audio work

Recommended approach:

- Profile the drag in the browser performance tools or equivalent runtime profiler.
- Specifically inspect time spent in:
  - `PreviewPanel` render loop / `renderToCanvas()`
  - `AudioManager.handleSeek()`
  - any playback subscriber callbacks

### 2. Instrument seek frequency and side-effect cost

Useful temporary instrumentation points:

- `PlaybackManager.seek()`
- `AudioManager.handleSeek()`
- `PreviewPanel` render loop around `renderToCanvas()`

Goal:

- Measure how many seeks happen during a fast drag.
- Measure how much work each seek causes.

### 3. Consider introducing a distinct “drag preview” path

This is the most likely real fix direction.

Potential design:

- Keep the existing debounced seek logic intact.
- Add a separate concept for playhead drag preview that updates:
  - the timeline playhead immediately
  - possibly lightweight preview visuals
- Avoid triggering the expensive playback/audio pipeline on every drag update.

That could mean:

- a “silent seek”
- a drag-only preview time separate from committed playback time
- or a split between timeline UI state and playback engine state

The current architecture does not make that separation cleanly. `PlaybackManager.seek()` is currently both:

- the source of truth update
- and the trigger for expensive downstream work

### 4. Be careful with the current uncommitted diff

The current worktree contains meaningful experimental changes plus formatting churn.

Before continuing:

- Review the current uncommitted changes carefully.
- Consider minimizing the diff before further experimentation.
- Do not assume every current change should stay.

## Verification State

Performed:

- `npx gitnexus analyze` -> up to date
- `git diff --check` on the touched files -> passed

Not cleanly available:

- Full `yarn vue-tsc --noEmit`

Reason:

- The repo has unrelated pre-existing TypeScript errors outside the timeline work area, including files such as:
  - `src/components/NotificationBell.vue`
  - `src/editor/components/EditorHeader.vue`
  - `src/editor/components/panels/assets/CaptionsView.vue`
  - `src/editor/components/panels/properties/VideoProperties.vue`
  - `src/services/campaignAssets.ts`

## Bottom Line

The current best understanding is:

- We likely already removed the obvious UI-only bottleneck.
- The remaining lag is probably caused by expensive work triggered by committed playback seeks during drag.
- The next agent should focus on separating “playhead drag preview” from “full playback seek side effects,” while preserving the existing debounce semantics the user asked to keep.
