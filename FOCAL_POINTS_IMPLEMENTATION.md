# Focal Point Detection - Implementation Summary

## Overview
Focal point detection has been implemented and integrated into the video playback system. The feature uses FFmpeg's `cropdetect` filter to detect content boundaries and frame video content across different aspect ratios (16:9, 9:16, 1:1, 4:5).

## ⚠️ Current Limitations

**FFmpeg's `cropdetect` is NOT capable of speaker or face detection.** It only detects:
- Black bars and borders (letterboxing/pillarboxing)
- Content boundaries where there's empty space

**What it CANNOT detect:**
- ❌ Speakers or faces
- ❌ Regions of interest
- ❌ Moving subjects
- ❌ Scene composition

**Result:** If your video has no black borders, all focal points will be centered (0.5, 0.5). This is expected behavior with the current implementation.

## Key Changes Made

### 1. Visual Feedback Added ✨
The video player now includes **real-time visual indicators** to verify focal points are working:

#### Debug Display (Top-Right Corner)
- Shows current focal point coordinates in real-time: `Focal: X%, Y%`
- Updates continuously during playback
- Positioned at top-right of video player

#### Red Crosshair Indicator
- Appears when focal point deviates from center (>5% in either direction)
- Shows exactly where the focal point is positioned
- Includes crosshair lines and center dot for precise visualization
- Moves smoothly as focal points change

### 2. Smooth Panning Transition
Added CSS transition to make focal point changes visible:
```css
.video-with-focal-point {
  transition: object-position 1.5s ease-in-out;
}
```
- Video content smoothly pans to new focal points over 1.5 seconds
- Uses ease-in-out easing for natural movement
- Makes focal point changes clearly visible during playback

### 3. Enhanced Debug Logging
Added comprehensive console logging:
- Logs when focal points are loaded: `[VideoFocalPoint] Loaded X focal points`
- Logs significant focal point changes during playback
- Shows time, coordinates, and interpolation progress
- Helps verify focal points are being detected and used

## How Focal Points Work

### Detection Phase (During Clip Detection)
1. When clip detection runs, focal point detection triggers in background
2. FFmpeg's `cropdetect` filter analyzes video at 5-second intervals
3. Detects content boundaries and calculates center of interest
4. Stores focal points in SQLite with time offsets and coordinates (0.0-1.0 normalized)

### Playback Phase
1. When video loads, focal points are fetched from database
2. As video plays, focal point is interpolated between stored points based on current time
3. VideoPlayer applies focal point via CSS `object-position` property
4. Video content pans smoothly to follow focal points
5. Works across all aspect ratios (16:9, 9:16, 1:1, 4:5)

## How to Verify It's Working

### Step 1: Run Clip Detection
1. Open a project with a video
2. Click "Detect Clips" button
3. Focal point detection runs in background (check console logs)
4. Look for: `[FocalDetection] Starting focal point detection...`
5. Look for: `[FocalDetection] Detected X focal points`

### Step 2: Verify Database Storage
Check the console for:
```
[FocalPointDetection] Detection completed, found: X
[FocalPointDetection] Stored focal points in database
```

### Step 3: Watch Video Playback
1. Play the video in the project workspace
2. **Look for the debug display** in top-right corner showing focal point coordinates
3. **Watch for the red crosshair** if focal point moves away from center
4. **Observe smooth panning** as video content adjusts to follow focal points
5. Check console logs for interpolation updates

### Step 4: Test Different Aspect Ratios
1. Use the aspect ratio selector (16:9, 9:16, 1:1, 4:5)
2. Notice how the same focal points intelligently frame content in each ratio
3. The video content should stay centered on the focal point regardless of aspect ratio

## Console Log Examples

### Successful Detection:
```
[FocalDetection] Starting focal point detection for: /path/to/video.mp4
[FocalDetection] Video info: 1920x1080, duration: 120.50s, fps: 30.00
[FocalDetection] Frame interval: 150 frames
[FocalDetection] Detected 24 focal points
[FocalPointDetection] Detection completed, found: 24
[FocalPointDetection] Stored focal points in database
```

### During Playback:
```
[VideoFocalPoint] Loaded 24 focal points
[VideoFocalPoint] First focal point: {time_offset: 0, focal_x: 0.52, focal_y: 0.48, confidence: 0.87}
[VideoFocalPoint] Time: 5.2s, Focal: (0.523, 0.482), Progress: 4.2%
[VideoFocalPoint] Time: 10.5s, Focal: (0.487, 0.515), Progress: 10.0%
```

## Troubleshooting

### Focal Points Not Detected
- Check if FFmpeg is available: `ffmpeg -version`
- Verify video file is valid and accessible
- Check Rust console for errors during detection

### Focal Points Not Applied During Playback
- Check browser console for focal point loading logs
- Verify database contains focal points: Check `focal_points` table
- Ensure `currentTime` is updating during video playback
- Look for the debug display in top-right corner

### No Visual Changes
- Focal points may be near center (50%, 50%)
- Try videos with off-center subjects for more dramatic effect
- Check if crosshair appears (only shows when >5% from center)
- Verify CSS transition is applied (check DevTools)

## Database Schema

