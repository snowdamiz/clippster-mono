-- Fix cascade deletion for clips and raw_videos tables
-- Migration: 041_fix_clips_cascade_deletion
-- Created: 2025-12-01
--
-- Problem: The original clips and raw_videos tables have ON DELETE CASCADE for project_id,
-- which means they are deleted when their project is deleted.
-- This migration changes it to ON DELETE SET NULL to preserve content.

-- SQLite doesn't support ALTER TABLE for foreign key constraints,
-- so we need to recreate the tables

PRAGMA foreign_keys = OFF;

-- ============================================
-- FIX CLIPS TABLE
-- ============================================

-- Drop existing triggers that reference clips table FIRST
DROP TRIGGER IF EXISTS update_clip_current_version;
DROP TRIGGER IF EXISTS update_clip_current_version_on_modify;

-- Create new clips table with SET NULL constraint
CREATE TABLE clips_fixed (
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
  status TEXT CHECK(status IN ('detected', 'generated', 'processing')) DEFAULT 'detected',
  build_status TEXT CHECK(build_status IN ('pending', 'building', 'completed', 'failed')) DEFAULT 'pending',
  built_file_path TEXT,
  built_thumbnail_path TEXT,
  build_progress REAL,
  build_error TEXT,
  built_at INTEGER,
  built_file_size INTEGER,
  built_duration REAL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (intro_id) REFERENCES intro_outros(id) ON DELETE SET NULL,
  FOREIGN KEY (outro_id) REFERENCES intro_outros(id) ON DELETE SET NULL,
  FOREIGN KEY (raw_video_id) REFERENCES raw_videos(id) ON DELETE SET NULL
);

-- Copy all data from old clips table
INSERT INTO clips_fixed (
  id, project_id, name, file_path, duration, start_time, end_time,
  order_index, intro_id, outro_id, current_version_id, detection_session_id,
  raw_video_id, status, build_status, built_file_path, built_thumbnail_path,
  build_progress, build_error, built_at, built_file_size, built_duration,
  created_at, updated_at
)
SELECT
  id, project_id, name, file_path, duration, start_time, end_time,
  order_index, intro_id, outro_id, current_version_id, detection_session_id,
  raw_video_id, status, build_status, built_file_path, built_thumbnail_path,
  build_progress, build_error, built_at, built_file_size, built_duration,
  created_at, updated_at
FROM clips;

-- Drop old clips table
DROP TABLE clips;

-- Rename new table
ALTER TABLE clips_fixed RENAME TO clips;

-- Recreate clips indexes
CREATE INDEX IF NOT EXISTS idx_clips_project ON clips(project_id);
CREATE INDEX IF NOT EXISTS idx_clips_raw_video ON clips(raw_video_id);
CREATE INDEX IF NOT EXISTS idx_clips_detection_session_id ON clips(detection_session_id);
CREATE INDEX IF NOT EXISTS idx_clips_current_version_id ON clips(current_version_id);
CREATE INDEX IF NOT EXISTS idx_clips_status ON clips(status);

-- Recreate triggers for clip_versions
-- Trigger to update current_version_id when a new clip version is detected
CREATE TRIGGER IF NOT EXISTS update_clip_current_version
AFTER INSERT ON clip_versions
WHEN NEW.change_type = 'detected'
BEGIN
    UPDATE clips
    SET current_version_id = NEW.id,
        detection_session_id = NEW.session_id
    WHERE id = NEW.clip_id;
END;

-- Trigger to update current_version_id when a clip is modified
CREATE TRIGGER IF NOT EXISTS update_clip_current_version_on_modify
AFTER INSERT ON clip_versions
WHEN NEW.change_type = 'modified'
BEGIN
    UPDATE clips
    SET current_version_id = NEW.id
    WHERE id = NEW.clip_id;
END;

-- ============================================
-- FIX RAW_VIDEOS TABLE
-- ============================================

-- Create new raw_videos table with SET NULL constraint
CREATE TABLE raw_videos_fixed (
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
  source_clip_id TEXT,
  source_mint_id TEXT,
  segment_number INTEGER,
  is_segment INTEGER DEFAULT 0,
  segment_start_time REAL,
  segment_end_time REAL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

-- Copy all data from old raw_videos table
INSERT INTO raw_videos_fixed (
  id, project_id, file_path, original_filename, thumbnail_path,
  duration, width, height, frame_rate, codec, file_size,
  original_project_id, source_clip_id, source_mint_id, segment_number,
  is_segment, segment_start_time, segment_end_time,
  created_at, updated_at
)
SELECT
  id, project_id, file_path, original_filename, thumbnail_path,
  duration, width, height, frame_rate, codec, file_size,
  original_project_id, source_clip_id, source_mint_id, segment_number,
  COALESCE(is_segment, 0), segment_start_time, segment_end_time,
  created_at, updated_at
FROM raw_videos;

-- Drop old raw_videos table
DROP TABLE raw_videos;

-- Rename new table
ALTER TABLE raw_videos_fixed RENAME TO raw_videos;

-- Recreate raw_videos indexes
CREATE INDEX IF NOT EXISTS idx_raw_videos_project ON raw_videos(project_id);

PRAGMA foreign_keys = ON;

