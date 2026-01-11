# CapCut-Style Video Thumbnails in Timeline

> **Status**: Planning  
> **Created**: January 11, 2026  
> **Estimated Effort**: 6-10 days

## Overview

Implement CapCut-style video thumbnail strips in the timeline editor. As users zoom in, more thumbnails are displayed, theoretically allowing them to see the entire video frame-by-frame at maximum zoom. The playhead and hover playhead should also scrub through the actual video frames, not just audio waveforms.

---

## Current State

### What exists today:
- **Single thumbnail per source**: Uses `source.source_thumbnail` (one frame, typically at 1 second)
- **Fake filmstrip effect**: `getFilmstripThumbnails()` tiles the *same* thumbnail with different `background-position` values to simulate a filmstrip, but it's just repositioning one image
- **Audio waveforms**: Fully implemented with zoom-adaptive density via `waveformService`
- **Frame extraction**: `generate_thumbnail_at_timestamp` in Rust/FFmpeg can extract frames at specific times

### What CapCut does:
- Extracts **multiple actual frames** from the video at intervals
- As you zoom in, it extracts **more frames** to fill the space
- Playhead/hover scrubbing shows the **actual video frame** at that position

---

## Implementation Plan

### Phase 1: Video Thumbnail Service (Backend)

#### 1.1 Create a `thumbnailStripService` (TypeScript)
- Similar architecture to `waveformService`
- Cache extracted frames per video file
- API: `getThumbnailsForRange(videoPath, startTime, endTime, count)`

#### 1.2 New Tauri command: `extract_video_frames`
- Input: video path, array of timestamps, output size (e.g., 80x45 for 16:9)
- Output: Array of base64 data URLs or file paths
- Use FFmpeg with `-vf "select='eq(n,X)'"` or seek + single frame extraction
- **Batch extraction** for efficiency (one FFmpeg call for multiple frames)

#### 1.3 Caching strategy
- Store extracted frames in `thumbnails/strips/{video_hash}/` directory
- Cache at multiple densities (e.g., 1 frame/5s, 1 frame/1s, 1 frame/0.5s)
- Progressive loading: show low-density first, then load higher density on zoom

---

### Phase 2: Timeline Thumbnail Rendering (Frontend)

#### 2.1 Update `ClipEditorTimeline.vue`
- Replace fake filmstrip with real frame thumbnails
- New function: `getVideoFrameThumbnails(source, zoomLevel)` 
- Calculate required frame density based on:
  - Segment pixel width
  - Desired thumbnail width (~60-80px)
  - Zoom level

#### 2.2 Adaptive density logic
```
pixelWidth = segmentDuration * pixelsPerSecond * zoomLevel
framesNeeded = ceil(pixelWidth / THUMB_WIDTH)
frameInterval = segmentDuration / framesNeeded
```

#### 2.3 Lazy loading with placeholders
- Show blurred/placeholder thumbnails while loading
- Load visible frames first (viewport-aware)
- Use `IntersectionObserver` for off-screen segments

---

### Phase 3: Playhead Frame Preview

#### 3.1 Hover playhead frame extraction
- On hover/scrub, extract frame at that timestamp
- Use a **debounced** extraction (e.g., 100ms delay)
- Cache recently viewed frames in memory (LRU cache)

#### 3.2 Main playhead sync
- **Option A**: Use hidden `<video>` element seeking (fast, uses browser decoding)
- **Option B**: Extract frames via FFmpeg (slower but consistent)
- Likely **Option A** for real-time scrubbing, with FFmpeg as fallback

#### 3.3 Preview thumbnail tooltip
- Small floating preview showing frame at hover position
- Similar to YouTube's thumbnail preview on seek bar

---

### Phase 4: Performance Optimizations

#### 4.1 Web Workers
- Offload frame decoding to worker threads
- Prevent UI jank during extraction

#### 4.2 Canvas-based rendering
- Render thumbnail strip to a single canvas (like waveforms)
- More efficient than many `<img>` elements

#### 4.3 Memory management
- Limit cached frames per video
- Clear frames for off-screen/closed clips
- Use `ImageBitmap` for efficient GPU rendering

---

## Effort Estimate

| Phase | Complexity | Estimated Effort |
|-------|------------|------------------|
| Phase 1 (Backend) | Medium | 2-3 days |
| Phase 2 (Timeline) | Medium-High | 2-3 days |
| Phase 3 (Playhead) | Medium | 1-2 days |
| Phase 4 (Optimization) | Medium | 1-2 days |
| **Total** | | **6-10 days** |

---

## Key Technical Decisions

### 1. Frame extraction method
- **FFmpeg batch extraction**: More control, consistent quality, works offline
- **Browser `<video>` + canvas capture**: Faster for real-time, uses GPU decoding
- **Recommendation**: FFmpeg for pre-caching strips, browser video for live scrubbing

### 2. Storage format
- **Base64 data URLs**: Fast access, higher memory usage
- **Disk files**: Lower memory, I/O overhead
- **Recommendation**: Disk files with in-memory LRU cache for active clips

### 3. Density tiers
- Low: 1 frame per 5 seconds (default view)
- Medium: 1 frame per 1 second (zoomed)
- High: 1 frame per 0.5 seconds (highly zoomed)
- **Recommendation**: Generate on-demand based on zoom level

### 4. Playhead preview style
- **Tooltip preview**: Small floating thumbnail at cursor
- **Inline track update**: Update thumbnails in track as you scrub
- **Recommendation**: Tooltip preview (less jarring, lower performance cost)

---

## Relevant Files

### Frontend
- `client/src/components/clip-editor/ClipEditorTimeline.vue` - Main timeline component
- `client/src/services/waveformService.ts` - Reference architecture for caching service
- `client/src/utils/waveformRenderer.ts` - Reference for canvas rendering

### Backend
- `client/src-tauri/src/storage.rs` - Existing `generate_thumbnail_at_timestamp` command
- `client/src-tauri/src/lib.rs` - Tauri command registration

---

## Future Enhancements

- [ ] Sprite sheet generation (single image with all frames for faster loading)
- [ ] WebCodecs API for browser-native frame extraction
- [ ] GPU-accelerated thumbnail generation
- [ ] Thumbnail strip export for sharing/collaboration
