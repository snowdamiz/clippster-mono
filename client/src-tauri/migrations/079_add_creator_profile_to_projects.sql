-- Add creator_profile_id to projects table
-- This allows direct association between projects and creator profiles
-- Useful for local video imports where there's no platform_id or livestream session
ALTER TABLE projects ADD COLUMN creator_profile_id TEXT REFERENCES creator_profiles(id) ON DELETE SET NULL;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_projects_creator_profile ON projects(creator_profile_id);

