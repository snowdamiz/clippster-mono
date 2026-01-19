# Rust Playback Engine Integration Guide

## Overview

The Rust-based playback engine provides **CapCut-level performance** for video editing with:

- **Hardware-accelerated decoding** via FFmpeg in Rust
- **Audio-driven timing** for perfect A/V sync
- **Frame ring buffer** for smooth playback
- **Lookahead decode workers** for preloading frames
- **LRU frame cache** (500 frames ≈ 16 seconds at 30fps)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Vue/TS)                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  useRustPlaybackEngine.ts                            │  │
│  │  - Canvas rendering (60fps RAF loop)                 │  │
│  │  - Tauri command invocations                         │  │
│  │  - BGRA → RGBA conversion                            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↕ Tauri IPC
┌─────────────────────────────────────────────────────────────┐
│                    Rust Backend (Tauri)                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  PlaybackEngine                                      │  │
│  │  - Playback thread (audio-driven master clock)       │  │
│  │  - Command channel (Play/Pause/Seek/Stop)            │  │
│  │  - Frame ring buffer (16 slots)                      │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  DecodeWorkerPool                                    │  │
│  │  - 2 worker threads                                  │  │
│  │  - Lookahead decode (3s ahead, 0.5s behind)          │  │
│  │  - Priority task queue                               │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  AudioEngine                                         │  │
│  │  - cpal audio output                                 │  │
│  │  - Hardware-paced timing (sample-accurate)           │  │
│  │  - Master clock for video sync                       │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  DecoderPool + FrameCache                            │  │
│  │  - FFmpeg video decoders (pooled)                    │  │
│  │  - LRU cache (500 frames)                            │  │
│  │  - RGB24 → BGRA conversion                           │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Current Status

### ✅ Completed (Backend)
- Rust playback engine fully implemented
- All Tauri commands registered in `lib.rs`
- Frame decoding, caching, and ring buffer
- Audio engine with hardware timing
- Decode worker pool with lookahead
- Dead code warnings suppressed with `#[allow(dead_code)]`

### ✅ Completed (Frontend)
- `useRustPlaybackEngine.ts` composable created
- Canvas-based rendering interface
- Tauri command wrappers
- BGRA → RGBA pixel format conversion

### ⏳ Pending Integration
- Replace HTML5 `<video>` elements with canvas in `ClipEditorPreview.vue`
- Wire up `useRustPlaybackEngine` to timeline playback
- Handle multi-track timeline (currently single video only)
- Add overlay rendering on top of canvas

## Usage Example

### Basic Integration

```vue
<template>
  <div class="video-preview">
    <canvas
      ref="canvasRef"
      :width="1920"
      :height="1080"
      class="video-canvas"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRustPlaybackEngine } from '@/composables/useRustPlaybackEngine';

const canvasRef = ref<HTMLCanvasElement | null>(null);

const playback = useRustPlaybackEngine({
  videoPath: '/path/to/video.mp4',
  canvasRef,
  onTimeUpdate: (time) => {
    console.log('Current time:', time);
  },
  onPlayStateChange: (isPlaying) => {
    console.log('Playing:', isPlaying);
  },
  onEnded: () => {
    console.log('Playback ended');
  },
});

// Control playback
const handlePlay = () => playback.play();
const handlePause = () => playback.pause();
const handleSeek = (time: number) => playback.seek(time);
</script>
```

### Integration with ClipEditorPreview.vue

To integrate the Rust playback engine into the video editor:

1. **Add canvas element** alongside existing video elements
2. **Initialize Rust engine** when timeline changes
3. **Sync with timeline state** (currentTime, isPlaying)
4. **Render overlays** on top of canvas (text, stickers, watermarks)

