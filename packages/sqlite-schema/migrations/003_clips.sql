-- Mobile migration 003: clips, versions, segments
CREATE TABLE IF NOT EXISTS clip_detection_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  detection_model TEXT NOT NULL DEFAULT 'claude-3.5-sonnet',
  server_response_id TEXT,
  quality_score REAL,
  total_clips_detected INTEGER DEFAULT 0,
  processing_time_ms INTEGER,
  validation_data TEXT,
  run_color TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS clips (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  name TEXT,
  file_path TEXT NOT NULL,
  duration REAL,
  start_time REAL,
  end_time REAL,
  order_index INTEGER,
  current_version_id TEXT,
  detection_session_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_clips_project ON clips(project_id);

CREATE TABLE IF NOT EXISTS clip_versions (
  id TEXT PRIMARY KEY,
  clip_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  parent_version_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  start_time REAL NOT NULL,
  end_time REAL NOT NULL,
  confidence_score REAL,
  virality_score REAL,
  relevance_score REAL,
  detection_reason TEXT,
  tags TEXT,
  change_type TEXT NOT NULL CHECK(change_type IN ('detected', 'modified', 'deleted')),
  change_description TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (clip_id) REFERENCES clips(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES clip_detection_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_clip_versions_clip_id ON clip_versions(clip_id);

CREATE TABLE IF NOT EXISTS clip_segments (
  id TEXT PRIMARY KEY,
  clip_version_id TEXT NOT NULL,
  segment_index INTEGER NOT NULL,
  start_time REAL NOT NULL,
  end_time REAL NOT NULL,
  duration REAL NOT NULL,
  transcript TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (clip_version_id) REFERENCES clip_versions(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clip_segments_unique_order ON clip_segments(clip_version_id, segment_index);
