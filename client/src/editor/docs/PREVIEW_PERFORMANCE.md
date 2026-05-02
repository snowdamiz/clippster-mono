# Preview performance validation

## Instrumentation

1. In the app, open DevTools and run: `localStorage.setItem('clippster_preview_perf', '1')` then reload.
2. Or set `window.__CLIPPSTER_PREVIEW_PERF__ = true`.
3. Rolling stats: `window.__clippsterPreviewPerfStats()`.
4. Toggle GPU preview passes: `editor.renderer.setGpuPreviewEffectsEnabled(false)` (from Vue/console where `editor` is available).

Console will log `[PreviewPerf]` lines every ~30 frames with avg / p95 frame time.

## Stress timeline (dev)

With a project open: `window.__clippsterApplyStressTimeline()` — appends ~100 effect/text/caption elements for load testing.

## Worker smoke test

`preview-worker-client.ts` exposes `pingPreviewWorker()` for optional off-main-thread checks (used for future hashing / scheduling).

## What to compare (before/after)

- Scrub and play with a heavy timeline: frame time from `[PreviewPerf]` logs.
- Autosave: while playing, saves debounce to ≥2s to reduce main-thread JSON work.
- Scene rebuild: identical edits should hit the scene fingerprint cache (no redundant `buildScene`).
