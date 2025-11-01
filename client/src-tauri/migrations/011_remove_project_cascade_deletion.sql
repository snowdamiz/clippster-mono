-- Remove cascade deletion from projects to preserve raw videos and clips
-- Migration: 011_remove_project_cascade_deletion
-- Created: 2025-11-01

-- SQLite doesn't support ALTER TABLE to modify foreign key constraints directly
-- We need to recreate the tables with new constraints

-- 1. Create new versions of the tables with SET NULL constraints
CREATE TABLE `raw_videos_new` (
  id TEXT PRIMARY KEY,
  project_id TEXT,
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
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE TABLE `clips_new` (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  name TEXT,
  file_path TEXT NOT NULL,
  duration REAL,
  start_time REAL,
  end_time REAL,
  order_index INTEGER,
  intro_id TEXT,
  outro_id TEXT,
  current_version_id TEXT,
  detection_session_id TEXT,
  raw_video_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (intro_id) REFERENCES intro_outros(id) ON DELETE SET NULL,
  FOREIGN KEY (outro_id) REFERENCES intro_outros(id) ON DELETE SET NULL,
  FOREIGN KEY (raw_video_id) REFERENCES raw_videos(id) ON DELETE SET NULL
);

-- 2. Copy data from old tables to new tables
INSERT INTO raw_videos_new SELECT * FROM raw_videos;
INSERT INTO clips_new SELECT * FROM clips;

-- 3. Drop old tables
DROP TABLE raw_videos;
DROP TABLE clips;

-- 4. Rename new tables to original names
ALTER TABLE raw_videos_new RENAME TO raw_videos;
ALTER TABLE clips_new RENAME TO clips;

-- 5. Recreate indexes
CREATE INDEX IF NOT EXISTS idx_raw_videos_project ON raw_videos(project_id);
CREATE INDEX IF NOT EXISTS idx_clips_project ON clips(project_id);
CREATE INDEX IF NOT EXISTS idx_clips_raw_video ON clips(raw_video_id);
CREATE INDEX IF NOT EXISTS idx_clips_detection_session_id ON clips(detection_session_id);
CREATE INDEX IF NOT EXISTS idx_clips_current_version_id ON clips(current_version_id);

-- 6. Update transcripts to also use SET NULL instead of CASCADE
-- Since transcripts are referenced by clips through transcript_segments, we should preserve them too
CREATE TABLE `transcripts_new` (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  raw_video_id TEXT,
  raw_json TEXT NOT NULL,
  text TEXT NOT NULL,
  language TEXT,
  duration REAL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (raw_video_id) REFERENCES raw_videos(id) ON DELETE SET NULL
);

INSERT INTO transcripts_new SELECT * FROM transcripts;
DROP TABLE transcripts;
ALTER TABLE transcripts_new RENAME TO transcripts;

-- 7. Update transcript_segments foreign key to transcripts to also use SET NULL
CREATE TABLE `transcript_segments_new` (
  id TEXT PRIMARY KEY,
  transcript_id TEXT,
  clip_id TEXT,
  start_time REAL NOT NULL,
  end_time REAL NOT NULL,
  text TEXT NOT NULL,
  segment_index INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (transcript_id) REFERENCES transcripts(id) ON DELETE SET NULL,
  FOREIGN KEY (clip_id) REFERENCES clips(id) ON DELETE SET NULL
);

INSERT INTO transcript_segments_new SELECT * FROM transcript_segments;
DROP TABLE transcript_segments;
ALTER TABLE transcript_segments_new RENAME TO transcript_segments;

-- 8. Recreate transcript segments indexes
CREATE INDEX IF NOT EXISTS idx_segments_transcript ON transcript_segments(transcript_id);
CREATE INDEX IF NOT EXISTS idx_segments_clip ON transcript_segments(clip_id);
CREATE INDEX IF NOT EXISTS idx_segments_time ON transcript_segments(start_time, end_time);

-- 9. Update clip_detection_sessions to preserve session data when project is deleted
CREATE TABLE `clip_detection_sessions_new` (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    prompt TEXT NOT NULL,
    detection_model TEXT NOT NULL DEFAULT 'claude-3.5-sonnet',
    server_response_id TEXT,
    quality_score REAL,
    total_clips_detected INTEGER DEFAULT 0,
    processing_time_ms INTEGER,
    validation_data TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

INSERT INTO clip_detection_sessions_new SELECT * FROM clip_detection_sessions;
DROP TABLE clip_detection_sessions;
ALTER TABLE clip_detection_sessions_new RENAME TO clip_detection_sessions;

-- 10. Recreate clip detection sessions indexes
CREATE INDEX IF NOT EXISTS idx_clip_detection_sessions_project_id ON clip_detection_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_clip_detection_sessions_created_at ON clip_detection_sessions(created_at);

-- Note: clip_versions table still uses CASCADE for clip_id and session_id because versions
-- should be deleted if their parent clip or session is deleted. This maintains data integrity.