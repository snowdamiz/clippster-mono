# Preview performance validation

## Instrumentation

1. In the app, open DevTools and run: `localStorage.setItem('clippster_preview_perf', '1')` then reload.
2. Or set `window.__CLIPPSTER_PREVIEW_PERF__ = true`.
3. Rolling stats: `window.__clippsterPreviewPerfStats()`.
4. Toggle GPU preview passes: `editor.renderer.setGpuPreviewEffectsEnabled(false)` (from Vue/console where `editor` is available).

Console will log `[PreviewPerf]` lines every ~30 frames with avg / p95 frame time.

## Stress timeline (dev)

With a project open: `window.__clippsterApplyStressTimeline()` — appends ~100 effect/text/caption elements for load testing. The helper is loaded only in dev builds from `PreviewPanel` (dynamic import of `stress-timeline-dev.ts`).

## Worker smoke test (dev)

In dev, `PreviewPanel` dynamically imports `pingPreviewWorker()` once on mount. `preview-worker-client.ts` is for optional off-main-thread checks (future hashing / scheduling).

## Main-thread preview path (2026 refactor)

| Area | Behavior |
|------|----------|
| Scene cache | `computeSceneInputFingerprint` / `fingerprintTimelineElement` must cover every field that affects `buildScene` → node params, or `getPreviewSceneTreeCached` can reuse a stale `RootNode`. See JSDoc on `BuildSceneParams` in `scene-builder.ts`. |
| PreviewPanel `useEditor` | Subscribes only to `timeline`, `media`, `scenes`, `project` (not `playback` / `selection`). Playback time for painting is read inside `useRafLoop` via `editor.playback.getCurrentTime()`. |
| Preview overlay interaction | Playback clock updates `visibleElements` at most once per animation frame. Canvas drag/resize/rotate applies timeline updates via `useDragRaf` (one write per frame, latest pointer wins). |
| Multi-select on canvas | One dashed outline per visible selected clip; resize/rotate handles only when exactly one clip is selected (avoids misleading handles for mixed transforms). |
| Decode / effect resolution | `CanvasRenderer` with `previewEffectProcessing: true` uses `getPreviewEffectProcessingSize()` so effects run at backing resolution, not full layout size. |

## Correctness / inspector ↔ canvas checklist

When adding inspector fields for **video** / **image** / **text** / **caption** / **sticker** / **effect** clips:

1. Map the field in `scene-builder.ts` into the corresponding node params.
2. Extend `fingerprintTimelineElement` in `scene-input-fingerprint.ts` so cache invalidation matches.
3. Confirm the node applies it in `render` (e.g. `video-node.ts` → `applyCanvasEffects`, chromakey, masks, curves, wheels, animations). There is no separate “preview-only” skip list in those nodes; preview vs export differs mainly by **backing size** and **GPU helpers** (below).

**GPU helpers:** `tryGpuInvertCanvas2D` only runs at **full** invert intensity (`≥ 99`) and when `isGpuPreviewEffectsEnabled()` is true; otherwise the existing CPU path in `canvas-effects` runs. Toggling GPU off is intentional for debugging, not a missing effect.

## What to compare (before/after)

- Scrub and play with a heavy timeline: frame time from `[PreviewPerf]` logs.
- Autosave: while playing, saves debounce to ≥2s to reduce main-thread JSON work.
- Scene rebuild: identical edits should hit the scene fingerprint cache (no redundant `buildScene`).
- **5s canvas drag + 5s playback** (DevTools Performance): main-thread cost should drop vs pre–rAF-coalesce builds due to fewer `updateTracks` / Vue churn cycles during drag and fewer `visibleElements` recomputes during play.

## Manual regression matrix (preview)

Run through after fingerprint or interaction changes:

- Transform-only drag on canvas (preview follows immediately; fingerprint bumps).
- Crop mode + crop overlay vs stripped crop on `sceneTracks`.
- Color wheels / curves / adjustments on a video clip.
- Stacked effects + chromakey.
- Transition at a cut (incoming/outgoing pairing).
- Scrub while paused; play while idle (no edit).
- Multi-select two visible clips: two dashed outlines, no shared resize handles; drag-move still moves grouped selection on the same track as before.
- z-order hit-test: topmost clip under cursor.
