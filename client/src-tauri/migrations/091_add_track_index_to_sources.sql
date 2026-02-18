-- Add track_index column to video_editor_sources for multi-track video support
-- NOTE: The actual ALTER TABLEs are handled by self-healing code in schema-healing.ts
-- because SQLite does not support ALTER TABLE ADD COLUMN IF NOT EXISTS,
-- and these columns may already exist from a previous build.
SELECT 1;
