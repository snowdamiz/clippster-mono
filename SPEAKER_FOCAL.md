# Per-Clip Speaker Focal Point Detection

## Overview

Replace the temporary FFmpeg cropdetect solution with production-ready per-clip focal point detection that:

- Runs AFTER OpenRouter detects clips (not during transcription)
- Detects focal points for each individual detected clip
- Uses cloud-based ML APIs (Google Vision or AWS Rekognition) for accurate face detection
- Intelligently reuses focal points from overlapping clips in previous detection runs
- Stores focal points linked to both clip_id and raw_video_id

## Current State Analysis

### What Exists

- Database schema for focal points (`focal_points` table) with raw_video_id ✅
- Focal point storage and retrieval functions ✅
- Video player integration with focal point interpolation ✅
- FFmpeg integration via Tauri sidecar ✅
- Whisper transcript with word-level timestamps ✅
- OpenRouter clip detection that returns clips with start/end times ✅

### What Needs to Change

- **Detection timing**: Move from transcription phase to AFTER clip detection
- **Detection scope**: Detect focal points per-clip instead of entire video
- **Database schema**: Add clip_id foreign key to focal_points table
- **Reuse logic**: Check for existing focal points in overlapping time ranges
- **Replace**: Rust-based cropdetect with server-side cloud vision detection

## Revised Architecture

### Detection Flow Order

```
1. Audio Extraction (client)
2. Transcription (Whisper API) → transcript with timestamps
3. Clip Detection (OpenRouter/Claude) → detected clips with start/end times
4. Focal Point Detection (NEW - Cloud Vision) → for each detected clip:
   a. Check for existing focal points in same time range
   b. Detect new focal points only for uncovered segments
   c. Link focal points to clip_id and raw_video_id
5. Return results (clips + transcript + focal points)
```

### Per-Clip Focal Point Strategy

For each detected clip:

1. **Check existing coverage**:

   - Query `focal_points` table for entries matching raw_video_id in clip's time range
   - Calculate coverage percentage (existing focal point timestamps vs clip duration)
   - If ≥80% coverage exists, reuse existing focal points (skip detection)

2. **Sample frames** only within clip's time range:

   - Start: 0.5s after clip start_time
   - Middle: Every 3-5 seconds within clip duration
   - End: 0.5s before clip end_time
   - Adaptive: More samples for longer clips (e.g., 60s clip = ~15 frames)

3. **Detect faces** using cloud vision API:

   - Extract frames at sample timestamps using FFmpeg
   - Send each frame to cloud API for face detection
   - Parse bounding boxes and confidence scores

4. **Select focal point** per frame:

   - One face: use face center as focal point
   - Multiple faces: use largest/most centered face (likely active speaker)
   - No faces: fallback to center (0.5, 0.5) with low confidence

5. **Store results**:

   - Save to `focal_points` table with both clip_id and raw_video_id
   - Include time_offset (relative to video start), focal_x, focal_y, confidence

### Database Schema Updates

**Modify `focal_points` table**:

```sql
ALTER TABLE focal_points ADD COLUMN clip_id TEXT REFERENCES clips(id) ON DELETE CASCADE;
CREATE INDEX idx_focal_points_clip ON focal_points(clip_id);
```

This allows:

- Linking focal points to specific clips
- Querying focal points by clip_id OR raw_video_id
- Finding overlapping focal points by time_offset for reuse

### Overlap Detection Algorithm

```elixir
def get_existing_focal_points_in_range(raw_video_id, start_time, end_time) do
  # Query focal_points where:
  # - raw_video_id matches
  # - time_offset between start_time and end_time
  # Returns list of existing focal points with timestamps
end

def needs_detection?(clip, existing_focal_points) do
  # Calculate coverage: how much of clip duration has focal points?
  coverage = calculate_coverage(clip.start_time, clip.end_time, existing_focal_points)
  coverage < 0.8  # Need detection if less than 80% coverage
end
```

### Cloud API Selection

Support both with configuration:

**Google Cloud Vision API**

- Endpoint: `vision.googleapis.com/v1/images:annotate`
- Method: `FACE_DETECTION` feature
- Cost: $1.50 per 1000 images (first 1000 free/month)

**AWS Rekognition**

- Service: `rekognition.DetectFaces`
- Cost: $1.00 per 1000 images (first 5000 free/month)

**Cost estimate**:

- 30-second clip = ~8 frames = $0.008-0.012
- 100 clips = $0.80-1.20 per detection run
- Overlaps reduce cost significantly on subsequent runs

## Key Files to Create/Modify

### Server (Elixir) - NEW FILES

1. **`server/priv/repo/migrations/XXX_add_clip_id_to_focal_points.exs`** - NEW

   - Add clip_id column to focal_points table
   - Add index on clip_id
   - Allow NULL for backward compatibility

