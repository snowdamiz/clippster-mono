-- Migration: Add source_start_time to video_editor_audio_tracks
-- This field tracks which portion of the source audio file to play (like trim_start for video)
-- When audio tracks are split, each segment needs to know its offset into the source file

-- Add source_start_time column with default value of 0
ALTER TABLE video_editor_audio_tracks ADD COLUMN source_start_time REAL NOT NULL DEFAULT 0;

-- For existing audio tracks, calculate source_start_time based on their timeline position
-- Assumption: existing tracks that haven't been split start at the beginning of their audio file (0)
-- This is correct for tracks that were added directly from media library
-- If tracks were split before this migration, they will need to be re-split to get correct offsets
UPDATE video_editor_audio_tracks SET source_start_time = 0 WHERE source_start_time IS NULL;
