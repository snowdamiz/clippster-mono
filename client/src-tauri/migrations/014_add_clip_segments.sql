-- Add clip_segments table for multi-segment clip support
-- This migration adds support for storing individual segments within clips
-- This enables proper timeline visualization of multi-segment clips

-- Table to store individual segments for each clip version
CREATE TABLE clip_segments (
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

-- Create index for efficient segment queries
CREATE INDEX idx_clip_segments_version_id ON clip_segments(clip_version_id);

-- Add unique constraint to prevent duplicate segments
CREATE UNIQUE INDEX idx_clip_segments_unique_order ON clip_segments(clip_version_id, segment_index);