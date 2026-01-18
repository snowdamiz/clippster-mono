# Video Editor Playback Engine V3 - Implementation Plan

**Status:** Planning  
**Target:** CapCut/DaVinci Resolve-level smoothness  
**Timeline:** 12 days (2.5 weeks)  
**Last Updated:** January 17, 2026

---

## Executive Summary

This plan addresses critical performance issues in the video editor playback system while **preserving preview-export parity**. The approach focuses on fixing video playback timing and loading performance without changing the existing DOM-based overlay rendering system.

### Key Insight

**Playback performance is separate from rendering correctness.** We can fix video timing/loading issues without touching the overlay system that ensures preview matches export.

---

## Current Problems

### 1. Reactive Overhead & Synchronization Hell
- Multiple competing time sources (RAF loop, video element, sync layer)
- Every frame triggers cascading sync calls
- Vue reactivity watchers fighting each other
- Constant seeking creates feedback loop

### 2. Buffering Strategy Issues
- Waiting for 1 second of buffer before segment ready
- 3-second timeout means always hitting timeout
- No adaptive buffering
- HTTP streaming doesn't guarantee instant buffering

### 3. Double-Buffering Without State Machine
- No clear state transitions (LOADING → BUFFERING → READY → ACTIVE)
- Race conditions between preloading and swapping
- Partial buffer states not tracked properly

### 4. Seek Performance
- Every playhead drag triggers multiple seeks per frame
- No debouncing
- Full video element seeks (expensive)
- Buffer invalidation on every seek

### 5. No Frame-Perfect Timing
- RAF drives time, video follows (backwards!)
- Constant drift correction
- Jittery playhead movement

---

## Architecture: Separation of Concerns

```
┌──────────────────────────────────────────────────────┐
│  VIDEO LAYER (What we're fixing)                     │
│  ┌────────────────────────────────────────────────┐  │
│  │ Video Playback Engine                          │  │
│  │ - Smooth segment loading                       │  │
│  │ - Frame-accurate timing                        │  │
│  │ - Optimized scrubbing                          │  │
│  │ - No sync loops                                │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
                         ↓ currentTime
┌──────────────────────────────────────────────────────┐
│  OVERLAY LAYER (Keep as-is - already works!)        │
│  ┌────────────────────────────────────────────────┐  │
│  │ TrackRenderer Components                       │  │
│  │ - Text overlays with keyframes ✓               │  │
│  │ - Stickers with animations ✓                   │  │
│  │ - Watermarks with positioning ✓                │  │
│  │ - Effects (CSS filters) ✓                      │  │
│  │ - Subtitles ✓                                  │  │
│  │ - Transitions (opacity keyframes) ✓            │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

### Why This Preserves Preview-Export Parity

The existing `TrackRenderer` system already ensures parity:

- **Text overlays** - Same positioning as FFmpeg `drawtext` filter
- **Stickers** - Same scale/rotation as FFmpeg `overlay` filter  
- **Watermarks** - Same positioning as FFmpeg `overlay` filter
- **Effects** - CSS `backdrop-filter` approximates FFmpeg color filters
- **Transitions** - Opacity keyframes match FFmpeg crossfade

**What changes:** Video timing, loading, scrubbing (performance only)  
**What stays:** TrackRenderer, overlay positioning, effect rendering, export pipeline

---

## Phase 1: Video-Driven Clock (Days 1-2)

### Problem
RAF loop advances time independently, causing constant sync battles with video element.

### Solution
Let video element be the master clock.

### Implementation

**File:** `client/src/composables/usePlaybackEngine.ts`

#### Remove RAF-Based Timing
```typescript
// REMOVE: tick() function
// REMOVE: currentTime advancement logic
// REMOVE: requestAnimationFrame loop
```

#### Add Video-Driven Time Source
```typescript
export function usePlaybackEngine(options: PlaybackEngineOptions & {
  videoElement: Ref<HTMLVideoElement | null>
}) {
  const currentTime = ref(0);
  const isPlaying = ref(false);
  
  // Listen to video element for time updates
  watch(() => options.videoElement.value, (video) => {
    if (!video) return;
    
    // Video drives time - no more RAF advancement
    const onTimeUpdate = () => {
      currentTime.value = video.currentTime;
      options.onTimeUpdate?.(video.currentTime);
    };
    
    const onPlay = () => {
      isPlaying.value = true;
      options.onPlayStateChange?.(true);
    };
    
    const onPause = () => {
      isPlaying.value = false;
      options.onPlayStateChange?.(false);
    };
    
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    
    // Cleanup
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  });
  
  // Controls just proxy to video element
  function play() {
    options.videoElement.value?.play();
  }
  
  function pause() {
    options.videoElement.value?.pause();
  }
  
  function seek(time: number) {
    if (options.videoElement.value) {
      options.videoElement.value.currentTime = time;
    }
  }
  
  return {
    currentTime,
    isPlaying,
    play,
    pause,
    seek,
    // ... other methods
  };
}
```

### Benefits
- ✅ No more sync drift
- ✅ No more constant seeking
- ✅ Video plays naturally
- ✅ Overlays just read `currentTime` (no changes needed)

### Testing
- Verify playhead moves smoothly during playback
- Verify overlays stay in sync with video
- Verify no console warnings about drift

---

## Phase 2: Optimized Segment Loading (Days 3-4)

### Problem
VideoCompositor waits for 1s buffer, hits 3s timeout, causes lag.

### Solution
Smarter preloading and reduced buffer requirements.

### Implementation

#### 2.1 Reduce Buffer Requirements

**File:** `client/src/components/clip-editor/VideoCompositor.vue`

```typescript
// CHANGE: Line ~253
const MIN_BUFFER_AHEAD = 0.3; // Was 1.0 - 300ms is plenty for smooth playback

