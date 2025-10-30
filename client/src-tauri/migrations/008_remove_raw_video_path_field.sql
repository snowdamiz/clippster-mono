-- Remove raw_video_path field from projects table
-- Migration: 008_remove_raw_video_path_field
-- Created: 2025-10-30

-- First, ensure all projects with raw_video_path have corresponding raw_videos entries
INSERT INTO raw_videos (id, project_id, file_path, original_filename, thumbnail_path, created_at, updated_at)
SELECT
  lower(hex(randomblob(16))),
  id,
  raw_video_path,
  raw_video_path,
  NULL,
  created_at,
  updated_at
FROM projects
WHERE raw_video_path IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM raw_videos
    WHERE raw_videos.project_id = projects.id
  );

-- Now drop the raw_video_path column
ALTER TABLE projects DROP COLUMN raw_video_path;