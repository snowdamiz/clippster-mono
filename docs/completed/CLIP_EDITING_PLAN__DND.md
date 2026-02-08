Clip Editor Dialog Implementation
Overview
Add an "Edit Clip" option to TimelineClipContextMenu.vue that opens a new full-featured clip editing dialog. The editor will provide professional editing capabilities similar to CapCut.

Architecture
New Components Structure
components/
  clip-editor/
    ClipEditorDialog.vue        # Main dialog container
    ClipEditorPreview.vue       # Video preview with real-time overlays
    ClipEditorTimeline.vue      # Multi-track timeline for editing
    ClipEditorToolbar.vue       # Tool selection bar
    tabs/
      TrimTab.vue               # Trimming and segment cutting
      AudioMixerTab.vue         # Audio tracks, volume, music overlay
      FiltersTab.vue            # Visual filters and color grading
      SpeedTab.vue              # Speed/playback adjustments
      TextOverlayTab.vue        # Custom text, titles, lower thirds
      StickersTab.vue           # Stickers, emojis, GIFs
      EffectsTab.vue            # Zoom, pan, transitions
    elements/
      AudioTrackItem.vue        # Individual audio track in timeline
      TextElement.vue           # Draggable text overlay
      StickerElement.vue        # Draggable sticker overlay
Database Schema Additions (new tables)
-- Store clip edit configurations
CREATE TABLE clip_edits (
  id TEXT PRIMARY KEY,
  clip_id TEXT NOT NULL REFERENCES clips(id),
  edit_data TEXT NOT NULL,  -- JSON with all edit settings
  created_at INTEGER,
  updated_at INTEGER
);

-- Audio tracks (music overlays)
CREATE TABLE clip_audio_tracks (
  id TEXT PRIMARY KEY,
  clip_edit_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  name TEXT,
  start_time REAL,      -- when audio starts in clip timeline
  end_time REAL,
  volume REAL DEFAULT 1.0,
  fade_in REAL DEFAULT 0,
  fade_out REAL DEFAULT 0,
  track_order INTEGER,
  created_at INTEGER
);

-- Text overlays
CREATE TABLE clip_text_overlays (
  id TEXT PRIMARY KEY,
  clip_edit_id TEXT NOT NULL,
  text TEXT NOT NULL,
  start_time REAL,
  end_time REAL,
  position_x REAL,       -- 0-100 percentage
  position_y REAL,
  font_family TEXT,
  font_size INTEGER,
  font_color TEXT,
  background_color TEXT,
  animation TEXT,        -- 'none', 'fade', 'slide', 'typewriter', etc.
  style_preset TEXT,     -- 'title', 'lower-third', 'caption', etc.
  created_at INTEGER
);

-- Stickers/emojis
CREATE TABLE clip_stickers (
  id TEXT PRIMARY KEY,
  clip_edit_id TEXT NOT NULL,
  sticker_id TEXT,       -- reference to sticker library
  file_path TEXT,        -- for custom uploaded stickers
  start_time REAL,
  end_time REAL,
  position_x REAL,
  position_y REAL,
  scale REAL DEFAULT 1.0,
  rotation REAL DEFAULT 0,
  animation TEXT,        -- 'bounce', 'spin', 'pulse', etc.
  created_at INTEGER
);

