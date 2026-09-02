-- Mobile migration 004: transcripts
CREATE TABLE IF NOT EXISTS transcripts (
  id TEXT PRIMARY KEY,
  raw_video_id TEXT NOT NULL UNIQUE,
  raw_json TEXT NOT NULL,
  text TEXT NOT NULL,
  language TEXT,
  duration REAL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (raw_video_id) REFERENCES raw_videos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_transcripts_raw_video ON transcripts(raw_video_id);
