# Video Editor Playback Optimization Plan

## Overview

This document outlines a comprehensive plan to improve video editor playback smoothness, eliminate lag during scrubbing, and fix glitches when switching between video segments or multiple sources. The plan is based on deep research into modern web video rendering technologies and best practices used by professional video editing software.

## Background / Context

### Current Issues

The video editor currently experiences:

1. **Playback lag after cuts** - When segments are cut, playback becomes choppy during transitions
2. **Scrubbing unresponsiveness** - Seeking through the timeline feels sluggish, especially after edits
3. **Multi-source glitches** - Adding more than one video source causes visual artifacts and synchronization issues
4. **Buffer delays** - Noticeable waiting time when switching between video segments

### Root Cause Analysis

The issues stem from fundamental limitations of the HTMLVideoElement for professional video editing:

1. **Keyframe-dependent seeking** - Browsers seek to the nearest keyframe then decode forward. If source videos have keyframes 5-10 seconds apart, every seek operation feels slow.

2. **Buffer requirements** - The current `VideoCompositor.vue` waits for 1 second of buffered data before marking a segment as ready (`MIN_BUFFER_AHEAD = 1.0`), causing perceptible delays.

3. **Video element swapping overhead** - The double-buffer A/B slot approach requires DOM operations and video element state management that adds latency.

4. **No frame-accurate seeking** - HTML5 video elements do not guarantee frame-accurate positioning, making precise edits difficult.

## Proposed Architecture

### Tiered Approach

The optimization plan follows a tiered implementation strategy, allowing incremental improvements:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         TIER 3: Advanced (Long-term)                     │
│  WebCodecs API + OffscreenCanvas + Web Workers                          │
│  - Frame-accurate decoding    - Pre-decoded frame buffer                │
│  - Worker-based processing    - Zero-copy GPU textures                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    ▲
┌─────────────────────────────────────────────────────────────────────────┐
│                      TIER 2: Architectural (Medium-term)                 │
│  Canvas-Based Preview Renderer + Thumbnail Scrubbing                    │
│  - WebGL video textures       - Sprite sheet generation                 │
│  - Single render surface      - Instant visual feedback                 │
└─────────────────────────────────────────────────────────────────────────┘
                                    ▲
┌─────────────────────────────────────────────────────────────────────────┐
│                        TIER 1: Quick Wins (Immediate)                    │
│  Proxy Videos + Buffer Tuning + requestVideoFrameCallback               │
│  - Low-res frequent-keyframe proxies                                    │
│  - Reduced buffer thresholds                                            │
│  - Frame-accurate callbacks                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

## Implementation Details

### Tier 1: Quick Wins (Immediate Impact)

#### 1.1 Proxy Video Generation

Generate low-resolution proxy videos with frequent keyframes during video import.

**FFmpeg Command:**
```bash
ffmpeg -i input.mp4 \
   -vf scale=-2:720 \
   -c:v libx264 -preset ultrafast -crf 28 \
   -g 30 -keyint_min 30 \
   -sc_threshold 0 \
   -c:a aac -b:a 128k \
   -movflags +faststart \
   output_proxy.mp4
```

**Key Parameters:**
| Parameter | Value | Purpose |
|-----------|-------|---------|
| `scale=-2:720` | 720p | Reduced resolution for faster decoding |
| `-g 30` | 30 frames | Keyframe every 1 second (at 30fps) |
| `-keyint_min 30` | 30 frames | Minimum keyframe interval |
| `-sc_threshold 0` | Disabled | No scene-change keyframes (consistent spacing) |
| `-preset ultrafast` | Fast | Prioritize encode speed over compression |
| `-crf 28` | Quality 28 | Acceptable quality for preview |
| `-movflags +faststart` | Enabled | Metadata at file start for instant playback |

**Implementation Location:** `client/src-tauri/` (Rust FFmpeg integration)

**Workflow:**
1. On video import, generate proxy in background
2. Store proxy path in database alongside original
3. Use proxy for preview playback
4. Use original for final export

#### 1.2 Buffer Threshold Reduction

Reduce the buffer requirement in `VideoCompositor.vue` for more responsive segment transitions.

**Current Code:**
```typescript
// client/src/components/clip-editor/VideoCompositor.vue
const MIN_BUFFER_AHEAD = 1.0; // 1 second - too conservative
```

**Proposed Change:**
```typescript
const MIN_BUFFER_AHEAD = 0.3; // 300ms - more responsive
const MIN_BUFFER_AHEAD_SCRUBBING = 0.1; // 100ms during active scrubbing
```

**Trade-off:** Occasional micro-stutters in exchange for much better responsiveness.

#### 1.3 requestVideoFrameCallback Integration

Replace `timeupdate` events with `requestVideoFrameCallback` for precise frame synchronization.