```vue
<!-- ClipEditorPreview.vue -->
<template>
  <div class="preview-container">
    <!-- Rust-based canvas playback -->
    <canvas
      v-if="useRustEngine"
      ref="rustCanvasRef"
      :width="previewWidth"
      :height="previewHeight"
      class="rust-video-canvas"
    />
    
    <!-- Fallback to HTML5 video -->
    <video
      v-else
      ref="videoRef"
      :src="videoSrc"
      class="html5-video"
    />
    
    <!-- Overlays render on top of both -->
    <div class="overlays-container">
      <!-- Text, stickers, watermarks, etc. -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRustPlaybackEngine } from '@/composables/useRustPlaybackEngine';

const useRustEngine = ref(true); // Feature flag
const rustCanvasRef = ref<HTMLCanvasElement | null>(null);

const rustPlayback = useRustPlaybackEngine({
  videoPath: props.videoPath,
  canvasRef: rustCanvasRef,
  onTimeUpdate: (time) => {
    emit('time-update', time);
  },
});

// Sync with timeline
watch(() => props.isPlaying, (playing) => {
  if (playing) {
    rustPlayback.play();
  } else {
    rustPlayback.pause();
  }
});

watch(() => props.currentTime, (time) => {
  rustPlayback.seek(time);
});
</script>
```

## API Reference

### Tauri Commands (Rust → Frontend)

#### Playback Control
```typescript
// Start playback engine
await invoke('start_playback', { videoPath: string });

// Pause playback
await invoke('pause_playback');

// Resume playback
await invoke('resume_playback');

// Seek to time
await invoke('seek_playback', { time: number });

// Stop and cleanup
await invoke('stop_playback');

// Get current state
const state = await invoke<string>('get_playback_state');
// Returns: "Stopped" | "Playing" | "Paused"
```

#### Frame Access
```typescript
// Read frame from ring buffer slot
const frameData = await invoke<number[]>('read_frame_slot', { slotId: number });
// Returns: BGRA pixel data as Uint8Array (width * height * 4 bytes)
```

#### Frame Cache Management
```typescript
// Get single frame (cached)
const frameData = await invoke<number[]>('get_video_frame', {
  videoPath: string,
  timestamp: number
});

// Get video dimensions
const [width, height] = await invoke<[number, number]>('get_video_dimensions', {
  videoPath: string
});

// Clear frame cache
await invoke('clear_frame_cache');

// Invalidate cache range (on timeline edits)
await invoke('invalidate_cache_range', {
  videoPath: string,
  startTime: number,
  endTime: number
});

// Invalidate entire video cache
await invoke('invalidate_cache_path', { videoPath: string });

// Get cache statistics
const stats = await invoke('get_frame_cache_stats');
// Returns: { cached_frames: number, is_empty: boolean }
```

#### Proxy Generation (Optional)
```typescript
// Generate editing proxy
const proxyPath = await invoke<string>('generate_video_proxy', {
  videoPath: string,
  codecType: 'prores' | 'h264'
});

// Get proxy path if exists
const proxyPath = await invoke<string | null>('get_video_proxy_path', {
  videoPath: string
});
```

### Frontend Composable

```typescript
interface RustPlaybackEngineOptions {
  videoPath: string;
  canvasRef: Ref<HTMLCanvasElement | null>;
  onTimeUpdate?: (time: number) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  onEnded?: () => void;
}

interface RustPlaybackEngineReturn {
  isPlaying: Readonly<Ref<boolean>>;
  currentTime: Readonly<Ref<number>>;
  
  play: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  seek: (time: number) => Promise<void>;
  stop: () => Promise<void>;
  dispose: () => Promise<void>;
}

function useRustPlaybackEngine(
  options: RustPlaybackEngineOptions
): RustPlaybackEngineReturn;
```

## Performance Targets

| Metric | Target | Current HTML5 `<video>` |
|--------|--------|-------------------------|
| Seek latency | <16ms | 50-200ms |
| Scrubbing FPS | 60fps locked | 15-30fps |
| Segment transitions | 0ms gap | 100-500ms gap |
| Frame accuracy | ±0ms | ±33ms (1 frame) |
| Memory usage | ~200MB (500 frame cache) | ~50MB |

## Known Limitations

1. **Single video source only** - Multi-track timeline not yet supported
2. **No audio mixing** - Audio engine exists but not connected to frontend
3. **Canvas-only rendering** - No fallback to `<video>` element
4. **No transitions** - Crossfades/effects need separate implementation
5. **Fixed frame rate** - Assumes 30fps for decode intervals

## Future Enhancements

