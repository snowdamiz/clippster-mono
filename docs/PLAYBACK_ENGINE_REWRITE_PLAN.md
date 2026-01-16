# Playback Engine Rewrite Plan

## Executive Summary

Complete rewrite of the video playback system to achieve **CapCut/DaVinci Resolve-grade** instant, seamless, and glitch-free preview playback. The current system has fundamental architectural issues that cannot be fixed incrementally—it requires a ground-up redesign.

---

## Current Problems

### 1. Event-Driven vs Timeline-Driven
The current system reacts to video element events (`timeupdate`, `ended`, `seeked`) and tries to synchronize state. This is backwards. Professional editors use a **master timeline clock** that drives all playback.

### 2. State Explosion
Too many interdependent flags: `isSeeking`, `isGapPlayback`, `shouldResumePlayback`, `crossfadeStarted`, `currentVideoSourceId`, `pendingSeekTime`, etc. These create race conditions and edge cases.

### 3. Multiple Video Elements Fighting
The system uses 5+ video elements (main, framed, audio-only, preload, region videos) that must stay synchronized. This is fragile and causes visual glitches.

### 4. Gap Handling is Bolt-On
Gaps (empty timeline sections) are handled as a special case rather than being fundamental to the architecture.

### 5. No True Compositor
Effects, transitions, and overlays are rendered separately from video, causing sync issues.

---

## New Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      PlaybackEngine                              │
│  (Master Timeline Clock - Single Source of Truth)               │
├─────────────────────────────────────────────────────────────────┤
│  • currentTime: number (timeline position in seconds)           │
│  • isPlaying: boolean                                           │
│  • playbackRate: number                                         │
│  • duration: number (total timeline duration)                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TimelineRenderer                              │
│  (Queries timeline state at currentTime)                        │
├─────────────────────────────────────────────────────────────────┤
│  • getActiveVideoSource(time) → VideoSource | null              │
│  • getActiveAudioTracks(time) → AudioTrack[]                    │
│  • getActiveOverlays(time) → Overlay[]                          │
│  • getActiveTransition(time) → Transition | null                │
│  • isInGap(time) → boolean                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     VideoCompositor                              │
│  (Renders the correct frame for currentTime)                    │
├─────────────────────────────────────────────────────────────────┤
│  • Single primary <video> element                               │
│  • Single preload <video> element (for transitions only)        │
│  • Canvas for frame composition during transitions              │
│  • Black frame rendering for gaps                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AudioMixer                                  │
│  (Web Audio API - driven by timeline clock)                     │
├─────────────────────────────────────────────────────────────────┤
│  • Video audio source (from primary video element)              │
│  • Additional audio tracks (each with own source)               │
│  • Gain nodes for volume/fades                                  │
│  • Effects processing chain                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Principles

### 1. Timeline is King
The `PlaybackEngine` owns a master clock. When playing, it advances `currentTime` using `requestAnimationFrame`. All other systems **query** the timeline state—they don't drive it.

### 2. Pull, Don't Push
Instead of video elements pushing `timeupdate` events that trigger state changes, the engine **pulls** the correct video frame by seeking the video element to match the timeline position.

### 3. Gaps are First-Class
A gap is simply a timeline region with no video source. The renderer checks `isInGap(time)` and shows black. No special state flags needed.

### 4. Minimal Video Elements
- **Primary**: The currently playing video source
- **Preload**: Pre-seeks to next source for seamless transitions
- That's it. No framed/audio-only/region variants in the playback layer.

### 5. Frame Composition for Transitions
During crossfade/wipe/slide transitions, both videos render to an offscreen canvas, which is then composited and displayed. This guarantees frame-accurate transitions.

---

## Implementation Plan

### Phase 1: PlaybackEngine Composable
**File:** `client/src/composables/usePlaybackEngine.ts`

