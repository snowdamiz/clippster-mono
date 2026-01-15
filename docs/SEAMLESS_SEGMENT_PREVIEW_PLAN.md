# Seamless Segment Preview Plan

## Problem Statement

When playing video clips with multiple segments (cuts), transitioning between segments causes noticeable issues:
- 10-50ms delay while the browser seeks to the next segment
- Frame freezes during seek operations
- Inconsistent behavior across browsers

The root cause is that HTML5 video elements cannot perform frame-accurate instantaneous seeks. The browser must decode from the nearest keyframe, causing unavoidable latency.

## Solution: FFmpeg Pre-rendered Preview

Generate a lightweight preview video with all segment cuts pre-applied using FFmpeg concat. This eliminates runtime seeking entirely - the preview plays as a single continuous video file.

### How Professional NLEs Solve This

Tools like DaVinci Resolve, Premiere Pro, and Final Cut Pro use "optimized media" or "proxy files":
1. When edits are made, a preview-quality video is generated in the background
2. The timeline plays this pre-rendered file
3. Export uses the full-quality source with cuts applied

We will implement a similar approach.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Makes Edit                          │
│              (Split Segment / Delete / Add Clip)                │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Generate Preview Video                        │
│                                                                  │
│  1. Extract each segment from source video                      │
│  2. Concatenate segments using FFmpeg concat demuxer            │
│  3. Output low-quality preview file (480p, fast preset)         │
│  4. Store in temp directory                                     │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Update Preview Player                         │
│                                                                  │
│  1. Switch video source to generated preview file               │
│  2. Single video element - no swapping needed                   │
│  3. Seamless playback across all segment boundaries             │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Details

### 1. New Tauri Command: `generate_segment_preview`

**Location:** `client/src-tauri/src/clips/video_processor.rs`

**Function signature:**
```rust
#[tauri::command]
pub async fn generate_segment_preview(
    app: tauri::AppHandle,
    video_path: String,
    segments: Vec<PreviewSegment>,
    output_filename: String,
) -> Result<String, String>
```

**Input:**
```rust
#[derive(Debug, Deserialize)]
pub struct PreviewSegment {
    pub start_time: f64,  // Start time in source video (seconds)
    pub end_time: f64,    // End time in source video (seconds)
}
```

**Output:** Path to generated preview video file

**Preview specs (optimized for speed):**
- Resolution: 480p (scale to 854x480 or proportional)
- Codec: libx264 with ultrafast preset
- CRF: 28 (lower quality, smaller file)
- Audio: AAC 128kbps
- Target generation time: 1-3 seconds for typical clips

**Algorithm:**
1. Create temp directory for intermediate files
2. For each segment:
   - Extract segment using `-ss` (input seeking) and `-t` (duration)
   - Use stream copy if possible (`-c copy`), else fast transcode
3. Create concat list file
4. Run FFmpeg concat demuxer
5. Return path to output file

### 2. Frontend Integration

**Location:** `client/src/components/clip-editor/ClipEditorDialog.vue`

**Trigger points:**
- `splitTrimSegment()` - After segment split completes
- `deleteTrimSegment()` - After segment delete completes
- Initial load when clip has multiple segments

**State management:**
```typescript
const previewVideoPath = ref<string | null>(null);
const isGeneratingPreview = ref(false);
const previewGenerationError = ref<string | null>(null);
```

**Preview generation function:**
```typescript
async function generateSegmentPreview() {
  if (trimSegments.value.length <= 1) {
    // Single segment - use original source directly
    previewVideoPath.value = null;
    return;
  }

  isGeneratingPreview.value = true;
  try {
    const segments = trimSegments.value
      .filter(s => !s.isDeleted)
      .map(s => ({
        start_time: s.startTime + props.clipStartTime,
        end_time: s.endTime + props.clipStartTime,
      }));

    const outputFilename = `preview_${props.clipId}_${Date.now()}`;
    
    const previewPath = await invoke<string>('generate_segment_preview', {
      videoPath: sourceVideoPath.value,
      segments,
      outputFilename,
    });

    previewVideoPath.value = previewPath;
  } catch (error) {
    console.error('Failed to generate preview:', error);
    previewGenerationError.value = String(error);
    // Fallback to original behavior (direct seeking)
    previewVideoPath.value = null;
  } finally {
    isGeneratingPreview.value = false;
  }
}
```

### 3. Preview Component Updates

**Location:** `client/src/components/clip-editor/ClipEditorPreview.vue`

**Changes:**
1. Remove dual-video element complexity for clip mode
2. Accept optional `previewVideoSrc` prop
3. When `previewVideoSrc` is provided, use it instead of segment-based seeking
4. Time mapping: Preview time maps directly (0 to preview duration)

**Props addition:**
```typescript
previewVideoSrc?: string | null;  // Path to pre-rendered preview video
previewSegmentMap?: Array<{       // Maps preview time to source time
  previewStart: number;
  previewEnd: number;
  sourceStart: number;
  sourceEnd: number;
}>;
```

### 4. Time Mapping

When using the preview video, we need to map between:
- **Preview time:** Position in the concatenated preview file (0 to total duration)
- **Source time:** Position in the original source video (absolute timestamps)

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

### Preview File Storage
- Location: App temp directory (`storage::get_temp_dir()`)
- Naming: `preview_{clipId}_{timestamp}.mp4`
- Cleanup: Delete old preview files when generating new ones

### Cleanup Strategy
1. Delete previous preview file before generating new one
2. Clean up on clip editor close
3. Clean up orphaned files on app startup (optional)

## UI/UX Considerations

### Loading State
While generating preview:
- Show subtle loading indicator on video preview
- Disable play button until ready
- Show progress if generation takes >2 seconds

### Error Handling
If preview generation fails:
- Log error for debugging
- Fall back to original segment-seeking behavior
- Show non-blocking warning to user

### Performance Targets
- Generation time: <3 seconds for clips under 2 minutes
- Preview file size: ~5-10MB for typical clips
- Memory usage: Minimal (streaming, not loading into memory)

## Migration Path

### Phase 1: Backend Command
1. Implement `generate_segment_preview` Tauri command
2. Add tests with sample video files
3. Verify output quality and generation speed

### Phase 2: Frontend Integration
1. Remove dual-video element code from ClipEditorPreview.vue
2. Add preview generation triggers in ClipEditorDialog.vue
3. Implement time mapping for subtitles/transcript

### Phase 3: Polish
1. Add loading states and error handling
2. Implement preview file cleanup
3. Performance optimization if needed

## Code Locations

| Component | File Path |
|-----------|-----------|
| Tauri Command | `client/src-tauri/src/clips/video_processor.rs` |
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
- [ ] Rapid successive edits (debouncing)
- [ ] Preview generation failure (fallback behavior)
- [ ] Subtitle sync with preview video
- [ ] Transcript highlighting sync
- [ ] Waveform sync
- [ ] Memory usage during generation
- [ ] Temp file cleanup

## Rollback Plan

If issues arise, the dual-video approach code can be re-enabled by:
1. Setting `previewVideoSrc` to null
2. Re-enabling segment-based seeking in `onTimeUpdate()`

The original segment-seeking code should remain (commented or behind feature flag) as fallback.

## Future Enhancements

1. **Background generation:** Generate preview in background thread, show old preview until new one is ready
2. **Incremental updates:** Only re-encode changed portions
3. **Quality options:** Allow user to choose preview quality vs. speed
4. **Caching:** Cache preview files for unchanged segment configurations
