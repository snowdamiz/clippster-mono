-- Fix cascade deletion - Simple approach that doesn't break existing data
-- Migration: 011_fix_cascade_deletion_simple
-- Created: 2025-11-01

-- Since SQLite doesn't support ALTER TABLE for foreign key constraints,
-- we'll create new tables with correct constraints and migrate data

-- Enable foreign key support
PRAGMA foreign_keys = OFF;

-- Create new versions of tables with SET NULL constraints
CREATE TABLE clips_new (
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

CREATE TABLE raw_videos_new (
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
  original_project_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE TABLE transcripts_new (
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

CREATE TABLE transcript_segments_new (
  id TEXT PRIMARY KEY,
  transcript_id TEXT,
  clip_id TEXT,
  start_time REAL NOT NULL,
  end_time REAL NOT NULL,
  text TEXT NOT NULL,
  segment_index INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (transcript_id) REFERENCES transcripts_new(id) ON DELETE SET NULL,
  FOREIGN KEY (clip_id) REFERENCES clips_new(id) ON DELETE SET NULL
);

CREATE TABLE clip_detection_sessions_new (
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

-- Migrate data from existing tables
INSERT INTO raw_videos_new (
  id, project_id, file_path, original_filename, thumbnail_path,
  duration, width, height, frame_rate, codec, file_size,
  original_project_id, created_at, updated_at
)
SELECT
  id, project_id, file_path, original_filename, thumbnail_path,
  duration, width, height, frame_rate, codec, file_size,
  project_id, created_at, COALESCE(updated_at, created_at)
FROM raw_videos;

INSERT INTO clips_new (
  id, project_id, name, file_path, duration, start_time, end_time,
  order_index, intro_id, outro_id, current_version_id, detection_session_id,
  raw_video_id, created_at, updated_at
)
SELECT
  id, project_id, name, file_path, duration, start_time, end_time,
  order_index, intro_id, outro_id, current_version_id, detection_session_id,
  raw_video_id, created_at, COALESCE(updated_at, created_at)
FROM clips;

INSERT INTO transcripts_new (
  id, project_id, raw_video_id, raw_json, text, language,
  duration, created_at, updated_at
)
SELECT
  id, project_id, raw_video_id, raw_json, text, language,
  duration, created_at, COALESCE(updated_at, created_at)
FROM transcripts;

INSERT INTO transcript_segments_new (
  id, transcript_id, clip_id, start_time, end_time, text,
  segment_index, created_at
)
SELECT
  id, transcript_id, clip_id, start_time, end_time, text,
  segment_index, created_at
FROM transcript_segments;

INSERT INTO clip_detection_sessions_new (
  id, project_id, prompt, detection_model, server_response_id,
  quality_score, total_clips_detected, processing_time_ms,
  validation_data, created_at
)
SELECT
  id, project_id, prompt, detection_model, server_response_id,
  quality_score, total_clips_detected, processing_time_ms,
  validation_data, created_at
FROM clip_detection_sessions;

-- Drop old tables
DROP TABLE IF EXISTS transcript_segments;
DROP TABLE IF EXISTS transcripts;
DROP TABLE IF EXISTS clips;
DROP TABLE IF EXISTS raw_videos;
DROP TABLE IF EXISTS clip_detection_sessions;

-- Rename new tables
ALTER TABLE raw_videos_new RENAME TO raw_videos;
ALTER TABLE clips_new RENAME TO clips;
ALTER TABLE transcripts_new RENAME TO transcripts;
ALTER TABLE transcript_segments_new RENAME TO transcript_segments;
ALTER TABLE clip_detection_sessions_new RENAME TO clip_detection_sessions;

-- Re-enable foreign keys
PRAGMA foreign_keys = ON;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_raw_videos_project ON raw_videos(project_id);
CREATE INDEX IF NOT EXISTS idx_clips_project ON clips(project_id);
CREATE INDEX IF NOT EXISTS idx_clips_raw_video ON clips(raw_video_id);
CREATE INDEX IF NOT EXISTS idx_clips_detection_session_id ON clips(detection_session_id);
CREATE INDEX IF NOT EXISTS idx_clips_current_version_id ON clips(current_version_id);
CREATE INDEX IF NOT EXISTS idx_segments_transcript ON transcript_segments(transcript_id);
CREATE INDEX IF NOT EXISTS idx_segments_clip ON transcript_segments(clip_id);
CREATE INDEX IF NOT EXISTS idx_segments_time ON transcript_segments(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_clip_detection_sessions_project_id ON clip_detection_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_clip_detection_sessions_created_at ON clip_detection_sessions(created_at);

-- Note: clip_versions table will be created by migration 10 and should still work correctly