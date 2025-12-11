-- Add per-creator audio sync offset for live recordings
-- Default 215ms matches the current hardcoded value that works for most streams
-- Positive = advance audio (fixes "audio behind video")
-- Negative = delay audio (fixes "video behind audio")
ALTER TABLE creator_profiles ADD COLUMN audio_sync_offset_ms INTEGER DEFAULT 215;