// CHANGE: Line ~354-361 (timeout in seekAndBuffer)
setTimeout(() => {
  if (!resolved) {
    const bufferedAhead = getBufferedAhead(video);
    console.warn(`[VideoCompositor] Buffer timeout - only ${bufferedAhead.toFixed(2)}s buffered, readyState=${video.readyState}`);
    finish();
  }
}, 1000); // Was 3000 - reduce timeout to 1 second
```

#### 2.2 Predictive Preloading

**File:** `client/src/composables/useEditorPlayback.ts`

```typescript
// CHANGE: Line ~182 (PRELOAD_THRESHOLD)
const PRELOAD_THRESHOLD = 5.0; // Was 2.0 - start loading next segment 5s early

// ADD: Preload on idle (when user pauses)
watch(() => engine.isPlaying.value, (playing) => {
  if (!playing && nextSource.value) {
    // User paused - perfect time to preload next segment
    console.log('[useEditorPlayback] Preloading next segment during pause');
    // Trigger preload via VideoCompositor
  }
});
```

#### 2.3 Remove Redundant Sync Checks

**File:** `client/src/composables/useEditorPlayback.ts`

```typescript
// REMOVE: Lines ~283-326 (syncVideoToTimeline function)
// REMOVE: Lines ~142-144 (onTimeUpdate callback that calls syncVideoToTimeline)
// REMOVE: All drift checking logic

// Video element IS the timeline now - no syncing needed
// Audio sync can stay (it's necessary)
```

**File:** `client/src/components/clip-editor/VideoCompositor.vue`

```typescript
// REMOVE: Lines ~662-678 (throttled sync watcher)
// This watcher constantly seeks the video - not needed anymore
```

### Benefits
- ✅ Faster segment transitions (300ms buffer vs 1s)
- ✅ Earlier preloading (5s vs 2s)
- ✅ No wasted CPU on sync checks
- ✅ Smoother playback during transitions

### Testing
- Play through multiple segments, verify smooth transitions
- Monitor console for buffer warnings
- Verify preloading happens before segment boundary

---

## Phase 3: Scrubbing Optimization (Days 5-6)

### Problem
Every mousemove during scrub triggers seek, causing lag.

### Solution
Debounce seeks, show thumbnails during drag.

### Implementation

#### 3.1 Debounced Scrubbing

**File:** `client/src/components/clip-editor/ClipEditorTimeline.vue`

```typescript
// ADD: Scrubbing state
const isScrubbing = ref(false);
const scrubTargetTime = ref(0);
const scrubThumbnail = ref<string | null>(null);
const showScrubPreview = ref(false);

