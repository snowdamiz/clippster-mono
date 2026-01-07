-- Add effects and transitions tables
-- Migration: 071_add_effects_transitions
-- Created: 2025-01-06
--
-- Purpose: Store video effects and transitions for the clip editor.
-- Effects are time-based visual modifications applied to video segments.
-- Transitions are applied between segments for smooth visual changes.

-- ==========================================
-- Transition Presets (built-in library)
-- ==========================================
CREATE TABLE IF NOT EXISTS transition_presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,           -- 'fade', 'wipe', 'slide', 'zoom', 'stylized', 'shape'
  category TEXT NOT NULL,       -- 'basic', 'wipe', 'slide', 'zoom', 'stylized', 'shape', 'directional'
  description TEXT,
  parameters_schema TEXT,       -- JSON schema for parameters
  default_parameters TEXT,      -- JSON default parameter values
  preview_url TEXT,             -- Preview thumbnail/animation
  ffmpeg_filter TEXT,           -- FFmpeg xfade filter name
  css_animation TEXT,           -- CSS animation for preview
  is_builtin INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- ==========================================
-- Effect Presets (built-in library)
-- ==========================================
CREATE TABLE IF NOT EXISTS effect_presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,           -- 'blur', 'color', 'stylized', 'distortion', 'motion', 'overlay'
  category TEXT NOT NULL,       -- 'basic', 'color', 'stylized', 'distortion', 'motion', 'overlay'
  description TEXT,
  parameters_schema TEXT,       -- JSON schema for parameters
  default_parameters TEXT,      -- JSON default parameter values
  preview_url TEXT,             -- Preview thumbnail
  ffmpeg_filter TEXT,           -- FFmpeg filter string template
  css_filter TEXT,              -- CSS filter for preview
  is_builtin INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- ==========================================
-- Applied Transitions (clip mode)
-- ==========================================
CREATE TABLE IF NOT EXISTS clip_transitions (
  id TEXT PRIMARY KEY,
  clip_edit_id TEXT NOT NULL,
  preset_id TEXT,               -- Reference to transition_presets
  transition_type TEXT NOT NULL,-- Type of transition
  position_index INTEGER NOT NULL, -- Position between segments (0 = before first, 1 = between 1st and 2nd, etc.)
  duration REAL DEFAULT 0.5,    -- Duration in seconds
  parameters_data TEXT,         -- JSON for custom parameters
  easing TEXT DEFAULT 'ease-in-out',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (clip_edit_id) REFERENCES clip_edits(id) ON DELETE CASCADE
);

-- ==========================================
-- Applied Effects (clip mode)
-- ==========================================
CREATE TABLE IF NOT EXISTS clip_effects (
  id TEXT PRIMARY KEY,
  clip_edit_id TEXT NOT NULL,
  preset_id TEXT,               -- Reference to effect_presets
  effect_type TEXT NOT NULL,    -- Type of effect
  start_time REAL NOT NULL,
  end_time REAL NOT NULL,
  intensity REAL DEFAULT 1.0,   -- 0-1 strength multiplier
  parameters_data TEXT,         -- JSON for effect-specific parameters
  keyframes_data TEXT,          -- JSON for animated parameters
  blend_mode TEXT DEFAULT 'normal',
  layer INTEGER DEFAULT 0,      -- Stack order (higher = on top)
  is_enabled INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (clip_edit_id) REFERENCES clip_edits(id) ON DELETE CASCADE
);

-- ==========================================
-- Applied Transitions (video editor mode)
-- ==========================================
CREATE TABLE IF NOT EXISTS video_editor_transitions (
  id TEXT PRIMARY KEY,
  edit_id TEXT NOT NULL,
  preset_id TEXT,               -- Reference to transition_presets
  transition_type TEXT NOT NULL,
  from_source_id TEXT,          -- Source before transition
  to_source_id TEXT,            -- Source after transition
  duration REAL DEFAULT 0.5,
  parameters_data TEXT,
  easing TEXT DEFAULT 'ease-in-out',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (edit_id) REFERENCES video_editor_edits(id) ON DELETE CASCADE
);

-- ==========================================
-- Applied Effects (video editor mode)
-- ==========================================
CREATE TABLE IF NOT EXISTS video_editor_effects (
  id TEXT PRIMARY KEY,
  edit_id TEXT NOT NULL,
  preset_id TEXT,               -- Reference to effect_presets
  effect_type TEXT NOT NULL,
  target_source_id TEXT,        -- Optional: apply to specific source only
  start_time REAL NOT NULL,
  end_time REAL NOT NULL,
  intensity REAL DEFAULT 1.0,
  parameters_data TEXT,
  keyframes_data TEXT,
  blend_mode TEXT DEFAULT 'normal',
  layer INTEGER DEFAULT 0,
  is_enabled INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (edit_id) REFERENCES video_editor_edits(id) ON DELETE CASCADE
);

-- ==========================================
-- Indexes for efficient querying
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_transition_presets_type ON transition_presets(type);
CREATE INDEX IF NOT EXISTS idx_transition_presets_category ON transition_presets(category);
CREATE INDEX IF NOT EXISTS idx_effect_presets_type ON effect_presets(type);
CREATE INDEX IF NOT EXISTS idx_effect_presets_category ON effect_presets(category);
CREATE INDEX IF NOT EXISTS idx_clip_transitions_edit ON clip_transitions(clip_edit_id);
CREATE INDEX IF NOT EXISTS idx_clip_effects_edit ON clip_effects(clip_edit_id);
CREATE INDEX IF NOT EXISTS idx_clip_effects_time ON clip_effects(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_video_editor_transitions_edit ON video_editor_transitions(edit_id);
CREATE INDEX IF NOT EXISTS idx_video_editor_effects_edit ON video_editor_effects(edit_id);
CREATE INDEX IF NOT EXISTS idx_video_editor_effects_time ON video_editor_effects(start_time, end_time);