-- Visual effects applied to segments
CREATE TABLE clip_effects (
  id TEXT PRIMARY KEY,
  clip_edit_id TEXT NOT NULL,
  effect_type TEXT,      -- 'filter', 'speed', 'zoom', 'transition'
  start_time REAL,
  end_time REAL,
  settings TEXT,         -- JSON with effect-specific settings
  created_at INTEGER
);
Key Features by Tab
1. Trim Tab
Visual waveform timeline for precise trimming
Drag handles to adjust start/end times
Split tool to cut clip into segments
Remove/restore deleted segments
2. Audio Mixer Tab
Original audio track with volume control
Add custom music tracks (upload local files)
Per-track volume, fade in/out controls
Drag to position audio on timeline
Mute/solo individual tracks
3. Filters Tab
Preset filters (Warm, Cool, Vintage, B&W, etc.)
Manual adjustments: brightness, contrast, saturation, hue
Vignette effect
Preview before applying
4. Speed Tab
Speed presets (0.25x, 0.5x, 1x, 1.5x, 2x, 4x)
Custom speed input
Reverse playback option
Speed ramping for smooth transitions
5. Text Overlay Tab
Add text at any position
Style presets: Title, Lower Third, Caption, Quote
Font selection, size, color, background
Animations: fade, slide, typewriter, bounce
Drag to position, resize, set duration
6. Stickers Tab
Emoji picker (common emojis grid)
Upload custom stickers/images
Drag to position, resize, rotate
Animation options: bounce, spin, pulse, shake
Set visibility duration
7. Effects Tab
Zoom/Pan (Ken Burns effect)
Blur effect (background blur, motion blur)
Transitions between segments: fade, dissolve, slide
Freeze frame
Flash/shake effects
Implementation Flow
Step 1: Context Menu Update
Modify TimelineClipContextMenu.vue to add "Edit Clip" option:

<button @click="handleEditClip">
  <Edit :size="16" />
  <span>Edit Clip</span>
</button>
Step 2: Core Dialog Structure
Create ClipEditorDialog.vue following ProjectWorkspaceDialog.vue pattern:

Left panel: Video preview with overlay rendering
Right panel: Tabbed editing controls
Bottom: Multi-track timeline
Step 3: Preview Component
ClipEditorPreview.vue renders:

Video with applied filters
Text overlays (draggable in edit mode)
Stickers (draggable in edit mode)
Real-time effect preview
Step 4: Timeline Component
ClipEditorTimeline.vue with multiple tracks:

Video track (with trim handles)
Audio tracks (original + added music)
Text track (overlay durations)
Sticker track (overlay durations)
Step 5: Export Integration
Integrate with existing ClipBuildSettingsDialog.vue:

Pass edit configuration to export process
Backend applies all edits during FFmpeg rendering
Files to Modify
TimelineClipContextMenu.vue - Add "Edit Clip" option and emit
Timeline.vue - Handle editClip emit, open dialog
ProjectWorkspaceDialog.vue - Add ClipEditorDialog component
types/index.ts - Add new type definitions
services/database.ts - Add database functions for new tables
Key Type Definitions
interface ClipEdit {
  id: string;
  clipId: string;
  trim: { startTime: number; endTime: number };
  audioTracks: AudioTrack[];
  textOverlays: TextOverlay[];
  stickers: Sticker[];
  effects: Effect[];
  filter: FilterSettings | null;
  speed: number;
}

interface AudioTrack {
  id: string;
  filePath: string;
  name: string;
  startTime: number;
  endTime: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
}

interface TextOverlay {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  position: { x: number; y: number };
  style: TextStyle;
  animation: string;
}

interface Sticker {
  id: string;
  stickerPath: string;
  startTime: number;
  endTime: number;
  position: { x: number; y: number };
  scale: number;
  rotation: number;
  animation: string;
}

interface Effect {
  id: string;
  type: 'filter' | 'speed' | 'zoom' | 'transition';
  startTime: number;
  endTime: number;
  settings: Record<string, any>;
}
Estimated Complexity
Context menu update: Simple (1 file)
Dialog structure: Medium (1 main component)
Preview with overlays: Complex (real-time rendering)
Multi-track timeline: Complex (drag/drop, sync)
Individual tabs: Medium each (7 tabs)
Database schema: Medium (migrations, services)
Export integration: Complex (FFmpeg filters)
Recommended Implementation Order
Context menu + basic dialog shell
Database schema and services
Trim tab (core editing)
Audio mixer tab
Text overlay tab
Stickers tab
Filters tab
Speed tab
Effects tab
Export integration