// MODIFY: onPlayheadMouseDown (around line ~2500)
function onPlayheadMouseDown(e: MouseEvent) {
  isScrubbing.value = true;
  playback.pause(); // Pause immediately
  
  // Show thumbnail overlay
  showScrubPreview.value = true;
  
  // Existing drag setup code...
}

// MODIFY: onPlayheadDrag (around line ~2520)
function onPlayheadDrag(e: MouseEvent) {
  if (!isScrubbing.value) return;
  
  const time = pixelToTime(e.clientX);
  scrubTargetTime.value = time;
  
  // Update playhead position visually (instant)
  playheadPosition.value = timeToPixel(time);
  
  // Update time display
  emit('timeUpdate', time);
  
  // Load thumbnail for this time (async, cached)
  loadThumbnailAtTime(time).then(url => {
    scrubThumbnail.value = url;
  });
  
  // DON'T seek video here - too expensive!
  // Video will seek only on mouseup
}

// MODIFY: onPlayheadMouseUp (around line ~2540)
function onPlayheadMouseUp(e: MouseEvent) {
  if (!isScrubbing.value) return;
  
  isScrubbing.value = false;
  showScrubPreview.value = false;
  
  // Single seek to final position
  playback.seek(scrubTargetTime.value);
  
  // Existing cleanup code...
}
```

#### 3.2 Thumbnail Preview Overlay

**File:** `client/src/components/clip-editor/ClipEditorTimeline.vue` (template)

```vue
<!-- ADD: Thumbnail preview overlay -->
<div
  v-if="showScrubPreview && scrubThumbnail"
  class="absolute z-50 pointer-events-none"
  :style="{
    left: `${playheadPosition}px`,
    top: '-120px',
    transform: 'translateX(-50%)',
  }"
>
  <div class="bg-black/90 rounded-lg border border-white/20 overflow-hidden shadow-xl">
    <img
      :src="scrubThumbnail"
      class="w-40 h-auto"
      alt="Preview"
    />
    <div class="px-2 py-1 text-xs text-white/90 text-center font-mono">
      {{ formatTime(scrubTargetTime) }}
    </div>
  </div>
</div>
```

#### 3.3 Thumbnail Generation & Caching

**File:** `client/src/components/clip-editor/ClipEditorTimeline.vue`

```typescript
// ADD: Thumbnail cache
const thumbnailCache = new Map<string, string>();

// ADD: Thumbnail loading function
async function loadThumbnailAtTime(time: number): Promise<string> {
  // Find segment at this time
  const segment = videoSources.value.find(
    s => time >= s.start_time && time < s.end_time
  );
  
  if (!segment) return '';
  
  // Calculate time within source file
  const sourceTime = segment.trim_start + (time - segment.start_time);
  
  // Cache key (round to nearest second for better cache hits)
  const cacheKey = `${segment.id}-${Math.floor(sourceTime)}`;
  
  if (thumbnailCache.has(cacheKey)) {
    return thumbnailCache.get(cacheKey)!;
  }
  
  // Request thumbnail from server
  const encodedPath = btoa(unescape(encodeURIComponent(segment.source_path)));
  const url = `http://localhost:${videoServerPort.value}/video/${encodedPath}/thumbnail?time=${sourceTime}`;
  
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    
    thumbnailCache.set(cacheKey, objectUrl);
    return objectUrl;
  } catch (error) {
    console.warn('[Timeline] Failed to load thumbnail:', error);
    return '';
  }
}

