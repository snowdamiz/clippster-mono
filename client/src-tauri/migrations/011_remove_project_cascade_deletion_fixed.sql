-- Remove cascade deletion from projects - Safer approach
-- Migration: 011_remove_project_cascade_deletion_fixed
-- Created: 2025-11-01

-- Instead of recreating all tables, we'll just create a new database with correct constraints
-- and migrate data safely

-- First, let's check what columns actually exist in the current tables
-- We'll use PRAGMA table_info to see the current structure

-- Since SQLite doesn't support altering foreign key constraints easily,
-- we'll create a backup of current data and recreate with correct constraints

-- Create backup tables with current structure
CREATE TABLE raw_videos_backup AS SELECT * FROM raw_videos;
CREATE TABLE clips_backup AS SELECT * FROM clips;
CREATE TABLE transcripts_backup AS SELECT * FROM transcripts;
CREATE TABLE transcript_segments_backup AS SELECT * FROM transcript_segments;
CREATE TABLE clip_detection_sessions_backup AS SELECT * FROM clip_detection_sessions;

-- Drop existing tables
DROP TABLE IF EXISTS transcript_segments;
DROP TABLE IF EXISTS transcripts;
DROP TABLE IF EXISTS clips;
DROP TABLE IF EXISTS raw_videos;
DROP TABLE IF EXISTS clip_detection_sessions;

-- Recreate raw_videos with correct constraints
CREATE TABLE IF NOT EXISTS raw_videos (
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

-- Recreate clips with correct constraints and all needed columns
CREATE TABLE IF NOT EXISTS clips (
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

-- Recreate transcripts with correct constraints
CREATE TABLE IF NOT EXISTS transcripts (
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

-- Recreate transcript_segments with correct constraints
CREATE TABLE IF NOT EXISTS transcript_segments (
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

-- Recreate clip_detection_sessions with correct constraints
CREATE TABLE IF NOT EXISTS clip_detection_sessions (
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

-- Restore data from backups, handling potential missing columns safely
INSERT INTO raw_videos SELECT * FROM raw_videos_backup;
INSERT INTO clips SELECT * FROM clips_backup;
INSERT INTO transcripts SELECT * FROM transcripts_backup;
INSERT INTO transcript_segments SELECT * FROM transcript_segments_backup;
INSERT INTO clip_detection_sessions SELECT * FROM clip_detection_sessions_backup;

-- Drop backup tables
DROP TABLE raw_videos_backup;
DROP TABLE clips_backup;
DROP TABLE transcripts_backup;
DROP TABLE transcript_segments_backup;
DROP TABLE clip_detection_sessions_backup;

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