**Current Approach:** Polling via `timeupdate` events (fires ~4x per second)

**Proposed Approach:**
```typescript
function startFrameCallback(video: HTMLVideoElement) {
  function onFrame(now: DOMHighResTimeStamp, metadata: VideoFrameCallbackMetadata) {
    // metadata.mediaTime - exact presentation timestamp
    // metadata.presentedFrames - detect dropped frames
    
    // Sync timeline position
    updateTimelinePosition(metadata.mediaTime);
    
    // Sync overlays/subtitles
    updateOverlays(metadata.mediaTime);
    
    // Continue callback loop
    video.requestVideoFrameCallback(onFrame);
  }
  
  video.requestVideoFrameCallback(onFrame);
}
```

**Benefits:**
- Callbacks fire per actual frame presented
- Access to exact frame timestamps
- Detection of dropped frames for adaptive quality

### Tier 2: Architectural Improvements (Medium-term)

#### 2.1 Thumbnail Sprite Scrubbing

Generate thumbnail sprite sheets during import for instant visual feedback during scrubbing.

**Sprite Generation (FFmpeg):**
```bash
# Extract thumbnails every 1 second
ffmpeg -i input.mp4 -vf "fps=1,scale=160:90,tile=10x10" \
   -frames:v 1 thumbnails_%03d.jpg

# Generate WebVTT for thumbnail mapping
```

**WebVTT Format:**
```vtt
WEBVTT

00:00:00.000 --> 00:00:01.000
thumbnails_001.jpg#xywh=0,0,160,90

00:00:01.000 --> 00:00:02.000
thumbnails_001.jpg#xywh=160,0,160,90
```

**UI Integration:**
```typescript
// During scrubbing, show thumbnail instead of seeking video
function onScrub(time: number) {
  if (isDragging) {
    // Show thumbnail sprite (instant)
    showThumbnailAtTime(time);
  } else {
    // User released - now seek video
    video.currentTime = time;
  }
}
```

#### 2.2 Canvas-Based Preview Renderer

Replace multiple video elements with a single WebGL canvas renderer.

**Architecture:**
```
┌─────────────────────────────────────────────────────────────────┐
│                     WebGL Preview Renderer                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐           │
│  │  Texture 0  │   │  Texture 1  │   │  Texture N  │           │
│  │  (Source A) │   │  (Source B) │   │  (Source N) │           │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘           │
│         │                 │                 │                   │
│         └─────────────────┴─────────────────┘                   │
│                           │                                     │
│                    ┌──────▼──────┐                              │
│                    │   Shader    │ ← Compositing, transitions   │
│                    │   Program   │                              │
│                    └──────┬──────┘                              │
│                           │                                     │
│                    ┌──────▼──────┐                              │
│                    │   Canvas    │ ← Single render target       │
│                    │   Output    │                              │
│                    └─────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
```

**Key Benefits:**
- No DOM element swapping during segment transitions
- GPU-accelerated compositing and transitions
- Single render surface for all sources
- Consistent frame timing via requestAnimationFrame

**Implementation Sketch:**
```typescript
// WebGL video texture management
class VideoTextureManager {
  private gl: WebGL2RenderingContext;
  private textures: Map<string, WebGLTexture> = new Map();
  private videos: Map<string, HTMLVideoElement> = new Map();
  
  loadSource(sourceId: string, videoUrl: string) {
    const video = document.createElement('video');
    video.src = videoUrl;
    video.muted = true;
    
    const texture = this.gl.createTexture();
    this.textures.set(sourceId, texture);
    this.videos.set(sourceId, video);
  }
  
  updateTexture(sourceId: string) {
    const video = this.videos.get(sourceId);
    const texture = this.textures.get(sourceId);
    
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D, 0, this.gl.RGBA,
      this.gl.RGBA, this.gl.UNSIGNED_BYTE, video
    );
  }
  
  render(activeSourceId: string, time: number) {
    // Seek video to correct time
    const video = this.videos.get(activeSourceId);
    if (Math.abs(video.currentTime - time) > 0.05) {
      video.currentTime = time;
    }
    
    // Update texture from video frame
    this.updateTexture(activeSourceId);
    
    // Render to canvas via shader
    this.drawFrame(activeSourceId);
  }
}
```

### Tier 3: Advanced Implementation (Long-term)

#### 3.1 WebCodecs API Integration

Use WebCodecs for frame-accurate decoding with pre-decoded frame buffers.