2. **`server/lib/clippster_server/ai/vision_api.ex`** - NEW

   - Cloud vision API client (Google Vision + AWS Rekognition)
   - Frame-to-API request conversion
   - Bounding box parsing and normalization
   - Error handling and retries

3. **`server/lib/clippster_server/focal_detection.ex`** - NEW

   - Orchestrate focal point detection for clips
   - Check for existing focal points (overlap detection)
   - Frame sampling strategy (timestamp calculation)
   - FFmpeg frame extraction at specific timestamps
   - Coordinate normalization (pixels → 0.0-1.0)
   - Batch processing of multiple clips

### Server (Elixir) - MODIFY

4. **`server/lib/clippster_server_web/controllers/clips_controller.ex`**

   - After OpenRouter returns detected clips, call focal detection
   - Pass detected clips + raw_video_path to focal detection module
   - Include focal points in API response (grouped by clip_id)
   - Make non-blocking: focal detection errors don't fail clip detection
   - Add optional parameter to skip focal detection (for testing)

### Server (Elixir) - CONFIGURATION

5. **`server/config/config.exs`** (or runtime.exs)

   - Add vision provider config (`:google` or `:aws`)
   - Add API credentials from environment variables

### Client (TypeScript) - MODIFY

6. **`client/src-tauri/migrations/028_add_clip_id_to_focal_points.sql`** - NEW

   - Mirror server migration for SQLite schema
   - Add clip_id column with index

7. **`client/src/services/database/types.ts`**

   - Update FocalPoint type to include optional clip_id

8. **`client/src/services/database/focal-points.ts`**

   - Add function to query focal points by clip_id
   - Update bulkCreateFocalPoints to accept clip_id parameter

9. **`client/src/services/database/clip-detection.ts`**

   - Update `persistClipDetectionResults` to handle focal points from server
   - Store focal points with clip_id linkage
   - Group focal points by clip when persisting

10. **`client/src/composables/useChunkedClipDetection.ts`**

    - Remove old background focal detection calls (lines 67-71, 316-320)
    - Handle focal_points in server response
    - Pass focal points to persistClipDetectionResults

### Client (Rust/TypeScript) - REMOVE

11. **Remove old implementation files**:

    - `client/src-tauri/src/focal_detection.rs`
    - `client/src-tauri/src/commands/focal_detection_commands.rs`
    - `client/src/composables/useFocalPointDetection.ts`
    - Update `client/src-tauri/src/lib.rs` to remove focal detection imports
    - Update `client/src-tauri/src/commands/mod.rs` to remove module

### Environment Configuration

12. **`server/.env`** and **documentation**

    - `VISION_PROVIDER=google` (or `aws`)
    - `GOOGLE_VISION_API_KEY=xxx` (if using Google)
    - `AWS_ACCESS_KEY_ID=xxx`, `AWS_SECRET_ACCESS_KEY=xxx`, `AWS_REGION=xxx` (if AWS)

## Implementation Details

### Frame Extraction (FFmpeg)

```elixir
# Extract single frame at specific timestamp
ffmpeg -ss {timestamp} -i {video_path} -vframes 1 -f image2pipe -vcodec png -
```

### API Request Structure (Google Vision)

```json
{
  "requests": [{
    "image": {"content": "base64_encoded_frame"},
    "features": [{"type": "FACE_DETECTION", "maxResults": 10}]
  }]
}
```

### Overlap Detection Example

```
Run 1: Clip A (0-30s) → detect 10 focal points
Run 2: Clip B (20-50s) → check for focal points in 20-30s
        Found 5 focal points covering 20-30s
        Only detect focal points for 30-50s (new segment)
```

## Benefits of Per-Clip Approach

| Aspect | Old (whole video) | New (per-clip) |

|--------|------------------|----------------|

| Detection timing | During transcription | After clip detection |

| Scope | Entire video | Only detected clips |

| Efficiency | Wastes effort on unused segments | Only detects relevant segments |

| Reuse | No overlap detection | Smart reuse across runs |

| Cost | Higher (full video) | Lower (clips only) |

| Accuracy | Border detection only | Face detection for speakers |

| Clip association | Requires inference | Direct clip_id linkage |

## Testing Strategy

1. **Single run test**: Detect clips, verify focal points generated for each clip
2. **Overlap test**: Run detection twice with overlapping clips, verify reuse
3. **Multi-speaker**: Test with video containing multiple speakers
4. **No faces**: Test with screen recordings or non-face content (verify fallback)
5. **Long clips**: Test with 5+ minute clips (verify sampling strategy)
6. **API failures**: Test error handling (invalid keys, rate limits)
7. **Playback**: Verify focal points display correctly in video player