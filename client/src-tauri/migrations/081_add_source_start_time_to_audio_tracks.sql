-- Migration: Add source_start_time to video_editor_audio_tracks
-- NOTE: The actual ALTER TABLE is handled by self-healing code in schema-healing.ts
-- because SQLite does not support ALTER TABLE ADD COLUMN IF NOT EXISTS,
-- and this column may already exist from a previous build.
SELECT 1;
