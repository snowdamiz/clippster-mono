-- VOD Presets table
CREATE TABLE IF NOT EXISTS vod_presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  creator_profile_id TEXT,
  target_aspect_ratio TEXT NOT NULL,
  framing_config TEXT,
  layout_overlays TEXT,
  watermark_mode TEXT NOT NULL DEFAULT 'creator',
  custom_watermark_settings TEXT,
  user_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (creator_profile_id) REFERENCES creator_profiles(id) ON DELETE SET NULL
);

-- Add VOD preset columns to projects table
ALTER TABLE projects ADD COLUMN active_vod_preset_id TEXT;
ALTER TABLE projects ADD COLUMN active_vod_preset_config TEXT;
