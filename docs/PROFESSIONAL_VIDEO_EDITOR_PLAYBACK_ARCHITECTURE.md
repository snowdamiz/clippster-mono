# Research Report: Professional Video Editor Multi-Source Playback Architecture

**Research Date**: January 29, 2026  
**Sources Consulted**: 14 web sources + technical documentation

---

## Executive Summary

After extensive research into how professional video editors handle seamless multi-source playback, I've identified **three viable architectural approaches** that eliminate black screens and lag during source transitions. The key insight is that **no professional editor relies on a single HTML5 `<video>` element switching sources**—they all use frame-level control with buffering strategies.

The most viable solution for your Tauri application is **Option 3: Hybrid Rust Frame Decoder + Canvas Rendering**, which leverages your existing desktop architecture while avoiding the limitations of web-only approaches.

---

## Key Findings

### 1. How Professional Desktop Editors Handle Multi-Source Playback

**DaVinci Resolve's Strategy:**
- **Proxy Media System**: Creates lower-resolution versions of all sources upfront
- **Optimized Media Cache**: Converts to DNxHR/ProRes for instant access
- **Smart Cache**: Pre-renders complex sections into a unified cache
- **Performance Mode**: Reduces UI updates to prioritize playback
- **Key Principle**: Never loads raw source files during playback—always uses pre-processed cache

**Adobe Premiere Pro's Mercury Playback Engine:**
- **GPU Acceleration**: Offloads decoding/rendering to GPU via CUDA/Metal
- **Multi-threaded Processing**: CPU handles demuxing, GPU handles decoding
- **Frame Buffer Pool**: Maintains decoded frames in GPU memory
- **Predictive Buffering**: Pre-decodes frames ahead of playhead
- **Key Principle**: Hardware-accelerated frame-by-frame rendering, not video element switching

**Common Pattern Across Professional Editors:**
1. **Decode frames independently** from each source
2. **Cache decoded frames** in memory (RAM or GPU)
3. **Composite frames** on a timeline canvas
4. **Never switch video sources**—just switch which frames are rendered

---

### 2. Web-Based Video Editor Solutions

**Descript's Approach (Most Relevant):**

Descript is an Electron app (like Tauri) that solved this exact problem:

**Before WebCodecs (Their Old Approach):**
- Used native FFmpeg bindings (Beamcoder) in Electron
- Decoded frames and copied to WebGL textures
- **Problem**: Two extra memory copies limited them to 720p playback
- **Problem**: Slow 4K exports due to CPU bottleneck

**After WebCodecs (Their Current Approach):**
- **WebCodecs API**: Zero-copy interface between hardware decoders and WebGL/WebGPU
- **Hardware Acceleration**: Uses h.264/HEVC/VP8/VP9 hardware decoders
- **libav.js (WebAssembly)**: FFmpeg port for demuxing containers
- **Result**: 2-3x faster 4K exports, seamless multi-layer playback
- **Key Quote**: "A single frame of decoded 4K video takes 33 MB of memory, and at 30 frames per second, that's nearly 1GB per second. With WebCodecs we can decode the frames, composite and process them, and encode to a final file all within GPU—much faster!"

**Their Architecture:**
```
Source Files → libav.js (demux) → WebCodecs (decode) → WebGL (composite) → Canvas (render)
```

