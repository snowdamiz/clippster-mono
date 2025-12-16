-- Video Editor Projects table
CREATE TABLE IF NOT EXISTS video_editor_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  thumbnail_path TEXT,
  total_duration REAL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Video Editor Sources table
CREATE TABLE IF NOT EXISTS video_editor_sources (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK(source_type IN ('clip', 'raw_video', 'imported')),
  source_id TEXT,
  source_path TEXT NOT NULL,
  source_name TEXT,
  source_thumbnail TEXT,
  source_duration REAL,
  start_time REAL NOT NULL,
  end_time REAL NOT NULL,
  trim_start REAL DEFAULT 0,
  trim_end REAL,
  order_index INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES video_editor_projects(id) ON DELETE CASCADE
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_video_editor_sources_project_id 
ON video_editor_sources(project_id);

