# Seamless Segment Preview Plan

## Problem Statement

When playing video clips with multiple segments (cuts), transitioning between segments causes noticeable issues:
- 10-50ms delay while the browser seeks to the next segment
- Frame freezes during seek operations
- Inconsistent behavior across browsers

The root cause is that HTML5 video elements cannot perform frame-accurate instantaneous seeks. The browser must decode from the nearest keyframe, causing unavoidable latency.

## Requirements

- Seamless playback with **no visible glitches** at segment boundaries.
- Preview reflects **all effects, transitions, overlays, and audio FX**.
- **Proxy preview** at 720p for timeline playback.
- **HQ preview** at 1080p when fullscreen is triggered.
- **Progressive cache** using 3-second chunks (prioritized around playhead).
- Render **the whole clip** (not just the viewport).
- HQ rendering happens **quietly** (no user-facing badge).

## Solution: Progressive Preview Cache (Proxy + HQ)

Render the edited timeline into **chunked preview caches** instead of seeking within source files.
Playback always uses a single continuous stream (HLS manifest) so segment cuts never cause seeks.

### How Professional NLEs Solve This

Tools like CapCut and DaVinci Resolve use **background render caches**:
1. When edits change, preview caches are invalidated and re-rendered in the background.
2. Timeline playback uses low-res proxy caches for smooth realtime playback.
3. Fullscreen or review modes can swap to higher-quality cached media.

We will implement the same behavior with a proxy cache plus on-demand HQ cache.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Makes Edit                          │
│        (Cuts / Overlays / Transitions / Audio / Effects)         │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│               Invalidate Preview Cache (Proxy + HQ)             │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Progressive Render Queue                      │
│                                                                  │
│  1. Render 3s chunks around playhead first                       │
│  2. Continue forward then backward                               │
│  3. Generate HLS manifests for proxy and HQ                      │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Preview Playback Flow                        │
│                                                                  │
│  - Timeline playback uses 720p proxy manifest                    │
│  - Fullscreen triggers HQ render (1080p)                         │
│  - Player auto-swaps to HQ once chunks exist                     │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Details

### 1. Preview Cache Render Commands

**Location:** `client/src-tauri/src/clips/video_processor.rs`

**Core commands (proposed):**
```rust
#[tauri::command]
pub async fn generate_preview_chunk(
    app: tauri::AppHandle,
    clip_id: String,
    tier: String,          // "proxy" | "hq"
    start_time: f64,       // timeline time (seconds)
    duration: f64,         // 3.0 seconds
    output_dir: String,
) -> Result<String, String>

#[tauri::command]
pub async fn write_preview_manifest(
    clip_id: String,
    tier: String,
    output_dir: String,
    chunk_count: u32,
) -> Result<String, String>
```

**Chunk specs:**
- Duration: **3 seconds**
- Proxy: **720p** (fast preset)
- HQ: **1080p** (balanced preset)
- Audio: AAC 128kbps (proxy), 192kbps (HQ)
- Output: HLS segments + manifest (`index.m3u8`)

**Algorithm (per tier):**
1. Render timeline for `[start_time, start_time + 3s]` including **all effects/overlays/audio**.
2. Output `seg_{index}.ts` to preview tier directory.
3. Update HLS manifest with available chunks.

### 2. Preview Cache Metadata + Invalidation

**Cache key:** hash of edit state (segments + effects + overlays + audio + transitions).

When edit hash changes:
1. Mark existing proxy/HQ cache as stale.
2. Start progressive rendering around playhead.

### 3. Frontend Integration

**Location:** `client/src/components/clip-editor/ClipEditorDialog.vue`

**Trigger points:**
- Any edit that changes visual/audio output (segments, effects, overlays, audio, transitions)
- Fullscreen entry (HQ tier)

**State management:**
```typescript
const proxyManifestUrl = ref<string | null>(null);
const hqManifestUrl = ref<string | null>(null);
const isProxyReady = ref(false);
const isHqReady = ref(false);
```

**Behavior:**
- Timeline playback uses `proxyManifestUrl`.
- Fullscreen triggers HQ render and swaps to `hqManifestUrl` once chunks for current time exist.
- Playback stays on proxy until HQ is ready, then auto-swaps **quietly**.

### 4. Preview Component Updates

**Location:** `client/src/components/clip-editor/ClipEditorPreview.vue`

