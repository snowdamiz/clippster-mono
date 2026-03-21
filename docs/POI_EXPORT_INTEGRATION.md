# POI Editor Export Pipeline Integration

## Overview
This document outlines the integration requirements for exporting POI editor enhancements (media uploads, source transforms, and segment-based regions) through the FFmpeg-based video export pipeline.

## Current Implementation

### Location
- **Rust Implementation**: `client/src-tauri/src/clips/video_processor.rs`
- **Function**: `build_multi_region_clip()`
- **Lines**: 2661-2850 (approximately)

### Current Capabilities
The existing `build_multi_region_clip()` function:
1. Accepts `ManualFramingConfig` with multiple regions
2. Crops each region from source video
3. Scales regions to output dimensions
4. Composites regions onto black canvas
5. Applies video filters and effects

### Data Flow
```
Frontend (ManualPOIEditor.vue)
  ↓ emits ManualFramingConfig
ClipBuildSettingsDialog / QuickPublishWizard
  ↓ passes to build command
Rust Orchestrator (orchestrator.rs)
  ↓ selects framing strategy
Video Processor (video_processor.rs)
  ↓ build_multi_region_clip()
FFmpeg Command Execution
```

## New Features to Integrate

### 1. Uploaded Media Regions

#### Frontend Data Structure
```typescript
interface ManualRegion {
  id: string;
  color: string;
  source: ManualRegionRect;
  output: ManualRegionRect;
  mediaAssetId?: string;  // NEW: Object URL or file path
  mediaType?: 'video-crop' | 'image' | 'video';  // NEW
}
```

#### Export Requirements
- **Image Regions**: Overlay static image at output position
- **Video Regions**: Overlay video (looped or synced) at output position
- **Video-Crop Regions**: Default behavior (crop from source)

#### Implementation Approach
```rust
// Pseudo-code for media region handling
for region in config.regions {
    match region.media_type {
        Some("image") => {
            // Use FFmpeg overlay filter with image input
            // ffmpeg -i video.mp4 -i image.png -filter_complex "[1:v]scale=W:H[img];[0:v][img]overlay=X:Y"
        },
        Some("video") => {
            // Use FFmpeg overlay filter with video input (loop if needed)
            // ffmpeg -i video.mp4 -stream_loop -1 -i overlay.mp4 -filter_complex "[1:v]scale=W:H[vid];[0:v][vid]overlay=X:Y"
        },
        _ => {
            // Default: crop from source video
            // Current implementation
        }
    }
}
```

#### Challenges
1. **Object URLs**: Frontend uses `URL.createObjectURL()` which creates blob URLs
   - **Solution**: Need to convert to file paths before passing to Rust
   - **Alternative**: Pass file data as bytes and write temp files in Rust
2. **File Path Resolution**: Media files need to be accessible to FFmpeg
3. **Synchronization**: Video overlays need proper timing/looping

### 2. Source Frame Transform

#### Frontend Data Structure
```typescript
interface ManualFramingConfig {
  // ... existing fields
  sourceTransform?: {
    scale: number;  // 0.5 to 3.0
    x: number;      // Normalized offset
    y: number;      // Normalized offset
  };
}
```

#### Export Requirements
- Apply global scale and position to source video BEFORE cropping regions
- All region coordinates are relative to transformed source

#### Implementation Approach
```rust
// Apply source transform before region cropping
if let Some(transform) = config.source_transform {
    // Calculate transformed source dimensions
    let transformed_w = source_w * transform.scale;
    let transformed_h = source_h * transform.scale;
    let offset_x = transform.x * source_w;
    let offset_y = transform.y * source_h;
    
    // Adjust region crop coordinates relative to transform
    for region in regions {
        region.source.x = (region.source.x * transformed_w + offset_x) / source_w;
        region.source.y = (region.source.y * transformed_h + offset_y) / source_h;
        // ... adjust width/height similarly
    }
}
```

#### FFmpeg Approach
```bash
# Option 1: Pre-transform source video
ffmpeg -i input.mp4 -vf "scale=iw*SCALE:ih*SCALE,crop=W:H:X:Y" transformed.mp4

# Option 2: Apply transform in filter chain
[0:v]scale=iw*1.5:ih*1.5,crop=1920:1080:100:50[transformed];
[transformed]crop=...  # Then crop regions from transformed
```

### 3. Segment-Based Regions

