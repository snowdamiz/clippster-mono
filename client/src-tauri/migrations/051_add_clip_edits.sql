-- Add clip editing tables
-- Migration: 051_add_clip_edits
-- Created: 2025-01-XX
--
-- Purpose: Store clip edit configurations for the clip editor feature.
-- This includes audio tracks, text overlays, stickers, and visual effects.

-- Main clip_edits table - stores the primary edit configuration for each clip
CREATE TABLE IF NOT EXISTS clip_edits (
  id TEXT PRIMARY KEY,
  clip_id TEXT NOT NULL,
  edit_data TEXT NOT NULL,  -- JSON with trim, filter, speed settings
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (clip_id) REFERENCES clips(id) ON DELETE CASCADE
);

-- Audio tracks table - for music overlays
CREATE TABLE IF NOT EXISTS clip_audio_tracks (
  id TEXT PRIMARY KEY,
  clip_edit_id TEXT NOT NULL,
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
  FOREIGN KEY (clip_edit_id) REFERENCES clip_edits(id) ON DELETE CASCADE
);

-- Text overlays table
CREATE TABLE IF NOT EXISTS clip_text_overlays (
  id TEXT PRIMARY KEY,
  clip_edit_id TEXT NOT NULL,
  text TEXT NOT NULL,
  start_time REAL DEFAULT 0,
  end_time REAL DEFAULT 0,
  position_x REAL DEFAULT 50,
  position_y REAL DEFAULT 50,
  style_data TEXT,  -- JSON with font, color, shadow settings
  animation TEXT DEFAULT 'none',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (clip_edit_id) REFERENCES clip_edits(id) ON DELETE CASCADE
);

-- Stickers table - for emojis and image overlays
CREATE TABLE IF NOT EXISTS clip_stickers (
  id TEXT PRIMARY KEY,
  clip_edit_id TEXT NOT NULL,
  sticker_path TEXT NOT NULL,
  sticker_type TEXT DEFAULT 'emoji',  -- emoji, image, gif
  start_time REAL DEFAULT 0,
  end_time REAL DEFAULT 0,
  position_x REAL DEFAULT 50,
  position_y REAL DEFAULT 50,
  scale REAL DEFAULT 1.0,
  rotation REAL DEFAULT 0,
  animation TEXT DEFAULT 'none',
  created_at INTEGER NOT NULL,
  FOREIGN KEY (clip_edit_id) REFERENCES clip_edits(id) ON DELETE CASCADE
);

-- Effects table - for zoom, blur, transitions, etc.
CREATE TABLE IF NOT EXISTS clip_effects (
  id TEXT PRIMARY KEY,
  clip_edit_id TEXT NOT NULL,
  effect_type TEXT NOT NULL,  -- filter, speed, zoom, pan, transition, blur, freeze, flash, shake
  start_time REAL DEFAULT 0,
  end_time REAL DEFAULT 0,
  settings TEXT,  -- JSON with effect-specific settings
  created_at INTEGER NOT NULL,
  FOREIGN KEY (clip_edit_id) REFERENCES clip_edits(id) ON DELETE CASCADE
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_clip_edits_clip_id ON clip_edits(clip_id);
CREATE INDEX IF NOT EXISTS idx_clip_audio_tracks_edit_id ON clip_audio_tracks(clip_edit_id);
CREATE INDEX IF NOT EXISTS idx_clip_text_overlays_edit_id ON clip_text_overlays(clip_edit_id);
CREATE INDEX IF NOT EXISTS idx_clip_stickers_edit_id ON clip_stickers(clip_edit_id);
CREATE INDEX IF NOT EXISTS idx_clip_effects_edit_id ON clip_effects(clip_edit_id);
