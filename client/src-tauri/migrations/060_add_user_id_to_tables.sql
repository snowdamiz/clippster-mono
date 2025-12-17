-- Migration 060: Add user_id column to all user-owned tables
-- This enables multi-user support by tagging records with the owning user

-- Add user_id to projects table (primary content table)
ALTER TABLE projects ADD COLUMN user_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

-- Add user_id to prompts table
ALTER TABLE prompts ADD COLUMN user_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_prompts_user_id ON prompts(user_id);

-- Add user_id to intro_outros table
ALTER TABLE intro_outros ADD COLUMN user_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_intro_outros_user_id ON intro_outros(user_id);

-- Add user_id to watermark_images table
ALTER TABLE watermark_images ADD COLUMN user_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_watermark_images_user_id ON watermark_images(user_id);

-- Add user_id to watermark_presets table
ALTER TABLE watermark_presets ADD COLUMN user_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_watermark_presets_user_id ON watermark_presets(user_id);

-- Add user_id to custom_subtitle_presets table
ALTER TABLE custom_subtitle_presets ADD COLUMN user_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_custom_subtitle_presets_user_id ON custom_subtitle_presets(user_id);

-- Add user_id to custom_fonts table
ALTER TABLE custom_fonts ADD COLUMN user_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_custom_fonts_user_id ON custom_fonts(user_id);

-- Add user_id to creator_profiles table
ALTER TABLE creator_profiles ADD COLUMN user_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_creator_profiles_user_id ON creator_profiles(user_id);

-- Add user_id to audio_assets table
ALTER TABLE audio_assets ADD COLUMN user_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_audio_assets_user_id ON audio_assets(user_id);

-- Add user_id to image_assets table
ALTER TABLE image_assets ADD COLUMN user_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_image_assets_user_id ON image_assets(user_id);

-- Add user_id to monitored_streamers table
ALTER TABLE monitored_streamers ADD COLUMN user_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_monitored_streamers_user_id ON monitored_streamers(user_id);

-- Add user_id to video_editor_projects table
ALTER TABLE video_editor_projects ADD COLUMN user_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_video_editor_projects_user_id ON video_editor_projects(user_id);

