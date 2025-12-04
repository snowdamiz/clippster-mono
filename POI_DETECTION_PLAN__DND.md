# AI Speaker/POI Detection Implementation

## Architecture Overview

The system detects speakers and points-of-interest at **export time** for 9:16 clips, analyzes the video content type, and automatically applies the optimal framing strategy (split screen or dynamic panning).

## Core Components

### 1. Server-Side Detection (Elixir)

**New Files:**

- [`server/lib/clippster_server/ai/vision_api.ex`](server/lib/clippster_server/ai/vision_api.ex) - Cloud Vision API client (Google Vision + AWS Rekognition support)
- [`server/lib/clippster_server/ai/speaker_detection.ex`](server/lib/clippster_server/ai/speaker_detection.ex) - Face detection orchestration with frame sampling
- [`server/lib/clippster_server/ai/layout_analyzer.ex`](server/lib/clippster_server/ai/layout_analyzer.ex) - Video content classification (talking head, gaming, IRL, multi-speaker)
- [`server/lib/clippster_server/ai/framing_strategy.ex`](server/lib/clippster_server/ai/framing_strategy.ex) - Layout decision engine that outputs framing instructions

**API Endpoint:**

```elixir
POST /api/clips/:id/analyze-speakers
# Request: { video_path, start_time, end_time, sample_interval: 2 }
# Response: { strategy: "split_screen|pan|static", speakers: [...], regions: [...] }
```

### 2. Client-Side FFmpeg Integration (Rust)

**Modify:** [`client/src-tauri/src/clips/types.rs`](client/src-tauri/src/clips/types.rs)

```rust
pub struct FramingStrategy {
    pub mode: FramingMode,          // SplitScreen | DynamicPan | StaticCrop
    pub speakers: Vec<SpeakerRegion>,
    pub content_regions: Vec<ContentRegion>,
    pub layout: Option<SplitLayout>,
}

pub enum FramingMode { SplitScreen, DynamicPan, StaticCrop }
pub struct SplitLayout { top_region: Region, bottom_region: Region, ratio: f32 }
```

**Modify:** [`client/src-tauri/src/clips/video_processor.rs`](client/src-tauri/src/clips/video_processor.rs)

Add new functions:

- `build_split_screen_clip()` - FFmpeg filter for stacking two video regions vertically
- `build_dynamic_pan_clip()` - Smooth panning using keyframe-based crop positions
- `apply_framing_strategy()` - Router that selects the appropriate build function

### 3. Database Schema

**New Migration:** [`client/src-tauri/migrations/028_add_speaker_detections.sql`](client/src-tauri/migrations/028_add_speaker_detections.sql)

```sql
CREATE TABLE speaker_detections (
  id TEXT PRIMARY KEY,
  clip_id TEXT NOT NULL,
  time_offset REAL NOT NULL,
  speaker_index INTEGER NOT NULL,
  bbox_x REAL, bbox_y REAL, bbox_w REAL, bbox_h REAL,
  confidence REAL,
  is_speaking INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (clip_id) REFERENCES clips(id) ON DELETE CASCADE
);

CREATE TABLE framing_strategies (
  id TEXT PRIMARY KEY,
  clip_id TEXT UNIQUE NOT NULL,
  mode TEXT NOT NULL,  -- 'split_screen', 'dynamic_pan', 'static_crop'
  layout_data TEXT,    -- JSON with regions, ratios
  video_type TEXT,     -- 'talking_head', 'gaming', 'irl', 'multi_speaker'
  created_at INTEGER NOT NULL,
  FOREIGN KEY (clip_id) REFERENCES clips(id) ON DELETE CASCADE
);
```

### 4. Layout Analysis Logic

**Video Type Classification Algorithm:**

```
1. Face Detection Pass:
   - Sample frames every 2 seconds
   - Detect faces using Cloud Vision API
   - Track face positions and sizes across frames

2. Content Analysis:
   - Face movement variance (high = IRL, low = static)
   - Face count distribution (1 speaker vs multi)
   - Face position in frame (centered = talking head, corner = gaming)
   - Screen regions without faces (potential game/content area)

3. Strategy Selection:
   ┌─────────────────────────────────────────────────────────────┐
   │ Condition                        │ Strategy                 │
   ├─────────────────────────────────────────────────────────────┤
   │ 1 face, corner position,         │ SPLIT_SCREEN            │
   │ large non-face region            │ (speaker bottom,        │
   │                                   │  content top)           │
   ├─────────────────────────────────────────────────────────────┤
   │ 1 face, centered, low movement   │ STATIC_CROP             │
   │                                   │ (center on face)        │
   ├─────────────────────────────────────────────────────────────┤
   │ 1 face, high movement            │ DYNAMIC_PAN             │
   │                                   │ (follow face smoothly)  │
   ├─────────────────────────────────────────────────────────────┤
   │ 2-3 faces, same region           │ STATIC_CROP             │
   │                                   │ (widen to include all)  │
   ├─────────────────────────────────────────────────────────────┤
   │ 2-3 faces, different regions     │ SPLIT_SCREEN            │
   │                                   │ (show both regions)     │
   └─────────────────────────────────────────────────────────────┘
```

### 5. Build Pipeline Integration

**Modify:** [`client/src-tauri/src/clips/orchestrator.rs`](client/src-tauri/src/clips/orchestrator.rs)

```rust
// Before building 9:16 clip:
if aspect_ratio.is_portrait() {
    // 1. Call server API to analyze speakers
    let strategy = analyze_speakers(&app, &video_path, start, end).await?;
    
    // 2. Route to appropriate builder based on strategy
    match strategy.mode {
        FramingMode::SplitScreen => build_split_screen_clip(...),
        FramingMode::DynamicPan => build_dynamic_pan_clip(...),
        FramingMode::StaticCrop => build_static_crop_clip(...),
    }
}
```

### 6. FFmpeg Filter Implementations

**Split Screen Filter:**

```
[0:v]split=2[top][bottom];
[top]crop=iw:ih*0.5:0:0,scale=1080:960[t];
[bottom]crop=iw:ih*0.5:0:ih*0.5,scale=1080:960[b];
[t][b]vstack=inputs=2[out]
```

**Dynamic Pan Filter (keyframe-based):**

```
crop=w=in_h*9/16:h=in_h:x='lerp(x1,x2,t)':y=0
```

Where x1/x2 are calculated from speaker positions at keyframes.

## Implementation Order

1. **Server**: Vision API client + speaker detection endpoint
2. **Database**: Add migrations for speaker_detections and framing_strategies
3. **Rust**: Add FramingStrategy types and split screen builder
4. **Rust**: Add dynamic pan builder with keyframe interpolation
5. **Rust**: Integrate with orchestrator for 9:16 exports
6. **Testing**: Test with various video types (gaming, IRL, podcast)

## Cost Estimation

- Google Vision API: ~$1.50 per 1000 images
- 30-second clip at 2-second intervals = 15 frames = ~$0.02 per clip
- Detection cached per clip, re-analyzed only on re-export