**Limitations for You:**
- WebCodecs browser support varies (not all browsers support audio yet)
- Requires web-based architecture (works in Tauri's webview)
- Still has some CORS complexity with MediaSource

---

### 3. Media Source Extensions (MSE) Approach

**What MSE Provides:**
- Programmatic control over `<video>` element buffering
- Ability to append multiple video segments seamlessly
- Originally designed for adaptive streaming (DASH/HLS)
- Can achieve **gapless playback** between segments

**How It Works:**
```javascript
const mediaSource = new MediaSource();
video.src = URL.createObjectURL(mediaSource);

mediaSource.addEventListener('sourceopen', () => {
  const sourceBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E"');
  
  // Append first segment
  sourceBuffer.appendBuffer(segment1Data);
  
  // When ready, append next segment
  sourceBuffer.addEventListener('updateend', () => {
    sourceBuffer.appendBuffer(segment2Data);
  });
});
```

**Advantages:**
- No black screens between segments
- Browser handles decoding/buffering
- Works with existing video files

**Limitations:**
- Requires **fragmented MP4** or similar container format
- Cannot use arbitrary video files—must be properly segmented
- Complex to implement for timeline editing (designed for streaming)
- Still limited by single video element constraints
- Audio sync complexity across multiple sources

**Verdict**: Not ideal for a timeline editor with arbitrary source files

---

### 4. WebCodecs API (Modern Web Approach)

**What WebCodecs Provides:**
- Direct access to browser's hardware video decoders
- Frame-by-frame control over video playback
- Zero-copy rendering to WebGL/Canvas
- Asynchronous processing model

**Architecture:**
```
Video File → Demuxer (libav.js) → VideoDecoder (WebCodecs) → VideoFrame → Canvas/WebGL
```

**Advantages:**
- Hardware-accelerated decoding
- Frame-accurate control
- Can composite multiple sources simultaneously
- No black screens—you control every frame
- Works in Tauri's webview (Chromium-based)

**Limitations:**
- Requires demuxing (need libav.js or similar)
- Complex implementation
- Browser support (Chrome/Edge good, Firefox/Safari limited)
- Audio requires separate handling (Web Audio API)

**Verdict**: Viable for Tauri, but complex

---

### 5. Rust FFmpeg Frame Decoder (Desktop Approach)

**What This Provides:**
- Native FFmpeg bindings in Rust
- Direct hardware decoder access (NVDEC, VAAPI, VideoToolbox)
- Frame extraction at specific timestamps
- Full control over decoding pipeline

**Architecture:**
```
Rust Backend:
Video File → FFmpeg Decoder → Raw Frame Data → Tauri Command → Frontend

Frontend:
Frame Data → Canvas ImageData → Canvas Rendering
```

**Advantages:**
- **No CORS issues** (native file access)
- **Hardware acceleration** via FFmpeg's hwaccel
- **Frame-accurate seeking**
- **Works with any video format** FFmpeg supports
- **Can decode multiple sources in parallel**
- **Full control** over buffering/caching

**Implementation Pattern (from research):**
```rust
use ffmpeg_next as ffmpeg;

// Decode frame at specific timestamp
fn get_frame_at_time(video_path: &str, timestamp: f64) -> Result<Vec<u8>> {
    let mut decoder = ffmpeg::format::input(&video_path)?;
    let video_stream = decoder.streams().best(ffmpeg::media::Type::Video)?;
    
    // Seek to timestamp
    decoder.seek(timestamp as i64, ..)?;
    
    // Decode frame
    let mut decoder = video_stream.codec().decoder().video()?;
    // ... decode and return RGB data
}
```

**Verdict**: **Best option for Tauri desktop app**

---

## Viable Architecture Solutions (Ranked)

### **Option 1: Dual Video Element Approach** ❌ Not Recommended

**How It Works:**
- Use two `<video>` elements
- Preload next source in hidden element
- Crossfade between elements during transitions

**Why It Fails:**
- Still has loading delay for new sources
- Doubles memory usage
- Complex audio synchronization
- Doesn't scale beyond 2 sources
- **Black screen still possible** if preload fails

**Verdict**: Band-aid solution, not professional-grade

---

### **Option 2: WebCodecs + libav.js (Web-First Approach)** ⚠️ Viable but Complex

**Architecture:**
```
Frontend (Browser):
├── libav.js (WASM) - Demux video containers
├── WebCodecs API - Hardware decode frames
├── Canvas 2D/WebGL - Composite frames
├── Web Audio API - Mix audio tracks
└── RequestAnimationFrame - Render loop (60fps)
```

**Implementation Strategy:**
1. **Demux all source files** using libav.js to extract video/audio packets
2. **Create VideoDecoder instances** for each source (WebCodecs)
3. **Maintain frame buffer** (30-60 frames ahead)
4. **RAF render loop** composites current frame to canvas
5. **Predictive prefetch** decodes frames 2 seconds ahead
6. **Audio mixer** handles separate audio tracks

**Advantages:**
- ✅ Zero black screens (you control every frame)
- ✅ Hardware-accelerated decoding
- ✅ Works in Tauri webview
- ✅ Can handle unlimited sources

**Challenges:**
- ❌ Complex implementation (~2000+ lines)
- ❌ Need to bundle libav.js (WASM, ~2MB)
- ❌ Audio sync complexity
- ❌ Browser compatibility (Chrome/Edge only)
- ❌ Memory management for frame buffers

**Code Complexity**: High  
**Performance**: Excellent  
**Reliability**: Good (browser-dependent)

---

### **Option 3: Rust FFmpeg Frame Decoder + Canvas Rendering** ✅ **RECOMMENDED**

**Architecture:**
```
Rust Backend (Tauri):
├── FFmpeg Decoder Pool - One decoder per source file
├── Frame Cache (LRU) - 200 frames (~6-7 seconds at 30fps)
├── Hardware Acceleration - NVDEC/VAAPI/VideoToolbox
└── Tauri Commands - get_frame, prefetch_frames

Frontend (Vue):
├── Canvas Renderer - Display current frame
├── RAF Loop - 60fps render cycle
├── Frame Fetcher - Request frames from Rust
├── Predictive Prefetch - 2 seconds ahead
└── Audio Mixer - Web Audio API for audio tracks
```

**Implementation Strategy:**

**Phase 1: Rust Frame Decoder**
```rust
// Tauri command to get frame at specific time from specific source
#[tauri::command]
async fn get_video_frame(
    source_id: String,
    timestamp: f64,
    state: State<'_, VideoDecoderPool>
) -> Result<Vec<u8>, String> {
    // Get or create decoder for this source
    let decoder = state.get_decoder(&source_id)?;
    
    // Decode frame at timestamp (with keyframe seeking)
    let frame = decoder.decode_frame_at(timestamp)?;
    
    // Convert to RGB24
    let rgb_data = frame.to_rgb()?;
    
    Ok(rgb_data)
}

#[tauri::command]
async fn prefetch_frames(
    source_id: String,
    start_time: f64,
    count: usize,
    state: State<'_, VideoDecoderPool>
) -> Result<(), String> {
    // Prefetch frames into cache
    let decoder = state.get_decoder(&source_id)?;
    decoder.prefetch_range(start_time, count)?;
    Ok(())
}
```

**Phase 2: Frontend Canvas Engine**
```typescript
class VideoPlaybackEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private frameCache: Map<string, ImageData> = new Map();
  private rafId: number | null = null;
  
  async renderFrame(sourceId: string, timestamp: number) {
    const cacheKey = `${sourceId}:${timestamp.toFixed(3)}`;
    
    // Check cache first
    let frameData = this.frameCache.get(cacheKey);
    
    if (!frameData) {
      // Fetch from Rust
      const rgbData = await invoke('get_video_frame', {
        sourceId,
        timestamp
      });
      
      // Convert RGB to RGBA and create ImageData
      frameData = this.rgbToImageData(rgbData);
      this.frameCache.set(cacheKey, frameData);
    }
    
    // Render to canvas
    this.ctx.putImageData(frameData, 0, 0);
  }
  
  startPlayback() {
    const render = () => {
      const currentTime = this.getCurrentTimelineTime();
      const activeSource = this.findSourceAtTime(currentTime);
      
      if (activeSource) {
        const sourceTime = this.getSourceTime(currentTime, activeSource);
        this.renderFrame(activeSource.id, sourceTime);
        
        // Prefetch ahead
        this.prefetchFrames(activeSource.id, sourceTime + 2.0);
      }
      
      this.rafId = requestAnimationFrame(render);
    };
    
    render();
  }
}
```

**Advantages:**
- ✅ **Zero black screens** (frame-level control)
- ✅ **No CORS issues** (native file access)
- ✅ **Hardware acceleration** (FFmpeg hwaccel)
- ✅ **Works with any format** (FFmpeg supports everything)
- ✅ **Parallel decoding** (multiple sources simultaneously)
- ✅ **Simple audio** (video element audio works, or extract separately)
- ✅ **Tauri-native** (leverages desktop capabilities)
- ✅ **Frame-accurate** (precise seeking)

**Challenges:**
- ⚠️ Need to implement frame cache in Rust
- ⚠️ Need to handle RGB → RGBA conversion
- ⚠️ Memory management for cache

**Code Complexity**: Medium  
**Performance**: Excellent  
**Reliability**: Excellent

---

## Recommended Solution: Hybrid Approach

**Best Architecture for Your Tauri App:**

```
┌─────────────────────────────────────────────────────────┐
│                    RUST BACKEND                         │
├─────────────────────────────────────────────────────────┤
│  FFmpeg Decoder Pool                                    │
│  ├── Decoder 1 (Source A) ─┐                           │
│  ├── Decoder 2 (Source B) ─┼─→ Frame Cache (LRU)       │
│  └── Decoder 3 (Source C) ─┘    └→ 200 frames          │
│                                                          │
│  Tauri Commands:                                        │
│  ├── get_frame(source_id, timestamp) → RGB bytes       │
│  ├── prefetch_frames(source_id, start, count)          │
│  └── get_frame_cache_stats() → cache info              │
└─────────────────────────────────────────────────────────┘
                          ↓ IPC
┌─────────────────────────────────────────────────────────┐
│                   VUE FRONTEND                          │
├─────────────────────────────────────────────────────────┤
│  Canvas Playback Engine                                 │
│  ├── RAF Loop (60fps)                                   │
│  ├── Frame Cache (30 frames)                            │
│  ├── Predictive Prefetch (2s ahead)                     │
│  └── Timeline State Manager                             │
│                                                          │
│  Audio Mixer (Web Audio API)                            │
│  └── Separate audio tracks (existing system)            │
│                                                          │
│  Canvas Renderer                                        │
│  └── Displays current frame + overlays                  │
└─────────────────────────────────────────────────────────┘
```

**Why This Works:**

1. **No Source Switching**: Never change video `src`—just render different frames
2. **Seamless Transitions**: Frame N from Source A → Frame N+1 from Source B (no gap)
3. **Hardware Accelerated**: FFmpeg uses GPU decoders (NVDEC, VAAPI, etc.)
4. **Predictive Buffering**: Always 2 seconds of frames cached ahead
5. **Frame-Accurate**: Seek to exact frame, not approximate time
6. **Scales to Hundreds of Sources**: Each source gets its own decoder
7. **No Web Limitations**: Native file access, no CORS, no browser quirks

---

## Implementation Roadmap

**Phase 1: Rust Frame Decoder (1-2 weeks)**
- Set up FFmpeg bindings (`ffmpeg-next` crate)
- Implement frame decoder with timestamp seeking
- Add hardware acceleration support
- Create LRU frame cache
- Expose Tauri commands

**Phase 2: Frontend Canvas Engine (1 week)**
- Create canvas-based renderer
- Implement RAF playback loop
- Add frame fetching from Rust
- Implement frontend frame cache
- Add predictive prefetch logic

**Phase 3: Integration (1 week)**
- Replace video element with canvas
- Integrate with existing timeline
- Handle source transitions
- Test with multiple sources
- Performance optimization

**Phase 4: Audio (1 week)**
- Keep existing Web Audio mixer for audio tracks
- Option: Extract audio from video sources separately
- Sync audio with canvas frames

**Total Estimated Time**: 4-6 weeks for complete implementation

---

## Conclusion

The **Rust FFmpeg Frame Decoder + Canvas Rendering** approach is the only professional-grade solution that:
- Eliminates black screens completely
- Scales to unlimited sources
- Leverages your Tauri desktop architecture
- Provides frame-accurate control
- Uses hardware acceleration

This is exactly how professional editors work—they decode frames independently and composite them, rather than switching between video elements. Your current HTML5 `<video>` element approach is fundamentally incompatible with seamless multi-source playback.

---

## Sources

1. [Descript Speed & Performance: Faster 4K Exports in 2025](https://www.descript.com/blog/article/the-new-descript-how-we-multiplied-the-apps-speed-and-performance) - WebCodecs implementation details
2. [WebCodecs API - Web APIs | MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API) - API documentation
3. [Media Source Extensions for Audio | web.dev](https://web.dev/mse-seamless-playback/) - MSE gapless playback
4. [How to Speed up Playback in Davinci Resolve](https://www.hollyland.com/blog/tips/speed-up-playback-in-davinci-resolve) - Professional editor caching strategies
5. [Real-time video processing with Rust, FFmpeg and OpenCV](https://subvisual.com/blog/posts/real-time-video-processing-with-rust-ffmpeg-opencv/) - Rust FFmpeg patterns
6. [Mercury Playback Engine (GPU Accelerated) in Premiere](https://helpx.adobe.com/premiere/desktop/get-started/download-and-install/mercury-playback-engine-gpu-accelerated-in-premiere-pro.html) - Adobe's approach
7. [Final Cut Pro magnetic timeline](https://www.motionvfx.com/know-how/final-cut-pro-magnetic-timeline/) - Apple's timeline architecture
8. [CapCut vs Clipchamp comparison](https://www.capcut.com/resource/clipchamp-vs-capcut) - Web-based editor approaches
9. [WebCodecs Video Scroll Synchronization](https://lionkeng.medium.com/a-tutorial-webcodecs-video-scroll-synchronization-8b251e1a1708) - WebCodecs tutorial
10. [Video frame buffering strategies](https://www.wowza.com/blog/video-playback-simple-solutions-for-stream-buffering) - Buffer management
11. [Canvas vs WebGL performance](https://demyanov.dev/past-and-future-html-canvas-brief-overview-2d-webgl-and-webgpu) - Rendering performance
12. [FFmpeg frame extraction](https://shotstack.io/learn/ffmpeg-extract-frames/) - Frame extraction techniques
13. [Tauri 2.0 Architecture](https://v2.tauri.app/concept/architecture/) - Tauri capabilities
14. [Electron video editor examples](https://github.com/jestrux/simple-video-editor) - Desktop video editor patterns