// ADD: Cleanup on unmount
onUnmounted(() => {
  // Revoke all thumbnail object URLs
  for (const url of thumbnailCache.values()) {
    URL.revokeObjectURL(url);
  }
  thumbnailCache.clear();
});
```

#### 3.4 Server-Side Thumbnail Endpoint

**File:** `server/lib/video-server.ts` (or Rust equivalent)

```typescript
// ADD: Thumbnail extraction endpoint
app.get('/video/:encodedPath/thumbnail', async (req, res) => {
  const { time } = req.query;
  const filePath = decodeBase64Path(req.params.encodedPath);
  
  if (!time) {
    return res.status(400).send('Missing time parameter');
  }
  
  try {
    // Use FFmpeg to extract single frame
    const thumbnailBuffer = await extractFrameAtTime(filePath, parseFloat(time));
    
    res.type('image/jpeg');
    res.send(thumbnailBuffer);
  } catch (error) {
    console.error('[VideoServer] Thumbnail extraction failed:', error);
    res.status(500).send('Thumbnail extraction failed');
  }
});

// ADD: FFmpeg frame extraction helper
async function extractFrameAtTime(filePath: string, time: number): Promise<Buffer> {
  const { spawn } = require('child_process');
  
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    
    const ffmpeg = spawn('ffmpeg', [
      '-ss', time.toString(),
      '-i', filePath,
      '-vframes', '1',
      '-vf', 'scale=160:-1', // 160px width, maintain aspect ratio
      '-f', 'image2pipe',
      '-vcodec', 'mjpeg',
      'pipe:1'
    ]);
    
    ffmpeg.stdout.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    
    ffmpeg.on('close', (code: number) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });
    
    ffmpeg.on('error', reject);
  });
}
```

### Benefits
- ✅ Smooth scrubbing at 60fps (no video seeks during drag)
- ✅ Visual feedback via thumbnails
- ✅ Single seek on mouseup (much faster)
- ✅ Better UX (matches professional editors)

### Testing
- Drag playhead rapidly across timeline
- Verify thumbnails appear during drag
- Verify video only seeks on mouseup
- Verify scrubbing feels smooth

---

## Phase 4: Reactive Overhead Reduction (Days 7-8)

### Problem
Multiple watchers on `currentTime` cause cascading updates.

### Solution
Consolidate watchers, batch updates.

### Implementation

#### 4.1 Audit Current Watchers

**Current watchers on `currentTime`:**

1. ❌ `useEditorPlayback` - calls `syncVideoToTimeline` (REMOVE)
2. ✅ `useEditorPlayback` - calls `syncAudioToTimeline` (KEEP)
3. ❌ `VideoCompositor` - throttled sync check (REMOVE)
4. ✅ `ClipEditorPreviewV2` - updates overlays (KEEP)
5. ✅ `ClipEditorTimeline` - updates playhead position (KEEP)

**Action:** Remove 2 watchers, keep 3 essential ones.

#### 4.2 Batch Overlay Updates

**File:** `client/src/components/clip-editor/ClipEditorPreviewV2.vue`

```typescript
// CHANGE: Lines ~323-352 (individual computed properties)
// REPLACE with single batched computed

const activeOverlays = computed(() => {
  const time = playback.currentTime.value;
  
  return {
    text: props.textOverlays.filter(o => time >= o.startTime && time < o.endTime),
    stickers: props.stickers.filter(s => time >= s.startTime && time < s.endTime),
    watermarks: props.watermarks.filter(w => time >= (w.startTime ?? 0) && time < (w.endTime ?? Infinity)),
    effects: props.effects?.filter(e => time >= e.startTime && time < e.endTime) ?? [],
  };
});

// USE in template
const visibleTextOverlays = computed(() => activeOverlays.value.text);
const visibleStickers = computed(() => activeOverlays.value.stickers);
const visibleWatermarks = computed(() => activeOverlays.value.watermarks);
const visibleEffects = computed(() => activeOverlays.value.effects);
```

#### 4.3 Remove Throttled Watchers

**File:** `client/src/components/clip-editor/VideoCompositor.vue`

```typescript
// REMOVE: Lines ~662-678
// This throttled watcher constantly checks drift and seeks
// Not needed when video is the master clock

