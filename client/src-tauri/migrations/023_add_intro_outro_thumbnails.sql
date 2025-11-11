-- Add thumbnail_path column to intro_outros table
ALTER TABLE intro_outros ADD COLUMN thumbnail_path TEXT;

-- Create index for thumbnail_path for better performance
CREATE INDEX IF NOT EXISTS idx_intro_outros_thumbnail_path ON intro_outros(thumbnail_path);