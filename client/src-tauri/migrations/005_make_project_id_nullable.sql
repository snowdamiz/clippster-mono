-- Make project_id nullable in raw_videos table
-- Migration: 005_make_project_id_nullable
-- Created: 2025-10-28

-- SQLite doesn't support ALTER COLUMN, so we need to recreate the table
CREATE TABLE raw_videos_new (
  id TEXT PRIMARY KEY,
  project_id TEXT UNIQUE,
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

-- Copy existing data
INSERT INTO raw_videos_new SELECT * FROM raw_videos;

-- Drop old table and rename new one
DROP TABLE raw_videos;
ALTER TABLE raw_videos_new RENAME TO raw_videos;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_raw_videos_project ON raw_videos(project_id);
