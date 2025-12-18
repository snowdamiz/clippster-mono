-- Migration 062: Add user_id column to clips and raw_videos tables
-- This enables multi-user support for clips and raw videos

-- Add user_id to clips table
ALTER TABLE clips ADD COLUMN user_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_clips_user_id ON clips(user_id);

-- Add user_id to raw_videos table
ALTER TABLE raw_videos ADD COLUMN user_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_raw_videos_user_id ON raw_videos(user_id);