```typescript
interface PlaybackEngineOptions {
  timeline: Ref<TimelineState>;
  onTimeUpdate?: (time: number) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
}

interface PlaybackEngineReturn {
  // State (readonly)
  currentTime: Readonly<Ref<number>>;
  isPlaying: Readonly<Ref<boolean>>;
  playbackRate: Ref<number>;
  duration: ComputedRef<number>;
  
  // Controls
  play(): void;
  pause(): void;
  seek(time: number): void;
  setPlaybackRate(rate: number): void;
  
  // Cleanup
  dispose(): void;
}
```

**Key behaviors:**
- Uses `requestAnimationFrame` loop when playing
- Advances `currentTime` by `deltaTime * playbackRate` each frame
- Clamps to [0, duration]
- Auto-pauses at end of timeline
- Emits time updates at 60fps (or display refresh rate)

### Phase 2: TimelineRenderer Composable
**File:** `client/src/composables/useTimelineRenderer.ts`

```typescript
interface TimelineState {
  videoSources: VideoEditorSource[];
  audioTracks: AudioTrack[];
  textOverlays: TextOverlay[];
  stickers: Sticker[];
  watermarks: Watermark[];
  transitions: Transition[];
  effects: Effect[];
}

interface TimelineRendererReturn {
  // Queries (all take currentTime as input)
  getActiveVideoSource(time: number): VideoEditorSource | null;
  getVideoSourceTime(time: number, source: VideoEditorSource): number;
  getActiveAudioTracks(time: number): ActiveAudioTrack[];
  getActiveOverlays(time: number): ActiveOverlay[];
  getActiveTransition(time: number): ActiveTransition | null;
  isInGap(time: number): boolean;
  
  // Precomputed for performance
  sortedVideoSources: ComputedRef<VideoEditorSource[]>;
}
```

**Key behaviors:**
- All queries are pure functions of `time` and `timeline`
- No side effects, no state mutations
- Video sources sorted by `start_time` (timeline position)
- Efficient gap detection via binary search

### Phase 3: VideoCompositor Component
**File:** `client/src/components/clip-editor/VideoCompositor.vue`

```vue
<template>
  <div class="video-compositor">
    <!-- Primary video (hidden during transitions) -->
    <video 
      ref="primaryVideo"
      :class="{ 'opacity-0': isInTransition }"
    />
    
    <!-- Preload video (for seamless source switches) -->
    <video 
      ref="preloadVideo"
      class="hidden"
    />
    
    <!-- Transition canvas (visible during transitions) -->
    <canvas 
      ref="transitionCanvas"
      v-show="isInTransition"
    />
    
    <!-- Black overlay for gaps -->
    <div 
      v-if="isInGap"
      class="absolute inset-0 bg-black"
    />
  </div>
</template>
```

**Key behaviors:**
- Receives `currentTime` as prop
- On time change:
  1. Check if in gap → show black
  2. Check if in transition → composite both sources
  3. Otherwise → ensure primary video is at correct position
- Preloads next source when approaching end of current source
- Single `seeked` event handler, no complex state machine

### Phase 4: AudioMixer Composable
**File:** `client/src/composables/useAudioMixer.ts`

```typescript
interface AudioMixerReturn {
  // Control
  syncToTime(time: number): void;
  setMasterVolume(volume: number): void;
  setTrackVolume(trackId: string, volume: number): void;
  setTrackMute(trackId: string, muted: boolean): void;
  
  // State
  masterVolume: Ref<number>;
  isMuted: Ref<boolean>;
  
  // Cleanup
  dispose(): void;
}
```

**Key behaviors:**
- Creates Web Audio context
- Video element audio routed through gain node
- Each audio track has its own MediaElementSource + GainNode
- `syncToTime()` seeks all audio to correct positions
- Applies fades based on track fade in/out settings

### Phase 5: Refactor ClipEditorPreview.vue

**Remove:**
- All playback state (`isPlaying`, `isSeeking`, etc.)
- All video element event handlers for playback
- All segment seek logic
- All crossfade logic
- All gap handling logic
- Multiple video element management

