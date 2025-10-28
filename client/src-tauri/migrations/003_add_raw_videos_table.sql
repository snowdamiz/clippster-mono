-- Add raw_videos table and migrate data from projects.raw_video_path
-- Migration: 003_add_raw_videos_table
-- Created: 2025-10-28

-- Create raw_videos table
CREATE TABLE IF NOT EXISTS raw_videos (
  id TEXT PRIMARY KEY,
  project_id TEXT UNIQUE NOT NULL,
  file_path TEXT NOT NULL,
  duration REAL,
  width INTEGER,
  height INTEGER,
  frame_rate REAL,
  codec TEXT,
  file_size INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_raw_videos_project ON raw_videos(project_id);

-- Migrate existing raw_video_path data to raw_videos table
INSERT INTO raw_videos (id, project_id, file_path, created_at, updated_at)
SELECT 
  lower(hex(randomblob(16))),  -- Generate UUID-like id
  id,
  raw_video_path,
  updated_at,
  updated_at
FROM projects
WHERE raw_video_path IS NOT NULL;

-- Add raw_video_id to clips table
ALTER TABLE clips ADD COLUMN raw_video_id TEXT REFERENCES raw_videos(id) ON DELETE SET NULL;

-- Populate raw_video_id in clips based on project_id
UPDATE clips
SET raw_video_id = (
  SELECT rv.id 
  FROM raw_videos rv 
  WHERE rv.project_id = clips.project_id
);

CREATE INDEX IF NOT EXISTS idx_clips_raw_video ON clips(raw_video_id);

-- Note: We keep raw_video_path in projects for backward compatibility
-- It can be removed in a future migration once all code is updated
