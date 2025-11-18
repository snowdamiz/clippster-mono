-- Add custom subtitle presets table
-- Migration: 028_add_custom_subtitle_presets
-- Created: 2025-01-18

-- Create custom_subtitle_presets table
CREATE TABLE IF NOT EXISTS custom_subtitle_presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  -- Font settings
  font_family TEXT NOT NULL,
  font_size INTEGER NOT NULL,
  font_weight INTEGER NOT NULL,
  -- Color settings
  text_color TEXT NOT NULL,
  background_color TEXT NOT NULL,
  background_enabled INTEGER NOT NULL DEFAULT 0, -- SQLite boolean (0=false, 1=true)
  -- Outline settings
  outline_width REAL NOT NULL,
  outline_color TEXT NOT NULL,
  -- Shadow settings
  shadow_offset_x INTEGER NOT NULL,
  shadow_offset_y INTEGER NOT NULL,
  shadow_blur INTEGER NOT NULL,
  shadow_color TEXT NOT NULL,
  -- Position settings
  position TEXT NOT NULL CHECK(position IN ('top', 'middle', 'bottom')),
  position_percentage INTEGER NOT NULL,
  max_width INTEGER NOT NULL,
  -- Animation (for future use)
  animation_style TEXT NOT NULL,
  -- Advanced settings
  line_height REAL NOT NULL,
  letter_spacing REAL NOT NULL,
  text_align TEXT NOT NULL CHECK(text_align IN ('left', 'center', 'right')),
  text_offset_x INTEGER NOT NULL,
  text_offset_y INTEGER NOT NULL,
  padding INTEGER NOT NULL,
  border_radius INTEGER NOT NULL,
  word_spacing REAL NOT NULL,
  -- Metadata
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_custom_subtitle_presets_name ON custom_subtitle_presets(name);
CREATE INDEX IF NOT EXISTS idx_custom_subtitle_presets_created_at ON custom_subtitle_presets(created_at);

