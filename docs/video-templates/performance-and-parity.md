# Instant Edit performance and parity

Preview must use existing hydrated project media/proxies and draft graphs; template switching must never trigger a full-resolution MP4 export. Final export uses original media through the normal Tauri or Android renderer.

Budgets:

- cached catalog metadata p95 ≤250 ms;
- cover p95 ≤500 ms after metadata;
- first personalized preview for analyzed ≤60 s local 1080p source p95 ≤3 s;
- cached switch p95 ≤500 ms to a representative frame;
- no sustained main-thread tasks over 100 ms;
- bounded jobs, decoders, memory, disk, and file handles.

Benchmark Windows 1080p/4K H.264/H.265 and Android reference devices with H.264 plus supported H.265. Include VFR, rapid switching/cancellation, 100+ catalog entries, repeated open/close, missing media, and long sources.

For every built-in/aspect, compare start, cut/transition anchors, caption states, and end frames. Validate crop/fit, transforms, effects, text/font layout, audio start/fade/duck/beat alignment, and output duration/resolution. Preview and export should stay within one output frame and one audio frame unless a renderer-specific tolerance is documented.

Record hardware, input hashes, codecs, renderer route, p50/p95, peak memory, and failures. Do not silently weaken a missed budget.
