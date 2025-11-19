-- Add border2 fields and rename outline fields to border1
-- Migration: 029_add_second_border_to_subtitle_presets
-- Created: 2025-01-18

-- Rename outline fields to border1
ALTER TABLE custom_subtitle_presets RENAME COLUMN outline_width TO border1_width;
ALTER TABLE custom_subtitle_presets RENAME COLUMN outline_color TO border1_color;

-- Add border2 fields
ALTER TABLE custom_subtitle_presets ADD COLUMN border2_width REAL NOT NULL DEFAULT 0;
ALTER TABLE custom_subtitle_presets ADD COLUMN border2_color TEXT NOT NULL DEFAULT '#000000';