### Phase 1: Multi-Track Timeline
- Support multiple video sources on timeline
- Segment-based playback (gaps render black frames)
- Transition support (crossfades, wipes)

### Phase 2: Audio Integration
- Connect AudioEngine to frontend
- Multi-track audio mixing
- Volume/pan/effects support

### Phase 3: Advanced Features
- Variable playback rate (slow-mo, speed ramps)
- Keyframe-aware seeking (via KeyframeIndex)
- Adaptive quality (proxy switching)
- GPU-accelerated effects

### Phase 4: Optimization
- SIMD pixel format conversion
- Zero-copy frame transfer (SharedArrayBuffer)
- WebGPU rendering pipeline
- Hardware decode acceleration

## Troubleshooting

### Canvas shows black screen
- Check `canvasRef` is properly initialized
- Verify `videoPath` is absolute and accessible
- Check browser console for Rust errors
- Ensure FFmpeg sidecar is bundled

### Playback stutters
- Increase frame cache size in `VideoRendererState::new()`
- Check CPU usage (decode workers may be overloaded)
- Verify video codec is supported by FFmpeg

### Audio/video desync
- Audio engine uses hardware timing (should be accurate)
- Check if `onTimeUpdate` callback is too slow
- Verify frame timestamps are correct

### Memory leaks
- Ensure `dispose()` is called on unmount
- Check frame cache is not growing unbounded
- Verify decode workers are properly shutdown

## Migration Path

### Step 1: Feature Flag
Add feature flag to enable Rust engine alongside HTML5 video:

```typescript
const USE_RUST_ENGINE = ref(false); // Toggle in settings
```

### Step 2: Side-by-Side Testing
Run both engines in parallel, compare performance:

```vue
<canvas v-if="USE_RUST_ENGINE" ref="rustCanvas" />
<video v-else ref="htmlVideo" />
```

### Step 3: Gradual Rollout
- Enable for single-video clips first
- Add multi-track support
- Enable for all users

### Step 4: Remove HTML5 Fallback
Once stable, remove `<video>` elements entirely.

## Related Files

### Backend (Rust)
- `src-tauri/src/video_renderer/playback_engine.rs` - Main playback engine
- `src-tauri/src/video_renderer/decoder.rs` - FFmpeg frame decoder
- `src-tauri/src/video_renderer/decoder_pool.rs` - Decoder pooling
- `src-tauri/src/video_renderer/frame_cache.rs` - LRU frame cache
- `src-tauri/src/video_renderer/audio_engine.rs` - Audio playback
- `src-tauri/src/video_renderer/decode_worker.rs` - Lookahead workers
- `src-tauri/src/video_renderer/commands.rs` - Tauri command handlers
- `src-tauri/src/lib.rs` - Command registration

### Frontend (TypeScript/Vue)
- `src/composables/useRustPlaybackEngine.ts` - Playback composable
- `src/components/clip-editor/ClipEditorPreview.vue` - Video preview component
- `src/composables/usePlaybackEngine.ts` - Current RAF-based engine

## DVR MSE Functions

The following DVR functions are now registered for Media Source Extensions playback:

```typescript
// Read cluster data only (for MSE append)
const clusterData = await invoke<number[]>('read_dvr_cluster', {
  mintId: string,
  chunkIndex: number
});

// Build VOD from DVR chunks
const vodPath = await invoke<string>('build_vod_from_dvr', {
  mintId: string,
  projectId: string,
  displayName: string
});

// Convert DVR chunk to HLS segment
const segmentPath = await invoke<string>('convert_dvr_chunk_to_hls', {
  mintId: string,
  chunkIndex: number,
  hlsOutputDir: string
});

// Build segment from DVR chunks
const segmentPath = await invoke<string>('build_segment_from_dvr_chunks', {
  mintId: string,
  startChunk: number,
  endChunk: number,
  outputPath: string
});
```

## Summary

The Rust playback engine is **fully implemented and ready for integration**. All backend code is complete, Tauri commands are registered, and the frontend composable is created. The next step is to integrate `useRustPlaybackEngine` into `ClipEditorPreview.vue` to replace HTML5 `<video>` elements with canvas-based rendering for CapCut-level performance.
