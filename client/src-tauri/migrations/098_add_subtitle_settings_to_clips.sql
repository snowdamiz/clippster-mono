-- Migration: Add subtitle_settings column to clips table
-- This stores the full JSON of subtitle settings for each clip
-- Allows custom per-clip subtitle configuration beyond just presets

-- Add subtitle_settings column to store full subtitle configuration as JSON
ALTER TABLE clips ADD COLUMN subtitle_settings TEXT;