**Architecture:**
```
┌──────────────────────────────────────────────────────────────────────┐
│                         Main Thread                                   │
│  - UI/Timeline controls                                              │
│  - Playback state management                                         │
│  - Canvas rendering                                                  │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ postMessage (timestamps, commands)
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         Decode Worker                                 │
│                                                                       │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐              │
│  │   Demuxer   │───▶│  Decoder    │───▶│   Frame     │              │
│  │  (MP4Box)   │    │ (WebCodecs) │    │   Buffer    │              │
│  └─────────────┘    └─────────────┘    └─────────────┘              │
│                                               │                       │
│                                               │ Sliding window        │
│                                               │ [-2s, +2s] from       │
│                                               │ playhead              │
│                                               ▼                       │
│                                        ┌─────────────┐               │
│                                        │ VideoFrame  │               │
│                                        │   Cache     │               │
│                                        └──────┬──────┘               │
└───────────────────────────────────────────────┼──────────────────────┘
                                                │ transferToMain
                                                ▼
                                         Canvas/WebGL Render
```

**Frame Buffer Strategy:**
```typescript
interface FrameBuffer {
  // Maintain decoded frames in a sliding window
  frames: Map<number, VideoFrame>; // timestamp -> frame
  
  // Buffer configuration
  bufferBefore: number; // seconds before playhead
  bufferAfter: number;  // seconds after playhead
  
  // Eviction policy
  maxFrames: number;
}

class FrameBufferManager {
  private buffer: FrameBuffer = {
    frames: new Map(),
    bufferBefore: 2.0,  // 2 seconds behind
    bufferAfter: 2.0,   // 2 seconds ahead
    maxFrames: 120,     // ~2 seconds at 60fps
  };
  
  getFrame(timestamp: number): VideoFrame | null {
    // Binary search for closest frame
    return this.findClosestFrame(timestamp);
  }
  
  updateBuffer(currentTime: number) {
    // Evict frames outside window
    this.evictOutOfRange(currentTime);
    
    // Request decoding for frames in window
    this.requestDecode(currentTime);
  }
}
```

**Demuxing with MP4Box.js:**
```typescript
import MP4Box from 'mp4box';

async function demuxVideo(file: File): Promise<EncodedVideoChunk[]> {
  const mp4box = MP4Box.createFile();
  const chunks: EncodedVideoChunk[] = [];
  
  mp4box.onReady = (info) => {
    const videoTrack = info.videoTracks[0];
    mp4box.setExtractionOptions(videoTrack.id, null, {
      nbSamples: 100
    });
    mp4box.start();
  };
  
  mp4box.onSamples = (id, user, samples) => {
    for (const sample of samples) {
      chunks.push(new EncodedVideoChunk({
        type: sample.is_sync ? 'key' : 'delta',
        timestamp: sample.cts * 1000000 / sample.timescale,
        duration: sample.duration * 1000000 / sample.timescale,
        data: sample.data
      }));
    }
  };
  
  // Feed file to demuxer
  const buffer = await file.arrayBuffer();
  buffer.fileStart = 0;
  mp4box.appendBuffer(buffer);
  mp4box.flush();
  
  return chunks;
}
```

#### 3.2 OffscreenCanvas + Web Worker Rendering

Move all rendering to a dedicated worker thread.

```typescript
// main.ts
const canvas = document.getElementById('preview') as HTMLCanvasElement;
const offscreen = canvas.transferControlToOffscreen();

const renderWorker = new Worker('render-worker.js');
renderWorker.postMessage({ type: 'init', canvas: offscreen }, [offscreen]);

// Send playback commands
renderWorker.postMessage({ type: 'seek', time: 5.5 });
renderWorker.postMessage({ type: 'play' });
```

```typescript
// render-worker.js
let canvas: OffscreenCanvas;
let ctx: OffscreenCanvasRenderingContext2D;
let frameBuffer: FrameBufferManager;

self.onmessage = async (e) => {
  switch (e.data.type) {
    case 'init':
      canvas = e.data.canvas;
      ctx = canvas.getContext('2d');
      frameBuffer = new FrameBufferManager();
      break;
      
    case 'seek':
      const frame = frameBuffer.getFrame(e.data.time);
      if (frame) {
        ctx.drawImage(frame, 0, 0);
      }
      break;
      
    case 'play':
      startPlaybackLoop();
      break;
  }
};

function startPlaybackLoop() {
  let lastTime = performance.now();
  
  function tick() {
    const now = performance.now();
    const delta = (now - lastTime) / 1000;
    lastTime = now;
    
    currentTime += delta * playbackRate;
    
    const frame = frameBuffer.getFrame(currentTime);
    if (frame) {
      ctx.drawImage(frame, 0, 0);
      frame.close(); // Important: release VideoFrame
    }
    
    frameBuffer.updateBuffer(currentTime);
    
    if (isPlaying) {
      requestAnimationFrame(tick);
    }
  }
  
  requestAnimationFrame(tick);
}
```

## Key Decisions

### Decision 1: Proxy Workflow vs Real-time Transcoding

**Chosen:** Pre-generated proxy files during import

