-- Add audio_settings column to projects table for storing audio control settings
-- Settings stored as JSON: {"volume": 0, "normalize": false, "fadeIn": 0, "fadeOut": 0}
ALTER TABLE projects ADD COLUMN audio_settings TEXT;