**Keep:**
- Framing/cropping display logic
- Overlay rendering (text, stickers, watermarks)
- Filter application
- UI controls (play button, timeline scrub)

**Add:**
- Integration with `usePlaybackEngine`
- Integration with `VideoCompositor`
- Integration with `useAudioMixer`

### Phase 6: Refactor ClipEditorDialog.vue

**Remove:**
- `isPlaying`, `isSeeking`, `isGapPlayback`, etc.
- `onVideoEnded`, `onPreviewTimeUpdate`, `togglePlay` complexity
- `transitionToSource`, `startGapPlayback`, etc.
- All crossfade management
- Preview cache integration (will be reimplemented)

**Keep:**
- Timeline data management (videoSources, audioTracks, etc.)
- Edit operations (add/remove/update sources)
- Undo/redo system
- Auto-save

**Add:**
- `usePlaybackEngine` initialization
- Pass timeline state to engine
- Simple play/pause/seek handlers

---

## Detailed Component Design

### PlaybackEngine RAF Loop

```typescript
function startPlayback() {
  isPlaying.value = true;
  lastFrameTime = performance.now();
  rafId = requestAnimationFrame(tick);
}

function tick(timestamp: number) {
  if (!isPlaying.value) return;
  
  const delta = (timestamp - lastFrameTime) / 1000;
  lastFrameTime = timestamp;
  
  const newTime = currentTime.value + delta * playbackRate.value;
  
  if (newTime >= duration.value) {
    currentTime.value = duration.value;
    isPlaying.value = false;
    return;
  }
  
  currentTime.value = newTime;
  rafId = requestAnimationFrame(tick);
}

function pause() {
  isPlaying.value = false;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function seek(time: number) {
  currentTime.value = Math.max(0, Math.min(time, duration.value));
}
```

### VideoCompositor Source Management

```typescript
// Watch for time changes
watch(currentTime, (time) => {
  const source = timelineRenderer.getActiveVideoSource(time);
  const transition = timelineRenderer.getActiveTransition(time);
  
  if (!source) {
    // In a gap - show black
    showBlack.value = true;
    return;
  }
  
  showBlack.value = false;
  
  if (transition) {
    // In a transition - composite
    handleTransition(time, transition);
    return;
  }
  
  // Normal playback
  ensureCorrectSource(source);
  syncVideoToTimeline(time, source);
});

function syncVideoToTimeline(time: number, source: VideoEditorSource) {
  const videoTime = timelineRenderer.getVideoSourceTime(time, source);
  
  // Only seek if difference is significant (> 100ms drift)
  if (Math.abs(primaryVideo.value.currentTime - videoTime) > 0.1) {
    primaryVideo.value.currentTime = videoTime;
  }
  
  // Ensure playing state matches
  if (isPlaying.value && primaryVideo.value.paused) {
    primaryVideo.value.play();
  } else if (!isPlaying.value && !primaryVideo.value.paused) {
    primaryVideo.value.pause();
  }
}
```

### Gap Detection

```typescript
function isInGap(time: number): boolean {
  const sources = sortedVideoSources.value;
  
  // Before first source
  if (sources.length === 0 || time < sources[0].start_time) {
    return true;
  }
  
  // After last source
  const lastSource = sources[sources.length - 1];
  if (time >= lastSource.end_time) {
    return true;
  }
  
  // Check if time falls within any source
  for (const source of sources) {
    if (time >= source.start_time && time < source.end_time) {
      return false;
    }
  }
  
  return true; // Between sources = gap
}
```

---

## Migration Strategy

### Step 1: Create New Composables
Build `usePlaybackEngine`, `useTimelineRenderer`, `useAudioMixer` as standalone modules with unit tests.

### Step 2: Create VideoCompositor
Build as a new component alongside existing `ClipEditorPreview`.

### Step 3: Integration
Replace playback logic in `ClipEditorDialog` and `ClipEditorPreview` with new composables.

