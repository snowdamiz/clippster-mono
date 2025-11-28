-- Add watermark presets table
-- Migration: 037_add_watermark_presets
-- Created: 2025-01-28

-- Create watermark_presets table
CREATE TABLE IF NOT EXISTS watermark_presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  -- Watermark reference (optional - preset can work with any watermark)
  watermark_id TEXT,
  -- Position settings (percentages 0-100)
  position_x INTEGER NOT NULL,
  position_y INTEGER NOT NULL,
  -- Appearance settings
  opacity INTEGER NOT NULL,
  scale INTEGER NOT NULL,
  -- Metadata
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  -- Foreign key to watermark_images (optional)
  FOREIGN KEY (watermark_id) REFERENCES watermark_images(id) ON DELETE SET NULL
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_watermark_presets_name ON watermark_presets(name);
CREATE INDEX IF NOT EXISTS idx_watermark_presets_created_at ON watermark_presets(created_at);

