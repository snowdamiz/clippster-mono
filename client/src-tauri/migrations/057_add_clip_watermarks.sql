-- Add clip watermarks table for clip editor
-- Migration: 057_add_clip_watermarks
-- Created: 2025-01-XX
--
-- Purpose: Store watermark overlays for clips in the clip editor.
-- Watermarks are time-based and support per-aspect-ratio configurations.

-- Watermarks table - for watermark overlays in clip editor
CREATE TABLE IF NOT EXISTS clip_watermarks (
  id TEXT PRIMARY KEY,
  clip_edit_id TEXT NOT NULL,
  watermark_id TEXT NOT NULL,  -- Reference to watermark_images table
  watermark_path TEXT NOT NULL,  -- File path for rendering
  start_time REAL DEFAULT 0,
  end_time REAL DEFAULT 0,
  position_x REAL DEFAULT 8,  -- Default bottom-left
  position_y REAL DEFAULT 92,
  scale REAL DEFAULT 15,  -- Percentage of video width
  opacity REAL DEFAULT 80,  -- 0-100
  per_ratio_configs_data TEXT,  -- JSON for per-aspect-ratio configurations
  created_at INTEGER NOT NULL,
  FOREIGN KEY (clip_edit_id) REFERENCES clip_edits(id) ON DELETE CASCADE
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_clip_watermarks_edit_id ON clip_watermarks(clip_edit_id);



