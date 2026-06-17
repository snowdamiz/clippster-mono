-- Persistent live monitoring preferences (My Creators page)
-- When enabled, the app auto-starts record/auto-detect when the streamer goes live.

ALTER TABLE monitored_streamers ADD COLUMN persistent_auto_detect INTEGER DEFAULT 0;
ALTER TABLE monitored_streamers ADD COLUMN persistent_record INTEGER DEFAULT 0;
ALTER TABLE monitored_streamers ADD COLUMN auto_detect_prompt_id TEXT;
ALTER TABLE monitored_streamers ADD COLUMN auto_detect_prompt_content TEXT;
ALTER TABLE monitored_streamers ADD COLUMN auto_detect_use_creator_layout INTEGER DEFAULT 0;
ALTER TABLE monitored_streamers ADD COLUMN auto_detect_creator_profile_id TEXT;
ALTER TABLE monitored_streamers ADD COLUMN record_use_creator_layout INTEGER DEFAULT 0;
ALTER TABLE monitored_streamers ADD COLUMN record_creator_profile_id TEXT;