#### Frontend Data Structure
```typescript
interface SegmentRegionConfig {
  segmentId: string;
  startTime: number;  // Relative to clip start
  endTime: number;    // Relative to clip start
  regions: ManualRegion[];
}

interface ManualFramingConfig {
  // ... existing fields
  segmentConfigs?: SegmentRegionConfig[];
}
```

#### Export Requirements
- Apply different region configurations at different time ranges
- Instant transitions between segments (hard cuts, no blending)
- Each segment has independent region layout

#### Implementation Approach

**Option 1: Multiple Passes with Concatenation**
```rust
// For each segment:
// 1. Extract segment time range
// 2. Build multi-region clip for that segment
// 3. Concatenate all segments

for segment in segment_configs {
    let segment_output = build_multi_region_clip(
        video_path,
        segment.regions,
        segment.start_time,
        segment.end_time
    );
    segment_files.push(segment_output);
}

// Concatenate segments
ffmpeg -i seg1.mp4 -i seg2.mp4 -filter_complex "[0:v][1:v]concat=n=2:v=1[out]"
```

**Option 2: Complex Filter with Time-Based Switching**
```bash
# Use enable filter to show/hide regions based on time
[0:v]crop=...,scale=...[r1];
[r1]overlay=X:Y:enable='between(t,0,15)'[tmp1];
[tmp1]overlay=X2:Y2:enable='between(t,15,30)'[out]
```

**Recommended**: Option 1 (Multiple Passes)
- Cleaner implementation
- Easier to debug
- Better for complex region changes
- Instant transitions guaranteed

## Implementation Plan

### Phase 6.1: Uploaded Media Support
1. **Frontend Changes**:
   - Convert object URLs to file paths before export
   - Pass media file paths in `ManualRegion.mediaAssetId`
   - Add `mediaFilePath` field alongside `mediaAssetId`

2. **Rust Changes**:
   - Update `ManualRegion` struct in `types.rs`
   - Modify `build_multi_region_clip()` to handle media types
   - Add FFmpeg overlay filters for image/video regions

### Phase 6.2: Source Transform Support
1. **Rust Changes**:
   - Update `ManualFramingConfig` struct in `types.rs`
   - Add transform application logic before region cropping
   - Adjust region coordinates based on transform

### Phase 6.3: Segment-Based Regions
1. **Rust Changes**:
   - Update `ManualFramingConfig` struct in `types.rs`
   - Implement segment iteration and clip building
   - Add FFmpeg concatenation for segment outputs
   - Handle segment transitions

### Phase 6.4: Testing
1. Test image upload regions
2. Test video upload regions
3. Test source frame scaling
4. Test segment-based region changes
5. Test combinations of all features

## Rust Type Updates Required

### `client/src-tauri/src/clips/types.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManualRegion {
    pub id: String,
    pub color: String,
    pub label: Option<String>,
    pub source: NormalizedBBox,
    pub output: NormalizedBBox,
    // NEW FIELDS
    pub media_asset_id: Option<String>,
    pub media_type: Option<String>,  // "video-crop" | "image" | "video"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceTransform {
    pub scale: f64,
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SegmentRegionConfig {
    pub segment_id: String,
    pub start_time: f64,
    pub end_time: f64,
    pub regions: Vec<ManualRegion>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ManualFramingConfig {
    pub mode: String,
    pub regions: Vec<ManualRegion>,
    pub target_aspect_ratio: String,
    pub source_aspect_ratio: Option<String>,
    // NEW FIELDS
    pub source_transform: Option<SourceTransform>,
    pub segment_configs: Option<Vec<SegmentRegionConfig>>,
}
```

## Notes

### Object URL Handling
The frontend currently uses `URL.createObjectURL()` for uploaded media, which creates blob URLs like `blob:http://localhost:1420/abc-123`. These are not accessible to Rust/FFmpeg.

**Solutions**:
1. **File Path Approach**: Store uploaded files to temp directory and pass paths
2. **Base64 Approach**: Convert to base64, pass to Rust, decode and write temp files
3. **Tauri Asset Protocol**: Use Tauri's asset protocol for file access

**Recommended**: File Path Approach
- Store uploads in `%TEMP%/clippster_poi_media/`
- Pass absolute file paths in `mediaAssetId`
- Clean up temp files after export

### Performance Considerations
- Segment-based exports may take longer (multiple passes)
- Video overlay regions require additional decoding
- Consider progress reporting for multi-segment exports

### Future Enhancements
- Transition effects between segments (fade, wipe, etc.)
- Region animations (pan, zoom over time)
- Audio mixing for video overlay regions
- GPU acceleration for faster encoding