**Changes:**
1. Use HLS manifest as video source (proxy or HQ)
2. Remove segment-seeking logic in clip mode
3. Preview time is **edited timeline time**
4. Keep transcript/waveform mapping based on trim segments

**Props addition:**
```typescript
proxyManifestSrc?: string | null;
hqManifestSrc?: string | null;
```

### 5. Time Mapping

When using preview caches, we map between:
- **Preview time:** Edited timeline time (0 to total duration)
- **Source time:** Original source time (absolute timestamps)

This is needed for:
- Subtitle display (subtitles reference source timestamps)
- Transcript highlighting
- Waveform synchronization

**Mapping structure:**
```typescript
interface SegmentTimeMap {
  previewStart: number;   // Start time in preview video
  previewEnd: number;     // End time in preview video
  sourceStart: number;    // Start time in source video
  sourceEnd: number;      // End time in source video
}
```

**Example:**
```
Source video: 0 ──────────────────────────────────── 60s
Segment 1:    [10s ─────── 20s]
Segment 2:                      [35s ─────── 45s]

Preview video: 0 ──────────────── 20s
               [0s ── 10s][10s ── 20s]
               (Seg 1)    (Seg 2)

Time map:
  { previewStart: 0,  previewEnd: 10, sourceStart: 10, sourceEnd: 20 }
  { previewStart: 10, previewEnd: 20, sourceStart: 35, sourceEnd: 45 }
```

## File Management

### Preview Cache Storage
- Location: App temp directory (`storage::get_temp_dir()`)
- Naming:
  - `previews/clip_{clipId}/proxy_720/index.m3u8`
  - `previews/clip_{clipId}/proxy_720/seg_000.ts`
  - `previews/clip_{clipId}/hq_1080/index.m3u8`
  - `previews/clip_{clipId}/hq_1080/seg_000.ts`
- Cleanup: Delete stale cache when edit hash changes

### Cleanup Strategy
1. Remove stale cache directories on edit hash change
2. Clean up on clip editor close
3. Clean up orphaned cache directories on app startup (optional)

## UI/UX Considerations

### Loading State
- No user-facing badge for HQ rendering (quiet mode).
- Playback remains on proxy until HQ cache is ready.

### Error Handling
If preview generation fails:
- Log error for debugging
- Fall back to proxy cache or direct playback (if no cache exists)

### Performance Targets
- Proxy chunk render: near real-time or faster for typical clips
- HQ chunk render: best-effort in background
- Memory usage: Minimal (streaming, not loading into memory)

## Migration Path

### Phase 1: Backend Commands
1. Implement preview chunk renderer (proxy + HQ)
2. Implement HLS manifest writer
3. Verify output quality and generation speed

### Phase 2: Frontend Integration
1. Switch preview to use HLS manifests
2. Add progressive render queue triggers
3. Implement HQ fullscreen swap logic

### Phase 3: Polish
1. Cache invalidation and cleanup
2. Playback resilience for missing chunks
3. Performance optimization if needed

## Code Locations

| Component | File Path |
|-----------|-----------|
| Preview Renderer | `client/src-tauri/src/clips/video_processor.rs` |
| Command Export | `client/src-tauri/src/clips/mod.rs` |
| Dialog Integration | `client/src/components/clip-editor/ClipEditorDialog.vue` |
| Preview Component | `client/src/components/clip-editor/ClipEditorPreview.vue` |
| Timeline Component | `client/src/components/clip-editor/ClipEditorTimeline.vue` |

## Testing Checklist

- [ ] Single segment clip (no preview needed)
- [ ] Two segment clip (basic case)
- [ ] Many segments (5+)
- [ ] Very short segments (<1 second)
- [ ] Long clips (>5 minutes)
- [ ] Rapid successive edits (queue & prioritization)
- [ ] Preview generation failure (fallback behavior)
- [ ] Subtitle sync with preview video
- [ ] Transcript highlighting sync
- [ ] Waveform sync
- [ ] Memory usage during generation
- [ ] Cache cleanup

## Rollback Plan

If issues arise, revert preview playback to the proxy cache only (no HQ swap) or
fallback to direct segment-seeking while keeping the cache pipeline optional.

## Future Enhancements

1. **Incremental updates:** Only re-encode changed regions
2. **Adaptive quality:** Auto-switch quality based on CPU/GPU load
3. **Smart prefetch:** Render ahead of the playhead based on playback direction
4. **Persistent cache:** Persist previews between sessions
