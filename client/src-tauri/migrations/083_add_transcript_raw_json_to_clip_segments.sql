-- Add transcript_raw_json column to clip_segments for word-level timing data
-- This makes clips fully self-contained with their own word-level transcript
-- so the editor never needs to query the VOD transcript

ALTER TABLE clip_segments ADD COLUMN transcript_raw_json TEXT;