// DELETE:
watch(
  () => props.currentTime,
  () => {
    // Throttle sync to avoid excessive seeks
    const now = performance.now();
    if (now - lastSyncTime < 50) return;
    lastSyncTime = now;

    if (props.activeSource) {
      const video = getActiveVideo();
      if (video && slotSourceIds.value[activeSlot.value] === props.activeSource.id) {
        syncVideoToTimeline(video, props.activeSource.videoTime);
      }
    }
  }
);
```

#### 4.4 Optimize TrackRenderer Updates

**File:** `client/src/components/clip-editor/TrackRenderer.vue`

```typescript
// ADD: Memoization for expensive style calculations
const itemStyles = computed(() => {
  const styles = new Map<string, Record<string, string>>();
  
  for (const item of visibleItems.value) {
    styles.set(item.id, calculateItemStyle(item));
  }
  
  return styles;
});

// USE in template
:style="itemStyles.get(item.id)"
```

### Benefits
- ✅ Fewer Vue reactivity updates
- ✅ Reduced CPU usage during playback
- ✅ Smoother UI updates
- ✅ Less memory churn

### Testing
- Monitor Vue DevTools performance tab
- Verify frame rate stays at 60fps during playback
- Check CPU usage (should be lower)
- Verify overlays still update correctly

---

## Phase 5: MSE Integration (Optional) (Days 9-10)

### Decision Point

**Test after Phase 4 completion:**
- If segment transitions are smooth (<50ms gap) → Skip MSE
- If still seeing buffering lag → Implement MSE

### MSE Implementation (If Needed)

MSE would provide truly seamless segment transitions by:
- Loading segments as binary chunks
- Appending to SourceBuffer ahead of playback
- Eliminating HTTP request latency

**Important:** MSE only affects video loading, NOT overlay rendering.
- Overlays still use DOM-based TrackRenderer
- Preview-export parity maintained
- MSE just loads raw video segments

### Architecture with MSE

```typescript
// Single <video> element with MSE
const mediaSource = new MediaSource();
video.src = URL.createObjectURL(mediaSource);

// SourceBuffer manages segment appending
const sourceBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.64001f"');

// Web Worker fetches segments
worker.postMessage({ segmentId, url });
worker.onmessage = ({ data: { buffer } }) => {
  sourceBuffer.appendBuffer(buffer);
};
```

### Files to Create (If MSE Needed)

1. `client/src/composables/playback-v3/MSESegmentLoader.ts`
2. `client/src/composables/playback-v3/SegmentFetcher.worker.ts`
3. `client/src/composables/playback-v3/BufferManager.ts`

### Benefits (If Implemented)
- ✅ Zero-gap segment transitions
- ✅ Predictive buffering
- ✅ Better memory management
- ✅ Frame-accurate seeks

### Risks
- ⚠️ Browser compatibility (need fallback)
- ⚠️ Increased complexity
- ⚠️ Server-side changes required (byte-range requests)

---

## Phase 6: Testing & Validation (Days 11-12)

### 6.1 Preview-Export Parity Tests

**Critical:** Verify preview matches export frame-by-frame.

```typescript
// Test script: tests/preview-export-parity.test.ts

async function testPreviewExportParity() {
  const testCases = [
    { time: 5.0, description: 'Text overlay with keyframe animation' },
    { time: 10.0, description: 'Sticker with rotation' },
    { time: 15.0, description: 'Watermark positioning' },
    { time: 20.0, description: 'Color grading effect' },
    { time: 25.0, description: 'Segment transition' },
    { time: 30.0, description: 'Multiple overlays stacked' },
  ];
  
  for (const test of testCases) {
    console.log(`Testing: ${test.description} at ${test.time}s`);
    
    // 1. Seek preview to time
    await playback.seek(test.time);
    await sleep(500); // Wait for render
    
    // 2. Capture preview frame
    const previewFrame = await capturePreviewFrame();
    
    // 3. Export single frame using FFmpeg
    const exportFrame = await exportFrameAtTime(test.time);
    
    // 4. Compare frames (allow small differences due to CSS vs FFmpeg)
    const similarity = compareImages(previewFrame, exportFrame);
    
    console.log(`  Result: ${similarity.toFixed(1)}% match`);
    
    // Assert 95% similarity (5% tolerance for CSS vs FFmpeg differences)
    if (similarity < 95) {
      throw new Error(`Preview-export mismatch: ${similarity}% (expected >95%)`);
    }
  }
  
  console.log('✅ All preview-export parity tests passed');
}
```

### 6.2 Performance Benchmarks

```typescript
// Test script: tests/playback-performance.test.ts

