-- Mobile migration 002: raw_videos
CREATE TABLE IF NOT EXISTS raw_videos (
  id TEXT PRIMARY KEY,
  project_id TEXT UNIQUE,
  file_path TEXT NOT NULL,
  original_filename TEXT,
  thumbnail_path TEXT,
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
