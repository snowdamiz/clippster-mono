# FFmpeg Clip Building Performance Optimization Plan

## Analysis Summary

After carefully investigating the FFmpeg clip building flow in `client/src-tauri/src/clips.rs`, I've identified several significant performance bottlenecks that can be eliminated without compromising output quality:

### Current Flow

1. **Sequential aspect ratio processing** - Each aspect ratio (9:16, 16:9, 1:1, 4:5) is built one at a time
2. **Sequential segment extraction** - Multiple segments are processed in a loop, waiting for each to complete
3. **Redundant video info calls** - `get_video_info()` is called multiple times for the same video
4. **Redundant intro/outro processing** - Intro/outro videos are re-processed for each aspect ratio
5. **Multiple encoding passes** - Concat + subtitle burning requires separate encode passes
6. **No hardware acceleration** - Uses software encoding only (libx264)

## Critical Performance Issues Identified

### Issue 1: Sequential Aspect Ratio Processing

**Location**: Lines 366-488 in `build_clip_internal_simple()`

```rust
for (ratio_idx, aspect_ratio_str) in aspect_ratios.iter().enumerate() {
    // Entire build process runs sequentially
}
```

**Impact**: If building 4 aspect ratios takes 120s total, they could run in ~30s parallel

### Issue 2: Sequential Multi-Segment Extraction  

**Location**: Lines 883-920 in `build_multi_segment_clip_with_settings()`

```rust
for (i, segment) in segments.iter().enumerate() {
    let output = shell.sidecar("ffmpeg").output().await
    // Each segment waits for previous to complete
}
```

**Impact**: 5 segments taking 5s each = 25s sequential vs ~5s parallel

### Issue 3: Redundant Video Info Calls

**Location**: Lines 356, 602, 876, 1117 - `get_video_info()` called 4+ times

**Impact**: Each call spawns ffmpeg process (~200-500ms overhead per call)

### Issue 4: Redundant Intro/Outro Processing

**Location**: Lines 655-683, 926-954 - `prepare_intro_outro_for_concat()` called per aspect ratio

**Impact**: Same intro/outro re-encoded multiple times unnecessarily

### Issue 5: Two-Pass Encoding (Concat + Subtitles)

**Location**: Lines 705-730 (concat), 732-776 (subtitle burn)

**Impact**: Video is fully encoded twice when subtitles are present

### Issue 6: No Hardware Acceleration

**Location**: Lines 813-820, 899-906 - Uses libx264 software encoding

**Impact**: 3-10x slower than hardware-accelerated encoding

## Optimization Strategy

### Optimization 1: Cache Video Info

- Add static cache for video info keyed by file path
- Eliminate redundant ffprobe/ffmpeg calls
- **Estimated speedup**: 1-2 seconds saved per build

### Optimization 2: Parallel Segment Extraction

- Use `futures::future::join_all()` to process segments concurrently
- Limit concurrency to CPU cores to avoid thrashing
- **Estimated speedup**: 3-5x faster for multi-segment clips

### Optimization 3: Parallel Aspect Ratio Builds

- Process multiple aspect ratios concurrently
- Each aspect ratio is independent and can run in parallel
- **Estimated speedup**: Near-linear (3-4x with 4 aspect ratios)

### Optimization 4: Cache Intro/Outro by Aspect Ratio

- Process intro/outro once per aspect ratio, cache within build session
- Reuse processed files across all clips in same build
- **Estimated speedup**: 50-70% reduction for builds with intro/outro

### Optimization 5: Single-Pass Subtitle Rendering

- Apply crop + subtitles in one filter_complex pass
- Eliminate intermediate concat file when possible
- **Estimated speedup**: 40-50% faster for subtitle-enabled clips

### Optimization 6: Hardware Encoding (Optional, Quality-Safe)

- Detect available hardware encoders (h264_nvenc, h264_qsv, h264_videotoolbox)
- Use CRF equivalents to maintain quality parity
- Add fallback to libx264 if hardware unavailable
- **Estimated speedup**: 3-10x encoding speed improvement

## Implementation Priority

**High Priority** (Immediate wins, no risk):

1. Cache video info (2% time saved, trivial implementation)
2. Parallel segment extraction (60-80% faster for multi-segment)
3. Cache intro/outro processing (50% faster with intro/outro)

**Medium Priority** (Significant gains, moderate complexity):

4. Parallel aspect ratio builds (3-4x faster overall)
5. Single-pass subtitle+crop filter (40% faster with subtitles)

**Lower Priority** (Optional, requires testing):

6. Hardware acceleration (3-10x but platform-dependent)

## Quality Assurance

All optimizations maintain identical output quality:

- Parallel processing doesn't change encoding parameters
- Caching uses same processing logic, eliminates redundancy only
- Single-pass filtering produces identical output to two-pass
- Hardware encoders use quality-equivalent CRF settings

## Files to Modify

- `client/src-tauri/src/clips.rs` - Main clip building logic (lines 300-1100)
- May need to add `Cargo.toml` dependency: `futures` for join_all

## Expected Overall Improvement

Conservative estimate with priority 1-5 implemented:

- **Single aspect ratio, multi-segment**: 3-5x faster
- **Multiple aspect ratios**: 4-6x faster  
- **With intro/outro**: 5-8x faster
- **Typical user workflow**: 4-7x overall speedup