**Rationale:**
- One-time cost at import vs continuous processing during editing
- Predictable performance regardless of source complexity
- Industry standard approach (Premiere, Resolve, Final Cut all use proxies)
- Works offline after initial generation

### Decision 2: Canvas Rendering vs Video Element Swapping

**Chosen:** WebGL canvas with video textures (Tier 2)

**Rationale:**
- Single render surface eliminates DOM swapping overhead
- GPU compositing is faster than CPU-based element manipulation
- Enables smooth transitions without JavaScript orchestration
- Future-proof for WebCodecs integration

### Decision 3: Buffer Strategy

**Chosen:** Aggressive pre-buffering with sliding window

**Rationale:**
- Memory-bounded (max frames limit)
- Predictable seeking in both directions
- Graceful degradation when buffer misses

## Testing / Verification

### Performance Benchmarks

| Metric | Current | Target (Tier 1) | Target (Tier 3) |
|--------|---------|-----------------|-----------------|
| Seek latency | 500-1000ms | <200ms | <50ms |
| Segment transition | 300-500ms | <100ms | <16ms (1 frame) |
| Scrub responsiveness | Laggy | Smooth thumbnails | Frame-accurate |
| Multi-source playback | Glitchy | Stable | Seamless |

### Test Scenarios

1. **Rapid scrubbing test**: Scrub back and forth rapidly for 10 seconds
   - Expected: Smooth thumbnail display, no freezing

2. **Segment transition test**: Play through 5+ cuts without pausing
   - Expected: No visual glitches or audio pops

3. **Multi-source test**: Timeline with 3+ different video sources
   - Expected: Clean transitions between all sources

4. **Long video test**: 1-hour video with 50+ cuts
   - Expected: Consistent performance throughout

### Browser Compatibility Matrix

| Feature | Chrome | Firefox | Safari | WebView2 | WKWebView | WebKitGTK |
|---------|--------|---------|--------|----------|-----------|-----------|
| Proxy playback | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| requestVideoFrameCallback | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| WebGL video textures | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebCodecs | ✅ | ✅ | ✅ (16.4+) | ✅ | ✅ | ⚠️ |
| OffscreenCanvas in Worker | ✅ | ✅ | ✅ (16.2+) | ✅ | ✅ | ⚠️ |

## Implementation Priority

| Phase | Task | Impact | Effort | Dependencies |
|-------|------|--------|--------|--------------|
| 1.1 | Proxy video generation | High | Low | FFmpeg integration |
| 1.2 | Reduce buffer threshold | Medium | Trivial | None |
| 1.3 | requestVideoFrameCallback | Medium | Low | None |
| 2.1 | Thumbnail sprite generation | High | Medium | FFmpeg integration |
| 2.2 | Thumbnail scrubbing UI | High | Medium | 2.1 |
| 2.3 | WebGL preview renderer | High | High | None |
| 3.1 | WebCodecs demuxer | Medium | High | MP4Box.js |
| 3.2 | Frame buffer manager | High | High | 3.1 |
| 3.3 | Worker-based rendering | Medium | High | 2.3, 3.2 |

## Future Considerations

### Potential Enhancements

1. **Adaptive quality switching** - Lower preview resolution during scrubbing, increase when paused
2. **GPU-accelerated effects** - WebGPU for real-time color grading and filters
3. **Predictive buffering** - ML-based prediction of user seek patterns
4. **Collaborative editing** - Multi-user timeline with conflict resolution

### Known Limitations

1. **WebCodecs browser support** - Safari 16.4+ required, Linux WebKitGTK may have issues
2. **Memory constraints** - Frame buffers can consume significant RAM for 4K content
3. **Source video encoding** - Performance depends on source keyframe density
4. **Hardware acceleration** - Varies by platform and GPU driver support

## References

### External Resources

- [MDN WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API)
- [Chrome WebCodecs Best Practices](https://developer.chrome.com/docs/web-platform/best-practices/webcodecs)
- [web.dev requestVideoFrameCallback](https://web.dev/articles/requestvideoframecallback-rvfc)
- [MP4Box.js Documentation](https://gpac.github.io/mp4box.js/)
- [W3C WebCodecs Samples](https://w3c.github.io/webcodecs/samples/)

### Internal References

- `client/src/components/clip-editor/VideoCompositor.vue` - Current double-buffer implementation
- `client/src/composables/usePlaybackEngine.ts` - Playback state management
- `client/src/composables/useTimelineRenderer.ts` - Timeline query functions
- `client/src/components/clip-editor/ClipEditorPreview.vue` - Preview rendering

### Research Sources

- Upuply Web Video Editor Architecture Guide
- Mux Video Playback Best Practices 2025
- Remotion v4 Architecture Documentation
- JavaScript Video Processing Analysis Benchmarks