async function benchmarkPlaybackPerformance() {
  const metrics = {
    seekLatency: [],
    scrubFrameRate: [],
    segmentTransitionGap: [],
    memoryUsage: [],
  };
  
  // Test 1: Seek latency
  console.log('Testing seek latency...');
  for (let i = 0; i < 100; i++) {
    const targetTime = Math.random() * duration;
    const start = performance.now();
    
    await playback.seek(targetTime);
    await waitForVideoReady();
    
    const latency = performance.now() - start;
    metrics.seekLatency.push(latency);
  }
  
  const avgSeekLatency = average(metrics.seekLatency);
  console.log(`  Average: ${avgSeekLatency.toFixed(1)}ms`);
  assert(avgSeekLatency < 100, 'Seek latency must be <100ms');
  
  // Test 2: Scrubbing frame rate
  console.log('Testing scrubbing frame rate...');
  const scrubDuration = 5000; // 5 seconds
  const scrubStart = performance.now();
  let frameCount = 0;
  
  while (performance.now() - scrubStart < scrubDuration) {
    const time = (performance.now() - scrubStart) / scrubDuration * duration;
    playback.seek(time);
    frameCount++;
    await nextFrame();
  }
  
  const fps = (frameCount / scrubDuration) * 1000;
  console.log(`  Frame rate: ${fps.toFixed(1)} fps`);
  assert(fps >= 60, 'Scrubbing must maintain 60fps');
  
  // Test 3: Segment transition gap
  console.log('Testing segment transitions...');
  for (let i = 0; i < videoSources.length - 1; i++) {
    const transitionTime = videoSources[i].end_time;
    
    // Play through transition
    await playback.seek(transitionTime - 0.5);
    await playback.play();
    
    const gapStart = performance.now();
    await waitForTime(transitionTime + 0.5);
    const gapDuration = performance.now() - gapStart - 1000; // Subtract expected 1s
    
    metrics.segmentTransitionGap.push(Math.max(0, gapDuration));
    
    await playback.pause();
  }
  
  const avgGap = average(metrics.segmentTransitionGap);
  console.log(`  Average gap: ${avgGap.toFixed(1)}ms`);
  assert(avgGap < 50, 'Segment transitions must have <50ms gap');
  
  // Test 4: Memory usage
  console.log('Testing memory usage...');
  const memoryBefore = performance.memory?.usedJSHeapSize ?? 0;
  
  // Load 1 hour timeline
  await loadLongTimeline(3600); // 1 hour
  await playback.seek(1800); // Seek to middle
  
  const memoryAfter = performance.memory?.usedJSHeapSize ?? 0;
  const memoryUsed = (memoryAfter - memoryBefore) / 1024 / 1024; // MB
  
  console.log(`  Memory used: ${memoryUsed.toFixed(1)} MB`);
  assert(memoryUsed < 500, 'Memory usage must be <500MB for 1hr timeline');
  
  console.log('✅ All performance benchmarks passed');
  
  return metrics;
}
```

### 6.3 Edge Case Testing

```typescript
// Test edge cases
const edgeCases = [
  {
    name: 'Very short segments (<1s)',
    setup: () => createTimelineWithShortSegments(0.5),
    test: () => playThroughTimeline(),
  },
  {
    name: 'Very long segments (>5min)',
    setup: () => createTimelineWithLongSegments(300),
    test: () => seekAcrossLongSegment(),
  },
  {
    name: 'Rapid playback rate changes',
    setup: () => loadNormalTimeline(),
    test: async () => {
      for (const rate of [0.25, 0.5, 1, 1.5, 2]) {
        playback.setPlaybackRate(rate);
        await sleep(1000);
      }
    },
  },
  {
    name: 'Network failure during segment load',
    setup: () => {
      mockNetworkFailure();
      return loadNormalTimeline();
    },
    test: () => playThroughTimeline(),
  },
  {
    name: 'Seeking to unbuffered regions',
    setup: () => loadNormalTimeline(),
    test: async () => {
      // Seek to end without preloading
      await playback.seek(duration - 1);
      await waitForVideoReady();
    },
  },
];

