-- Add segment tracking fields to raw_videos table for PumpFun VOD segment naming
-- Migration: 022_add_segment_tracking
-- Created: 2025-11-07

-- Add fields to track segment relationships and naming
ALTER TABLE raw_videos ADD COLUMN source_clip_id TEXT;
ALTER TABLE raw_videos ADD COLUMN source_mint_id TEXT;
ALTER TABLE raw_videos ADD COLUMN segment_number INTEGER;
ALTER TABLE raw_videos ADD COLUMN is_segment BOOLEAN DEFAULT FALSE;
ALTER TABLE raw_videos ADD COLUMN segment_start_time REAL;
ALTER TABLE raw_videos ADD COLUMN segment_end_time REAL;

-- Create indexes for efficient segment queries
CREATE INDEX IF NOT EXISTS idx_raw_videos_source_clip_id ON raw_videos(source_clip_id);
CREATE INDEX IF NOT EXISTS idx_raw_videos_source_mint_id ON raw_videos(source_mint_id);
CREATE INDEX IF NOT EXISTS idx_raw_videos_is_segment ON raw_videos(is_segment);
CREATE INDEX IF NOT EXISTS idx_raw_videos_clip_segment ON raw_videos(source_clip_id, segment_number);

-- Add unique constraint to prevent duplicate segments from the same source
CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_videos_unique_segment ON raw_videos(source_clip_id, segment_number) WHERE is_segment = TRUE;