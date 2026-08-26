-- Mobile migration 005: clip_builds (stub for Phase 2)
CREATE TABLE IF NOT EXISTS clip_builds (
  id TEXT PRIMARY KEY,
  clip_id TEXT NOT NULL,
  aspect_ratios TEXT,
  quality TEXT,
  frame_rate INTEGER,
  output_format TEXT,
  include_subtitles INTEGER DEFAULT 0,
  file_path TEXT NOT NULL,
  thumbnail_path TEXT,
  file_size INTEGER,
  duration REAL,
  build_number INTEGER NOT NULL DEFAULT 1,
  status TEXT CHECK(status IN ('building', 'completed', 'failed')) DEFAULT 'building',
  error_message TEXT,
  progress REAL DEFAULT 0.0,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (clip_id) REFERENCES clips(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_clip_builds_clip_id ON clip_builds(clip_id);
