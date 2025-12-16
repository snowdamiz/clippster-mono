-- Add video editor editing tables
-- Migration: 059_add_video_editor_edits
-- Created: 2025-01-XX
--
-- Purpose: Store edit configurations for video editor projects.
-- This mirrors the clip_edits structure but references video_editor_projects instead of clips.
-- Includes audio tracks, text overlays, stickers, watermarks, and visual effects.

-- Main video_editor_edits table - stores the primary edit configuration for each video editor project
CREATE TABLE IF NOT EXISTS video_editor_edits (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  edit_data TEXT NOT NULL,  -- JSON with filter segments, volume settings, etc.
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES video_editor_projects(id) ON DELETE CASCADE
);

-- Audio tracks table - for music overlays in video editor
CREATE TABLE IF NOT EXISTS video_editor_audio_tracks (
  id TEXT PRIMARY KEY,
  edit_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  name TEXT,
  start_time REAL DEFAULT 0,
  end_time REAL DEFAULT 0,
  volume REAL DEFAULT 1.0,
  fade_in REAL DEFAULT 0,
  fade_out REAL DEFAULT 0,
  track_order INTEGER DEFAULT 0,
  is_muted INTEGER DEFAULT 0,
  is_solo INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (edit_id) REFERENCES video_editor_edits(id) ON DELETE CASCADE
);

-- Text overlays table for video editor
CREATE TABLE IF NOT EXISTS video_editor_text_overlays (
  id TEXT PRIMARY KEY,
  edit_id TEXT NOT NULL,
  text TEXT NOT NULL,
  start_time REAL DEFAULT 0,
  end_time REAL DEFAULT 0,
  position_x REAL DEFAULT 50,
  position_y REAL DEFAULT 50,
  style_data TEXT,  -- JSON with font, color, shadow settings
  per_ratio_configs_data TEXT,  -- JSON for per-aspect-ratio configurations
  preview_height REAL,  -- Height of preview container for proper font scaling
  animation TEXT DEFAULT 'none',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (edit_id) REFERENCES video_editor_edits(id) ON DELETE CASCADE
);

-- Stickers table for video editor - for emojis and image overlays
CREATE TABLE IF NOT EXISTS video_editor_stickers (
  id TEXT PRIMARY KEY,
  edit_id TEXT NOT NULL,
  sticker_path TEXT NOT NULL,
  sticker_type TEXT DEFAULT 'emoji',  -- emoji, image, gif
  start_time REAL DEFAULT 0,
  end_time REAL DEFAULT 0,
  position_x REAL DEFAULT 50,
  position_y REAL DEFAULT 50,
  scale REAL DEFAULT 1.0,
  rotation REAL DEFAULT 0,
  animation TEXT DEFAULT 'none',
  per_ratio_configs_data TEXT,  -- JSON for per-aspect-ratio configurations
  created_at INTEGER NOT NULL,
  FOREIGN KEY (edit_id) REFERENCES video_editor_edits(id) ON DELETE CASCADE
);

-- Watermarks table for video editor
CREATE TABLE IF NOT EXISTS video_editor_watermarks (
  id TEXT PRIMARY KEY,
  edit_id TEXT NOT NULL,
  watermark_id TEXT NOT NULL,  -- Reference to watermark_images table
  watermark_path TEXT NOT NULL,  -- File path for rendering
  preview_url TEXT,  -- Data URL for preview display
  start_time REAL DEFAULT 0,
  end_time REAL DEFAULT 0,
  position_x REAL DEFAULT 8,  -- Default bottom-left
  position_y REAL DEFAULT 92,
  scale REAL DEFAULT 15,  -- Percentage of video width
  opacity REAL DEFAULT 80,  -- 0-100
  per_ratio_configs_data TEXT,  -- JSON for per-aspect-ratio configurations
  created_at INTEGER NOT NULL,
  FOREIGN KEY (edit_id) REFERENCES video_editor_edits(id) ON DELETE CASCADE
);

-- Effects table for video editor - for filters, zoom, blur, transitions, etc.
CREATE TABLE IF NOT EXISTS video_editor_effects (
  id TEXT PRIMARY KEY,
  edit_id TEXT NOT NULL,
  effect_type TEXT NOT NULL,  -- filter, speed, zoom, pan, transition, blur, freeze, flash, shake
  start_time REAL DEFAULT 0,
  end_time REAL DEFAULT 0,
  settings TEXT,  -- JSON with effect-specific settings
  created_at INTEGER NOT NULL,
  FOREIGN KEY (edit_id) REFERENCES video_editor_edits(id) ON DELETE CASCADE
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_video_editor_edits_project_id ON video_editor_edits(project_id);
CREATE INDEX IF NOT EXISTS idx_video_editor_audio_tracks_edit_id ON video_editor_audio_tracks(edit_id);
CREATE INDEX IF NOT EXISTS idx_video_editor_text_overlays_edit_id ON video_editor_text_overlays(edit_id);
CREATE INDEX IF NOT EXISTS idx_video_editor_stickers_edit_id ON video_editor_stickers(edit_id);
CREATE INDEX IF NOT EXISTS idx_video_editor_watermarks_edit_id ON video_editor_watermarks(edit_id);
CREATE INDEX IF NOT EXISTS idx_video_editor_effects_edit_id ON video_editor_effects(edit_id);

