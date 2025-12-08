-- Add highlight_color to custom_subtitle_presets table
-- Migration: 049_add_highlight_color_to_subtitle_presets
-- Created: 2025-01-18

-- Add highlight_color column for animation highlight effects (karaoke, etc.)
ALTER TABLE custom_subtitle_presets ADD COLUMN highlight_color TEXT DEFAULT '#FFFF00';