for (const testCase of edgeCases) {
  console.log(`Testing: ${testCase.name}`);
  await testCase.setup();
  await testCase.test();
  console.log(`  ✅ Passed`);
}
```

### 6.4 User Acceptance Testing

**Manual test checklist:**

- [ ] Playback feels smooth (no jitter)
- [ ] Scrubbing is responsive (60fps)
- [ ] Segment transitions are seamless (<50ms gap)
- [ ] Seeking is fast (<100ms)
- [ ] Text overlays appear at correct times
- [ ] Stickers animate smoothly
- [ ] Watermarks positioned correctly
- [ ] Effects render properly
- [ ] Subtitles sync with audio
- [ ] Transitions look correct
- [ ] Memory usage is reasonable
- [ ] No console errors during normal use
- [ ] Export matches preview exactly

---

## Success Metrics

### Performance Targets

| Metric | Current | Target | Critical |
|--------|---------|--------|----------|
| Seek latency | ~500ms | <100ms | ✅ |
| Scrubbing FPS | ~20fps | 60fps | ✅ |
| Segment transition gap | ~200ms | <50ms | ✅ |
| Playhead smoothness | Jittery | Locked to video | ✅ |
| Memory (1hr timeline) | Unknown | <500MB | ⚠️ |

### Parity Targets

| Feature | Current | Target | Critical |
|---------|---------|--------|----------|
| Text overlay positioning | ✅ Matches | ✅ Matches | ✅ |
| Sticker scale/rotation | ✅ Matches | ✅ Matches | ✅ |
| Watermark positioning | ✅ Matches | ✅ Matches | ✅ |
| Effect appearance | ~90% match | >95% match | ⚠️ |
| Transition timing | ✅ Matches | ✅ Matches | ✅ |
| Subtitle sync | ✅ Matches | ✅ Matches | ✅ |

---

## Timeline & Resources

### Phase Schedule

| Phase | Days | Complexity | Risk | Dependencies |
|-------|------|------------|------|--------------|
| 1. Video-driven clock | 1-2 | Low | Low | None |
| 2. Optimized loading | 3-4 | Low | Low | Phase 1 |
| 3. Scrubbing | 5-6 | Medium | Medium | Server endpoint |
| 4. Reactive cleanup | 7-8 | Low | Low | Phase 1 |
| 5. MSE (optional) | 9-10 | High | High | Phase 2 |
| 6. Testing | 11-12 | Low | Low | All phases |

**Total: 12 days (2.5 weeks)**

### Milestones

- **Day 2:** Video-driven clock working, playhead smooth
- **Day 4:** Segment loading optimized, transitions smooth
- **Day 6:** Scrubbing optimized, thumbnails working
- **Day 8:** Reactive overhead reduced, performance improved
- **Day 10:** MSE implemented (if needed)
- **Day 12:** All tests passing, ready for production

---

## Risk Mitigation

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Video-driven clock breaks overlays | Low | High | Thorough testing in Phase 1 |
| Reduced buffer causes stuttering | Medium | Medium | A/B test buffer values |
| Thumbnail generation too slow | Medium | Low | Cache aggressively, generate async |
| MSE browser compatibility | High | Medium | Keep HTTP fallback |
| Preview-export parity regression | Low | Critical | Automated tests in Phase 6 |

### Migration Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Breaking existing features | Medium | High | Feature flag for gradual rollout |
| Audio sync issues | Low | High | Keep existing audio system initially |
| Performance regression | Low | Medium | Benchmark before/after |
| User confusion | Low | Low | No UI changes, only performance |

---

## Rollout Strategy

### Phase 1: Internal Testing
- Enable via feature flag: `ENABLE_PLAYBACK_V3`
- Test with development team
- Collect performance metrics
- Fix critical bugs

### Phase 2: Beta Testing
- Enable for select power users
- Monitor error reports
- Gather feedback on smoothness
- Validate preview-export parity

### Phase 3: Gradual Rollout
- 10% of users (1 week)
- 50% of users (1 week)
- 100% of users (if no issues)

### Phase 4: Cleanup
- Remove old playback code
- Remove feature flag
- Update documentation

---

## Appendix A: File Changes Summary

### Files to Modify

1. `client/src/composables/usePlaybackEngine.ts`
   - Remove RAF loop
   - Add video-driven timing

2. `client/src/composables/useEditorPlayback.ts`
   - Remove syncVideoToTimeline
   - Update preload threshold
   - Add pause-time preloading

3. `client/src/components/clip-editor/VideoCompositor.vue`
   - Reduce MIN_BUFFER_AHEAD
   - Reduce timeout
   - Remove throttled watcher

4. `client/src/components/clip-editor/ClipEditorTimeline.vue`
   - Add scrubbing state
   - Implement debounced seeking
   - Add thumbnail preview

5. `client/src/components/clip-editor/ClipEditorPreviewV2.vue`
   - Batch overlay updates
   - Optimize computed properties

6. `server/lib/video-server.ts` (or Rust equivalent)
   - Add thumbnail endpoint

### Files to Create (Optional - MSE)

1. `client/src/composables/playback-v3/MSESegmentLoader.ts`
2. `client/src/composables/playback-v3/SegmentFetcher.worker.ts`
3. `client/src/composables/playback-v3/BufferManager.ts`

### Files to Create (Testing)

1. `tests/preview-export-parity.test.ts`
2. `tests/playback-performance.test.ts`

---

## Appendix B: Comparison with Professional Editors

### DaVinci Resolve
- ✅ Video-driven playback clock
- ✅ Predictive segment loading
- ✅ Thumbnail scrubbing
- ✅ Frame-accurate positioning
- ✅ Optimized for real-time playback

### Adobe Premiere Pro
- ✅ MSE-like segment management
- ✅ Aggressive preloading
- ✅ Debounced scrubbing
- ✅ GPU-accelerated effects
- ✅ Proxy media support

### CapCut
- ✅ Smooth playback on mobile
- ✅ Instant scrubbing
- ✅ Seamless transitions
- ✅ Real-time effects preview
- ✅ Low memory footprint

### Our Implementation
- ✅ Video-driven clock (Phase 1)
- ✅ Predictive loading (Phase 2)
- ✅ Thumbnail scrubbing (Phase 3)
- ✅ Optimized reactivity (Phase 4)
- ⚠️ MSE segments (Phase 5 - optional)
- ❌ GPU acceleration (future)
- ❌ Proxy media (future)

---

## Appendix C: Performance Monitoring

### Metrics to Track

```typescript
// Add to playback engine
class PlaybackMetrics {
  seekCount = 0;
  seekTotalTime = 0;
  segmentTransitions = 0;
  transitionTotalGap = 0;
  bufferStalls = 0;
  
