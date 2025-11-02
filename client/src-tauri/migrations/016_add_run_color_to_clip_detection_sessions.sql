-- Add run_color column to clip_detection_sessions table
-- Migration: 016_add_run_color_to_clip_detection_sessions
-- Created: 2025-11-02

-- Add run_color column to clip_detection_sessions table
-- The column will store a hex color code for each detection run to enable color-coded badges
ALTER TABLE clip_detection_sessions ADD COLUMN run_color TEXT NOT NULL DEFAULT '#8B5CF6';

-- Add index for potential queries on run_color (optional but helpful)
CREATE INDEX IF NOT EXISTS idx_clip_detection_sessions_run_color ON clip_detection_sessions(run_color);