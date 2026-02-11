-- Add transcript_raw_json column to clip_segments for word-level timing data
-- NOTE: The actual ALTER TABLE is handled by self-healing code in schema-healing.ts
-- because SQLite does not support ALTER TABLE ADD COLUMN IF NOT EXISTS.
SELECT 1;