### focal_points Table
```sql
CREATE TABLE focal_points (
  id TEXT PRIMARY KEY,
  raw_video_id TEXT NOT NULL,
  time_offset REAL NOT NULL,
  focal_x REAL NOT NULL CHECK(focal_x >= 0.0 AND focal_x <= 1.0),
  focal_y REAL NOT NULL CHECK(focal_y >= 0.0 AND focal_y <= 1.0),
  confidence REAL CHECK(confidence >= 0.0 AND confidence <= 1.0),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (raw_video_id) REFERENCES raw_videos(id) ON DELETE CASCADE
);
```

### Indexes
- `idx_focal_points_raw_video` on `raw_video_id`
- `idx_focal_points_time` on `(raw_video_id, time_offset)`

## Files Modified/Created

### New Files
1. `client/src-tauri/migrations/027_add_focal_points.sql` - Database schema
2. `client/src-tauri/src/focal_detection.rs` - Rust FFmpeg integration
3. `client/src-tauri/src/commands/focal_detection_commands.rs` - Tauri command
4. `client/src/services/database/focal-points.ts` - Database CRUD operations
5. `client/src/composables/useFocalPointDetection.ts` - Detection composable
6. `client/src/composables/useVideoFocalPoint.ts` - Playback composable

### Modified Files
1. `client/src/services/database/types.ts` - Added FocalPoint type
2. `client/src/services/database.ts` - Added focal point exports
3. `client/src-tauri/src/lib.rs` - Registered command and migration
4. `client/src-tauri/src/commands/mod.rs` - Added focal detection module
5. `client/src/composables/useChunkedClipDetection.ts` - Integrated detection
6. `client/src/components/ProjectWorkspaceDialog.vue` - Applied focal points
7. `client/src/components/VideoPlayer.vue` - Added visual feedback and transition

## Technical Details

### FFmpeg Detection Process
Uses `cropdetect` filter to analyze content boundaries:
```bash
ffmpeg -i video.mp4 -vf "select='not(mod(n\,150))',cropdetect=24:16:0" -f null -
```
- Samples every 150 frames (5 seconds at 30fps)
- Detects crop boundaries with tolerance
- Calculates center of detected content as focal point
- Returns normalized coordinates (0.0-1.0)

### Interpolation Algorithm
Linear interpolation between focal points:
1. Find nearest focal points before and after current time
2. Calculate time delta and progress
3. Interpolate X and Y coordinates
4. Apply smoothly via CSS transition

### CSS Application
Focal point applied via `object-position`:
```css
object-position: {focalX * 100}% {focalY * 100}%;
```
- Works with `object-fit: cover`
- Positions video content relative to container
- Centers focal point in visible area
- Works across all aspect ratios

## Performance Considerations

- Detection runs in background (non-blocking)
- Focal points cached in SQLite (loaded once per video)
- Interpolation is lightweight (computed property)
- CSS transitions handled by GPU
- Minimal performance impact on playback

## Future Enhancements for Proper Speaker Detection

### Option 1: FFmpeg Face Detection
Replace cropdetect with FFmpeg's face detection:
```rust
ffmpeg -i video.mp4 -vf "find_rect=object=face.xml" -f null -
```
**Pros:** Built-in, no external deps  
**Cons:** Requires cascade file, less accurate than ML

### Option 2: OpenCV Integration
Use OpenCV for face/object detection:
- DNN module with pre-trained models
- Real-time face tracking
- Multi-face support

**Pros:** Accurate, well-supported  
**Cons:** Large dependency, slower processing

### Option 3: ML-Based Detection
Integrate machine learning models:
- YOLOv8 for object detection
- MediaPipe for face landmarks
- Custom trained models for specific use cases

**Pros:** Most accurate, flexible  
**Cons:** Complex integration, requires GPU for speed

### Option 4: Hybrid Approach
Combine multiple techniques:
1. Audio analysis for speaker detection
2. Visual face detection for positioning
3. Motion tracking for dynamic scenes
4. Fallback to center when uncertain

**Pros:** Best quality, robust  
**Cons:** Most complex implementation

### Other Improvements
1. Make debug indicators toggleable via settings
2. Add focal point editing UI for manual adjustment
3. Add confidence-based weighting for interpolation
4. Add focal point visualization in timeline
5. Support user-defined regions of interest

## Summary

The focal point detection **infrastructure is fully implemented**, but the **current detection algorithm (cropdetect) has significant limitations**:

### What Works ✅
- Database schema and storage
- Tauri command integration  
- Real-time interpolation during playback
- Visual debug indicators
- Smooth CSS transitions
- Multi-aspect ratio support

### Current Limitation ⚠️
**cropdetect only detects black borders, not speakers or faces.** For videos without black bars, all focal points will be centered (0.5, 0.5).

### To Get Speaker Detection
You need to implement one of the future enhancements (Options 1-4 above). The infrastructure is ready - you just need to replace the detection algorithm in `focal_detection.rs`.

### Use Cases Where Current Implementation Works
- Videos with letterboxing/pillarboxing (black bars)
- Videos with significant empty space around content
- Manually adjusted focal points (if you add editing UI)

### Use Cases That Need Enhanced Detection
- ❌ Speaker tracking in interviews/podcasts
- ❌ Face-following for vlogs
- ❌ Dynamic scene composition
- ❌ Multi-person tracking