  recordSeek(duration: number) {
    this.seekCount++;
    this.seekTotalTime += duration;
  }
  
  recordTransition(gap: number) {
    this.segmentTransitions++;
    this.transitionTotalGap += gap;
  }
  
  recordBufferStall() {
    this.bufferStalls++;
  }
  
  getReport() {
    return {
      avgSeekTime: this.seekTotalTime / this.seekCount,
      avgTransitionGap: this.transitionTotalGap / this.segmentTransitions,
      bufferStallRate: this.bufferStalls / this.segmentTransitions,
    };
  }
}
```

### Logging

```typescript
// Enable detailed logging with feature flag
if (import.meta.env.VITE_PLAYBACK_DEBUG) {
  console.log('[Playback] Detailed metrics:', metrics.getReport());
}
```

---

## Conclusion

This plan addresses the core playback performance issues while **preserving the existing overlay rendering system** that ensures preview-export parity.

**Key principles:**
1. **Video element is master clock** - no more sync battles
2. **Optimize loading, not rendering** - overlays already work
3. **Debounce expensive operations** - seek only when needed
4. **Reduce reactive overhead** - fewer watchers, batch updates
5. **Test parity rigorously** - preview must match export

**Expected outcome:** CapCut-grade smooth playback with frame-accurate positioning and seamless segment transitions, while maintaining exact preview-export parity for all overlays, effects, and transitions.

---

**Status:** Ready for implementation  
**Next Step:** Begin Phase 1 (Video-Driven Clock)
