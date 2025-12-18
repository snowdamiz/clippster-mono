# 📽️ Video Editor Feature - Comprehensive Implementation Plan

> **Status**: Planning Phase  
> **Created**: December 10, 2025  
> **Last Updated**: December 10, 2025

---

## Executive Summary

Building a full-featured video editor like CapCut into the existing Clippster application is a **substantial undertaking** but achievable given the existing foundation. The current codebase already has:

- ✅ FFmpeg integration with hardware acceleration
- ✅ Timeline component with segment manipulation
- ✅ Video playback infrastructure
- ✅ Subtitle/watermark rendering
- ✅ Tauri + Vue architecture
- ✅ SQLite database layer

**Estimated Effort**: 3-6 months for a feature-complete MVP with a small team  
**Complexity**: High (8/10)

---

## Table of Contents

1. [Phase 1: Foundation & Architecture](#phase-1-foundation--architecture-2-3-weeks)
2. [Phase 2: Multi-Track Timeline](#phase-2-multi-track-timeline-3-4-weeks)
3. [Phase 3: Canvas Preview](#phase-3-canvas-preview-2-3-weeks)
4. [Phase 4: Media Management](#phase-4-media-management-2-weeks)
5. [Phase 5: Effects & Filters](#phase-5-effects--filters-3-4-weeks)
6. [Phase 6: Text & Titles](#phase-6-text--titles-2-3-weeks)
7. [Phase 7: Transitions](#phase-7-transitions-2-weeks)
8. [Phase 8: Export Pipeline](#phase-8-export-pipeline-2-3-weeks)
9. [Phase 9: Stickers & Assets](#phase-9-stickers--assets-1-2-weeks)
10. [Phase 10: Audio Features](#phase-10-audio-features-2-weeks)
11. [Technical Considerations](#technical-considerations)
12. [File Structure Summary](#file-structure-summary)
13. [Effort Estimation](#effort-estimation)
14. [MVP Scope](#recommended-mvp-scope-phase-1-release)
15. [Risks & Challenges](#risks--challenges)

---

## Phase 1: Foundation & Architecture (2-3 weeks)

### 1.1 New Route & Page Structure

```
/editor                    → Editor page
/editor/:projectId         → Edit specific project
/editor/new                → New editor project
```

**Files to create:**
- `client/src/pages/Editor.vue` - Main editor page
- `client/src/layouts/EditorLayout.vue` - Full-screen editor layout (no sidebar)

### 1.2 Editor Project Data Model

**New database tables:**

```sql
-- editor_projects: Main editor project container
CREATE TABLE editor_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  thumbnail_path TEXT,
  canvas_width INTEGER DEFAULT 1920,
  canvas_height INTEGER DEFAULT 1080,
  fps INTEGER DEFAULT 30,
  duration REAL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- editor_tracks: Tracks on the timeline (video, audio, text, sticker)
CREATE TABLE editor_tracks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES editor_projects(id),
  track_type TEXT NOT NULL, -- 'video', 'audio', 'text', 'sticker', 'effect'
  track_index INTEGER NOT NULL, -- vertical position on timeline
  name TEXT,
  is_locked BOOLEAN DEFAULT FALSE,
  is_visible BOOLEAN DEFAULT TRUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- editor_clips: Media items placed on tracks
CREATE TABLE editor_clips (
  id TEXT PRIMARY KEY,
  track_id TEXT NOT NULL REFERENCES editor_tracks(id),
  source_type TEXT NOT NULL, -- 'vod', 'clip', 'audio', 'image', 'text', 'sticker'
  source_id TEXT, -- reference to source (raw_video_id, clip_id, asset_id)
  source_path TEXT, -- file path for imported media
  timeline_start REAL NOT NULL, -- position on timeline in seconds
  timeline_duration REAL NOT NULL, -- duration on timeline
  source_start REAL DEFAULT 0, -- trim start point in source
  source_end REAL, -- trim end point in source
  volume REAL DEFAULT 1.0, -- audio volume multiplier
  speed REAL DEFAULT 1.0, -- playback speed
  opacity REAL DEFAULT 1.0,
  transform_x REAL DEFAULT 0, -- position offset
  transform_y REAL DEFAULT 0,
  scale_x REAL DEFAULT 1.0,
  scale_y REAL DEFAULT 1.0,
  rotation REAL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- editor_transitions: Transitions between clips
CREATE TABLE editor_transitions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES editor_projects(id),
  transition_type TEXT NOT NULL, -- 'fade', 'dissolve', 'wipe', 'slide', etc.
  clip_a_id TEXT REFERENCES editor_clips(id),
  clip_b_id TEXT REFERENCES editor_clips(id),
  duration REAL DEFAULT 0.5,
  params TEXT, -- JSON for transition-specific parameters
  created_at INTEGER NOT NULL
);

-- editor_effects: Effects applied to clips
CREATE TABLE editor_effects (
  id TEXT PRIMARY KEY,
  clip_id TEXT NOT NULL REFERENCES editor_clips(id),
  effect_type TEXT NOT NULL, -- 'filter', 'color_correct', 'blur', 'speed_ramp', etc.
  params TEXT NOT NULL, -- JSON parameters
  keyframes TEXT, -- JSON array of keyframes for animation
  order_index INTEGER DEFAULT 0,
  is_enabled BOOLEAN DEFAULT TRUE,
  created_at INTEGER NOT NULL
);

-- editor_text_styles: Text overlay configurations
CREATE TABLE editor_text_styles (
  id TEXT PRIMARY KEY,
  clip_id TEXT NOT NULL REFERENCES editor_clips(id),
  content TEXT NOT NULL,
  font_family TEXT DEFAULT 'Montserrat',
  font_size INTEGER DEFAULT 48,
  font_weight INTEGER DEFAULT 700,
  color TEXT DEFAULT '#FFFFFF',
  background_color TEXT,
  stroke_color TEXT,
  stroke_width REAL DEFAULT 0,
  alignment TEXT DEFAULT 'center',
  animation_in TEXT,
  animation_out TEXT,
  animation_params TEXT -- JSON
);

-- editor_keyframes: Animation keyframes for any property
CREATE TABLE editor_keyframes (
  id TEXT PRIMARY KEY,
  clip_id TEXT NOT NULL REFERENCES editor_clips(id),
  property TEXT NOT NULL, -- 'opacity', 'scale', 'position_x', 'volume', etc.
  time REAL NOT NULL, -- time relative to clip start
  value REAL NOT NULL,
  easing TEXT DEFAULT 'linear', -- 'linear', 'ease-in', 'ease-out', 'bezier'
  bezier_params TEXT -- control points for bezier curves
);
```

### 1.3 Core State Management

**New Pinia store:** `client/src/stores/editor.ts`

```typescript
interface EditorState {
  project: EditorProject | null;
  tracks: EditorTrack[];
  clips: EditorClip[];
  selectedClipIds: Set<string>;
  playheadPosition: number;
  isPlaying: boolean;
  zoomLevel: number;
  scrollPosition: number;
  canvasSize: { width: number; height: number };
  undoStack: EditorAction[];
  redoStack: EditorAction[];
  clipboard: EditorClip[];
}
```

---

## Phase 2: Multi-Track Timeline (3-4 weeks)

### 2.1 Timeline Architecture

The timeline needs to support multiple tracks stacked vertically. The existing `Timeline.vue` is a good starting point but needs major refactoring.

**New components:**

```
client/src/components/editor/
├── EditorTimeline.vue           # Main container
├── EditorTimelineRuler.vue      # Time ruler with markers
├── EditorTrackContainer.vue     # Scrollable track area
├── EditorTrack.vue              # Single track (video/audio/etc)
├── EditorClipItem.vue           # Draggable clip on track
├── EditorPlayhead.vue           # Vertical playhead line
├── EditorTransitionHandle.vue   # Transition between clips
├── EditorTrackControls.vue      # Track lock/mute/visibility
├── EditorMinimap.vue            # Overview minimap
└── EditorTimelineToolbar.vue    # Tools (cut, select, etc.)
```

### 2.2 Track Types & Behavior

| Track Type | Features |
|------------|----------|
| **Video** | Trim, split, resize, transitions, effects |
| **Audio** | Waveform display, volume keyframes, fade |
| **Text** | Position on canvas, animations |
| **Sticker/Image** | Static overlays, position/scale/rotate |
| **Effect** | Adjustment layers (color grading) |

### 2.3 Timeline Interactions

- **Drag clips** horizontally to reposition
- **Drag between tracks** to move clips
- **Resize** clip edges to trim
- **Split** clips with blade tool (already exists!)
- **Multi-select** with Shift/Ctrl
- **Snap** to playhead, clip edges, markers
- **Ripple edit** mode (shifts all following clips)

---

## Phase 3: Canvas Preview (2-3 weeks)

### 3.1 Composition Engine

Create a real-time preview that composites all visible clips at the playhead position.

**New component:** `client/src/components/editor/EditorCanvas.vue`

**Architecture:**
```
┌─────────────────────────────────────────┐
│           EditorCanvas.vue              │
│  ┌───────────────────────────────────┐  │
│  │     Background Layer              │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │   Video Track 1 (base)      │  │  │
│  │  │  ┌───────────────────────┐  │  │  │
│  │  │  │ Video Track 2 (PIP)   │  │  │  │
│  │  │  └───────────────────────┘  │  │  │
│  │  └─────────────────────────────┘  │  │
│  │    Text Overlays                  │  │
│  │    Stickers/Images                │  │
│  │    Effects Layer                  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### 3.2 Multi-Video Playback

Challenge: Synchronizing multiple video elements. Options:

1. **Multiple `<video>` elements** - Simple but limited compositing
2. **Canvas-based rendering** - Draw video frames to canvas (recommended)
3. **WebGL compositing** - Best performance for effects/transforms

**Recommended approach:** Use `OffscreenCanvas` with Web Workers for frame extraction:

```typescript
// Pseudocode for frame compositor
class FrameCompositor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private videoElements: Map<string, HTMLVideoElement>;
  
  renderFrame(time: number) {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.width, this.height);
    
    // For each visible clip at `time`:
    for (const clip of this.getVisibleClips(time)) {
      const video = this.videoElements.get(clip.id);
      const sourceTime = this.mapTimelineToSource(time, clip);
      
      // Apply transforms
      this.ctx.save();
      this.applyTransforms(clip);
      this.ctx.globalAlpha = clip.opacity;
      this.ctx.drawImage(video, dx, dy, dw, dh);
      this.ctx.restore();
    }
    
    // Render text/stickers on top
    this.renderOverlays(time);
  }
}
```

### 3.3 Canvas Interactions

- **Select** items on canvas
- **Transform** handles for resize/rotate
- **Drag** to reposition
- **Safe area** guides
- **Grid/snap** system

---

## Phase 4: Media Management (2 weeks)

### 4.1 Media Browser Panel

**Component:** `client/src/components/editor/EditorMediaBrowser.vue`

**Sections:**
- **My VODs** - Import from existing VOD downloads
- **My Clips** - Import from detected/built clips
- **Audio** - Music tracks, sound effects
- **Images** - Import images
- **Stickers** - Animated/static stickers library
- **Text Templates** - Preset text styles

### 4.2 Asset Import Flow

```
User selects asset → Copy to editor project folder → 
Generate thumbnail → Create editor_clips record →
Add to timeline at playhead position
```

### 4.3 Audio Waveform Generation

Extend existing `useAudioWaveform.ts` to support:
- Background audio track waveforms
- Multiple audio track visualization
- Volume envelope display

---

## Phase 5: Effects & Filters (3-4 weeks)

### 5.1 Effect Categories

| Category | Effects |
|----------|---------|
| **Color** | Brightness, Contrast, Saturation, Temperature, Tint, Curves |
| **Stylize** | Blur, Sharpen, Vignette, Grain, Glow |
| **Transform** | Crop, Flip, Rotate, Scale |
| **Speed** | Constant speed change, Speed ramp |
| **Blend** | Opacity, Blend modes |
| **Audio** | Volume, Fade, EQ, Compressor |

### 5.2 Effect Panel UI

**Component:** `client/src/components/editor/EditorEffectsPanel.vue`

```vue
<template>
  <div class="effects-panel">
    <EffectSearch />
    <EffectCategories />
    <EffectList />
    <!-- When clip selected: -->
    <AppliedEffects :clip="selectedClip" />
    <EffectControls :effect="selectedEffect" />
  </div>
</template>
```

### 5.3 Keyframe Animation System

**Component:** `client/src/components/editor/EditorKeyframeEditor.vue`

Support animating any numeric property over time:
- Position X/Y
- Scale
- Rotation
- Opacity
- Volume
- Effect parameters

**Keyframe interpolation types:**
- Linear
- Ease In/Out
- Bezier curves (custom)
- Hold (step)

### 5.4 FFmpeg Filter Mapping

Map effect parameters to FFmpeg filters for export:

```rust
// In Rust backend
fn build_effect_filter(effect: &EditorEffect) -> String {
    match effect.effect_type.as_str() {
        "brightness" => format!("eq=brightness={}", effect.params["value"]),
        "blur" => format!("boxblur={}", effect.params["radius"]),
        "speed" => format!("setpts={}*PTS", 1.0 / effect.params["speed"]),
        // etc.
    }
}
```

---

## Phase 6: Text & Titles (2-3 weeks)

### 6.1 Text Editor

The existing subtitle styling infrastructure is excellent. Extend it for:

- **Rich text** editing (multiple styles in one text block)
- **Text presets/templates**
- **Animations**: Fade, slide, typewriter, bounce, etc.
- **Text on path** (curved text)

### 6.2 Title Templates

Pre-built animated title templates:
- Lower thirds
- Full-screen titles
- Social media callouts
- Subscribe/Like buttons

### 6.3 Text Rendering Pipeline

For export, convert text to ASS subtitles (already exists!) or burn directly with FFmpeg's `drawtext` filter.

---

## Phase 7: Transitions (2 weeks)

### 7.1 Transition Types

| Category | Transitions |
|----------|-------------|
| **Dissolve** | Fade, Cross dissolve, Dip to black/white |
| **Wipe** | Linear, Radial, Clock, Star |
| **Slide** | Push, Cover, Reveal |
| **Zoom** | Zoom in/out, Zoom blur |
| **3D** | Flip, Cube, Page turn |

### 7.2 Transition UI

When two clips are adjacent on timeline:
- Show transition handle between them
- Drag handle width to adjust duration
- Double-click to select transition type

### 7.3 FFmpeg Transition Implementation

Use FFmpeg's `xfade` filter for video transitions:

```bash
ffmpeg -i clip1.mp4 -i clip2.mp4 \
  -filter_complex "[0:v][1:v]xfade=transition=fade:duration=0.5:offset=2[v]" \
  -map "[v]" output.mp4
```

---

## Phase 8: Export Pipeline (2-3 weeks)

### 8.1 Export Dialog

**Component:** `client/src/components/editor/EditorExportDialog.vue`

Options:
- **Resolution**: 720p, 1080p, 4K, Custom
- **Aspect Ratio**: 16:9, 9:16, 1:1, 4:5
- **Frame Rate**: 24, 30, 60 fps
- **Quality**: Draft, Standard, High, Maximum
- **Format**: MP4, MOV, WebM, GIF

### 8.2 Export Process

```
1. Calculate final timeline duration
2. Generate FFmpeg filtergraph from timeline state
3. Create subtitle file for text overlays
4. Build FFmpeg command
5. Execute with progress tracking
6. Generate thumbnail
7. Save to user-specified location
```

### 8.3 Complex Filtergraph Generation

The most challenging part - building a single FFmpeg command from the editor state:

```rust
// Pseudocode for filtergraph builder
fn build_filtergraph(project: &EditorProject) -> String {
    let mut inputs = vec![];
    let mut filters = vec![];
    let mut outputs = vec![];
    
    // For each clip, add input and trim
    for (i, clip) in project.clips.iter().enumerate() {
        inputs.push(format!("-i {}", clip.source_path));
        filters.push(format!(
            "[{}]trim={}:{},setpts=PTS-STARTPTS[v{}]",
            i, clip.source_start, clip.source_end, i
        ));
    }
    
    // Add transitions between adjacent clips
    // Add effects
    // Stack video tracks (overlay)
    // Mix audio tracks (amix)
    
    format!("{} -filter_complex '{}'", inputs.join(" "), filters.join(";"))
}
```

---

## Phase 9: Stickers & Assets (1-2 weeks)

### 9.1 Sticker Library

- **Static stickers**: PNG/WebP with transparency
- **Animated stickers**: WebP animation, GIF, Lottie JSON
- **Categories**: Emojis, Social, Effects, Text bubbles, etc.

### 9.2 Asset Management

Store in `assets` table, support:
- Import from files
- Download from online library (future)
- User-created assets

---

## Phase 10: Audio Features (2 weeks)

### 10.1 Audio Editing

- **Volume keyframes** with envelope UI
- **Audio fade** in/out
- **Ducking** (lower music when voice is present)
- **Audio sync** (match clip audio to timeline)

### 10.2 Music Library

- Import audio files
- Integration with royalty-free music APIs (future)
- Beat detection for sync editing (advanced)

### 10.3 Audio Export

FFmpeg audio filters:
```bash
-af "volume=1.5,afade=t=in:st=0:d=0.5,afade=t=out:st=29.5:d=0.5"
```

---

## Technical Considerations

### Performance Optimizations

1. **Proxy editing** - Generate lower-resolution proxies for smooth preview
2. **Virtual scrolling** - Only render visible timeline portions
3. **Lazy loading** - Load media thumbnails on demand
4. **Web Workers** - Offload heavy computations
5. **Hardware acceleration** - Use WebGL for canvas compositing

### Undo/Redo System

Implement command pattern:

```typescript
interface EditorCommand {
  execute(): void;
  undo(): void;
  description: string;
}

class MoveClipCommand implements EditorCommand {
  constructor(
    private clipId: string,
    private fromTime: number,
    private toTime: number
  ) {}
  
  execute() { /* move clip to toTime */ }
  undo() { /* move clip back to fromTime */ }
}
```

### Autosave

- Save project state every 30 seconds
- Keep revision history
- Crash recovery

---

## File Structure Summary

```
client/src/
├── pages/
│   └── Editor.vue
├── layouts/
│   └── EditorLayout.vue
├── components/
│   └── editor/
│       ├── EditorTimeline.vue
│       ├── EditorTimelineRuler.vue
│       ├── EditorTrack.vue
│       ├── EditorClipItem.vue
│       ├── EditorPlayhead.vue
│       ├── EditorCanvas.vue
│       ├── EditorCanvasItem.vue
│       ├── EditorTransformControls.vue
│       ├── EditorMediaBrowser.vue
│       ├── EditorEffectsPanel.vue
│       ├── EditorKeyframeEditor.vue
│       ├── EditorTextEditor.vue
│       ├── EditorTransitionPicker.vue
│       ├── EditorExportDialog.vue
│       ├── EditorToolbar.vue
│       ├── EditorSidebar.vue
│       └── EditorProperties.vue
├── composables/
│   ├── useEditorTimeline.ts
│   ├── useEditorPlayback.ts
│   ├── useEditorHistory.ts
│   ├── useEditorClipboard.ts
│   ├── useEditorExport.ts
│   └── useFrameCompositor.ts
├── stores/
│   └── editor.ts
├── services/
│   └── database/
│       ├── editor-projects.ts
│       ├── editor-tracks.ts
│       ├── editor-clips.ts
│       ├── editor-effects.ts
│       └── editor-keyframes.ts
└── types/
    └── editor.ts

client/src-tauri/src/
├── editor/
│   ├── mod.rs
│   ├── export.rs
│   ├── filtergraph.rs
│   ├── transitions.rs
│   └── effects.rs
└── migrations/
    └── 052_create_editor_tables.sql
```

---

## Effort Estimation

| Phase | Duration | Complexity |
|-------|----------|------------|
| 1. Foundation | 2-3 weeks | Medium |
| 2. Multi-Track Timeline | 3-4 weeks | High |
| 3. Canvas Preview | 2-3 weeks | High |
| 4. Media Management | 2 weeks | Medium |
| 5. Effects & Filters | 3-4 weeks | High |
| 6. Text & Titles | 2-3 weeks | Medium |
| 7. Transitions | 2 weeks | Medium |
| 8. Export Pipeline | 2-3 weeks | High |
| 9. Stickers & Assets | 1-2 weeks | Low |
| 10. Audio Features | 2 weeks | Medium |
| **Total** | **21-30 weeks** | |

---

## Recommended MVP Scope (Phase 1 Release)

For a faster initial release, prioritize:

1. ✅ Single video track + audio track
2. ✅ Basic trim/split/cut
3. ✅ Text overlays with existing subtitle engine
4. ✅ Simple transitions (fade, dissolve)
5. ✅ Basic color correction
6. ✅ Export to MP4/MOV
7. ❌ Skip: Keyframes, complex effects, stickers, templates

**MVP Estimate**: 8-12 weeks

---

## Risks & Challenges

1. **FFmpeg complexity** - Complex timelines create massive filtergraphs
2. **Performance** - Multi-video preview can be resource-intensive
3. **Memory** - Large projects with many clips
4. **UX complexity** - Video editors have steep learning curves
5. **Testing** - Many edge cases in timeline interactions

---

## Existing Infrastructure to Leverage

### From Current Codebase

| Component | Can Reuse | Notes |
|-----------|-----------|-------|
| `Timeline.vue` | Partial | Good foundation, needs multi-track support |
| `TimelineRuler.vue` | Yes | Works as-is |
| `VideoPlayer.vue` | Partial | Extend for multi-source |
| `SubtitlesTab.vue` | Yes | Text styling system |
| `useAudioWaveform.ts` | Yes | Extend for multiple tracks |
| `video_processor.rs` | Yes | FFmpeg foundation |
| `encoder.rs` | Yes | Hardware acceleration |
| `subtitle.rs` | Yes | ASS generation |

### FFmpeg Capabilities Already Implemented

- Hardware encoding (NVENC, AMF, QSV, VideoToolbox)
- Aspect ratio cropping
- Watermark overlay
- Audio normalization
- Subtitle burning
- Multi-segment concatenation
- Intro/outro merging
- Split screen composition

---

## Next Steps

1. Review this plan with the team
2. Decide on MVP scope
3. Create detailed tickets for Phase 1
4. Set up editor branch
5. Begin foundation work

---

*This document will be updated as decisions are made and implementation progresses.*





