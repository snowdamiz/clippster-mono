# Audio Controls Implementation

## Overview

Implement basic audio controls (volume/gain, normalize, fade in/out) for video preview and clip export. Settings are stored per-project and applied using Web Audio API for real-time preview and FFmpeg for final builds.

## Architecture

**Data Flow:**

1. User adjusts controls in Audio tab → saves to database per project
2. Preview: Web Audio API processes video element audio in real-time
3. Export: Audio settings passed to Rust backend → FFmpeg applies filters during build

## Implementation Steps

### 1. Database Schema

**File:** `client/src-tauri/migrations/029_add_audio_settings.sql` (new file)

Add `audio_settings` column to `projects` table to store JSON:

```sql
ALTER TABLE projects ADD COLUMN audio_settings TEXT;
```

Default settings structure:

```json
{
  "volume": 0,          // dB adjustment (-20 to +20)
  "normalize": false,   // audio normalization
  "fadeIn": 0,          // fade in duration (seconds)
  "fadeOut": 0          // fade out duration (seconds)
}
```

### 2. TypeScript Types

**File:** `client/src/services/database/types.ts`

Add interface and update Project type:

```typescript
export interface AudioSettings {
  volume: number;        // dB gain (-20 to +20)
  normalize: boolean;    // enable audio normalization
  fadeIn: number;        // fade in duration in seconds (0-5)
  fadeOut: number;       // fade out duration in seconds (0-5)
}

export interface Project {
  // ... existing fields
  audio_settings: string | null;  // JSON string
}
```

### 3. Database Functions

**File:** `client/src/services/database/audio-settings.ts` (new file)

Create functions:

- `getProjectAudioSettings(projectId: string): Promise<AudioSettings>`
- `updateProjectAudioSettings(projectId: string, settings: AudioSettings): Promise<void>`
- `getDefaultAudioSettings(): AudioSettings` - returns default values

Export from `client/src/services/database.ts`.

### 4. Web Audio API Composable

**File:** `client/src/composables/useWebAudio.ts` (new file)

Create composable for real-time audio processing:

- Accept: HTMLVideoElement ref, AudioSettings ref
- Create: AudioContext, MediaElementSourceNode, GainNode
- Methods:
  - `connectToVideo(videoElement: HTMLVideoElement)` - connect Web Audio chain
  - `disconnectFromVideo()` - cleanup
  - `applySettings(settings: AudioSettings)` - update gain, apply filters
  - `calculateGainValue(db: number): number` - convert dB to gain multiplier

Key implementation notes:

- Use `createMediaElementSource()` to intercept video audio
- Chain: video → sourceNode → gainNode → destination
- Convert dB to linear gain: `gain = 10^(dB/20)`
- Fade in/out handled visually (show indicator, actual fade applied in FFmpeg)
- Normalization flag stored but processed only in FFmpeg

### 5. Audio Tab UI

**File:** `client/src/components/MediaPanel.vue`

Replace Audio tab placeholder (lines 472-499) with:

**Controls:**

1. **Volume/Gain Slider**

   - Range: -20 dB to +20 dB
   - Display current value with unit
   - Visual indicator at 0 dB (no change)
   - Reset button

2. **Normalize Toggle**

   - Switch component
   - Info tooltip: "Normalize audio levels to target loudness"
   - Note: Applied only on export, not in preview

3. **Fade In Duration**

   - Range: 0 to 5 seconds
   - Step: 0.1 seconds
   - Applied only on export

4. **Fade Out Duration**

   - Range: 0 to 5 seconds
   - Step: 0.1 seconds
   - Applied only on export

**Layout:**

- Similar styling to Subtitles tab
- Grouped sections with headers
- Real-time preview indicator (green badge when audio chain active)
- Warning badge for normalize/fade (not previewed)

**State Management:**

- Load settings from database on mount
- Auto-save on change (debounced 500ms)
- Show success toast on save

### 6. VideoPlayer Integration

**File:** `client/src/components/VideoPlayer.vue`

Add audio processing:

- Import and use `useWebAudio` composable
- Accept new prop: `audioSettings?: AudioSettings`
- Watch videoElement and audioSettings, call `applySettings()` on changes
- Cleanup audio chain on unmount

**File:** `client/src/components/ProjectWorkspaceDialog.vue`

- Load audio settings from database for project
- Pass to VideoPlayer as prop
- Watch for changes from MediaPanel

### 7. Rust Backend Integration

**File:** `client/src-tauri/src/clips.rs`

Update `build_clip_from_segments` function:

- Add parameter: `audio_settings: Option<AudioSettings>`
- Pass to `build_single_segment_clip_with_settings` and `build_multi_segment_clip_with_settings`

Add struct:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioSettings {
    pub volume: f64,
    pub normalize: bool,
    pub fade_in: f64,
    pub fade_out: f64,
}
```

Update FFmpeg args in both build functions to include audio filters:

```rust
// Build audio filter string
let mut audio_filters = vec![];

// Volume adjustment
if audio_settings.volume != 0.0 {
    audio_filters.push(format!("volume={}dB", audio_settings.volume));
}

// Fade in
if audio_settings.fade_in > 0.0 {
    audio_filters.push(format!("afade=t=in:st=0:d={}", audio_settings.fade_in));
}

// Fade out (calculate start time based on segment duration)
if audio_settings.fade_out > 0.0 {
    let fade_start = duration - audio_settings.fade_out;
    if fade_start > 0.0 {
        audio_filters.push(format!("afade=t=out:st={}:d={}", fade_start, audio_settings.fade_out));
    }
}

// Normalization (loudnorm filter)
if audio_settings.normalize {
    audio_filters.push("loudnorm=I=-16:TP=-1.5:LRA=11".to_string());
}

// Add to FFmpeg args
if !audio_filters.is_empty() {
    args.push("-af".to_string());
    args.push(audio_filters.join(","));
}
```

**File:** `client/src/components/MediaPanel.vue`

Update `onBuildConfirm` function:

- Load project audio settings from database
- Pass to `invoke('build_clip_from_segments', { audioSettings: ... })`

### 8. Testing Checklist

**Preview Testing:**

- [ ] Volume slider adjusts audio in real-time
- [ ] 0 dB produces no change
- [ ] -20 dB significantly quieter
- [ ] +20 dB significantly louder
- [ ] Audio chain reconnects when switching videos
- [ ] No audio distortion or clipping

**Export Testing:**

- [ ] Volume adjustment applied to built clips
- [ ] Normalize produces consistent loudness
- [ ] Fade in/out durations accurate
- [ ] Settings persist across sessions
- [ ] Multiple aspect ratios work correctly
- [ ] Multi-segment clips process correctly

**Edge Cases:**

- [ ] Fade durations longer than clip (should clamp)
- [ ] Extreme volume values (+20, -20)
- [ ] Switching between projects loads correct settings
- [ ] Audio chain cleanup prevents memory leaks

## Files to Create

1. `client/src-tauri/migrations/029_add_audio_settings.sql`
2. `client/src/services/database/audio-settings.ts`
3. `client/src/composables/useWebAudio.ts`

## Files to Modify

1. `client/src/services/database/types.ts` - Add AudioSettings interface
2. `client/src/services/database.ts` - Export audio settings functions
3. `client/src/components/MediaPanel.vue` - Replace Audio tab placeholder
4. `client/src/components/VideoPlayer.vue` - Integrate Web Audio processing
5. `client/src/components/ProjectWorkspaceDialog.vue` - Load and pass audio settings
6. `client/src-tauri/src/clips.rs` - Add AudioSettings struct and FFmpeg filters
7. `client/src/types/index.ts` - Re-export AudioSettings type (if not already)

## Technical Notes

- Web Audio API requires user interaction to start; video play initiates context
- Normalization preview not feasible (requires full-pass analysis)
- Fade preview not implemented (would require complex timing logic)
- dB to gain formula: `gain = 10^(dB/20)` or `Math.pow(10, db / 20)`
- FFmpeg loudnorm: `-16 LUFS` target (industry standard for streaming)
- Audio filters applied before encoding ensures quality