### Step 4: Remove Old Code
Delete all legacy playback code once new system is verified working.

### Step 5: Polish
Add preloading, optimize canvas transitions, tune sync thresholds.

---

## Performance Considerations

### 1. Avoid Layout Thrashing
- Cache container dimensions
- Use `transform` instead of `top/left` for positioning
- Batch DOM reads/writes

### 2. Efficient Queries
- Pre-sort video sources by start_time
- Use binary search for gap detection
- Memoize expensive computations

### 3. Video Element Management
- Reuse video elements when possible
- Preload next source ~2 seconds before needed
- Don't create/destroy elements during playback

### 4. Canvas Optimization
- Use `OffscreenCanvas` where supported
- Match canvas resolution to display size
- Use hardware compositing hints

---

## Testing Strategy

### Unit Tests
- `usePlaybackEngine`: play/pause/seek/rate behavior
- `useTimelineRenderer`: gap detection, source queries
- `useAudioMixer`: volume/fade calculations

### Integration Tests
- Source transitions (no glitch)
- Gap playback (black + silent)
- Seek to any position (instant)
- Play through entire timeline

### Manual Testing
- Import video, play immediately
- Make 50 cuts, play seamlessly
- Create gaps, verify black/silent
- Test all transition types
- Test with audio tracks
- Test with overlays

---

## Files to Modify

### New Files
- `client/src/composables/usePlaybackEngine.ts`
- `client/src/composables/useTimelineRenderer.ts`
- `client/src/composables/useAudioMixer.ts`
- `client/src/components/clip-editor/VideoCompositor.vue`

### Major Refactors
- `client/src/components/clip-editor/ClipEditorDialog.vue`
- `client/src/components/clip-editor/ClipEditorPreview.vue`

### Minor Updates
- `client/src/components/clip-editor/ClipEditorTimeline.vue` (time sync)
- `client/src/composables/useAudioTrackPlayback.ts` (replaced by AudioMixer)

### Can Remove After Migration
- Gap playback logic in ClipEditorDialog
- Crossfade logic in ClipEditorDialog/Preview
- Segment seek logic in ClipEditorPreview
- Preview cache HLS integration (simplify to direct source playback)

---

## Success Criteria

1. **Instant Playback**: Press play, video plays immediately
2. **Zero Glitches**: No visual artifacts at segment boundaries
3. **Accurate Gaps**: Empty timeline = black screen + silence
4. **Frame-Accurate Seek**: Seek to any position, correct frame shown
5. **Smooth Transitions**: Crossfades render perfectly
6. **Audio Sync**: All audio tracks stay in sync with video
7. **Performance**: 60fps playback with overlays and effects

---

## Timeline Estimate

| Phase | Duration | Description |
|-------|----------|-------------|
| 1 | 1 day | PlaybackEngine composable |
| 2 | 1 day | TimelineRenderer composable |
| 3 | 2 days | VideoCompositor component |
| 4 | 1 day | AudioMixer composable |
| 5 | 2 days | ClipEditorPreview refactor |
| 6 | 2 days | ClipEditorDialog refactor |
| 7 | 1 day | Testing and polish |

**Total: ~10 development days**

---

## Appendix: CapCut/DaVinci Architecture Analysis

### How CapCut Achieves Instant Playback

1. **Timeline-Driven**: Master clock advances, video elements follow
2. **Proxy Files**: Low-res proxies for editing, full-res for export
3. **Frame Caching**: Decoded frames cached in memory
4. **GPU Compositing**: Effects and overlays rendered on GPU
5. **Predictive Loading**: Next segments loaded before needed

### Key Insight

The fundamental difference is **push vs pull**:

- **Current System (Push)**: Video elements emit events → state machine reacts
- **CapCut (Pull)**: Master clock ticks → query what should be visible → render it

The pull model eliminates race conditions because there's a single source of truth (the clock) and everything else derives from it.
