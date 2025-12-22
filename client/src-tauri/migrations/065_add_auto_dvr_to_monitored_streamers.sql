-- Add auto_dvr column to monitored_streamers
-- When enabled, temp recording starts automatically when the streamer goes live
-- allowing users to rewind from the beginning of the stream
ALTER TABLE monitored_streamers ADD COLUMN auto_dvr INTEGER DEFAULT 0;

