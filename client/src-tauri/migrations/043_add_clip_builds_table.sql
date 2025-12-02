-- Add clip_builds table to support multiple builds per clip
-- Migration: 043_add_clip_builds_table
-- Created: 2025-12-02
--
-- Purpose: Store multiple builds per clip, allowing users to rebuild clips
-- with different settings while keeping access to all previous builds.

-- Create the clip_builds table
CREATE TABLE IF NOT EXISTS clip_builds (
    id TEXT PRIMARY KEY,
    clip_id TEXT NOT NULL,
    -- Build settings used
    aspect_ratios TEXT,           -- JSON array of aspect ratios used (e.g., ["9:16", "16:9"])
    quality TEXT,                 -- Quality setting (e.g., "high", "medium", "low")
    frame_rate INTEGER,           -- Frame rate used
    output_format TEXT,           -- Output format (e.g., "mp4", "mov")
    include_subtitles INTEGER DEFAULT 0,  -- Whether subtitles were included
    -- Build output
    file_path TEXT NOT NULL,      -- Path to the built video file
    thumbnail_path TEXT,          -- Path to the thumbnail
    file_size INTEGER,            -- File size in bytes
    duration REAL,                -- Duration in seconds
    -- Build metadata
    build_number INTEGER NOT NULL DEFAULT 1,  -- Sequential build number for this clip
    status TEXT CHECK(status IN ('building', 'completed', 'failed')) DEFAULT 'building',
    error_message TEXT,           -- Error message if build failed
    progress REAL DEFAULT 0.0,    -- Build progress (0-100)
    -- Timestamps
    started_at INTEGER NOT NULL,
    completed_at INTEGER,
    created_at INTEGER NOT NULL,
    
    FOREIGN KEY (clip_id) REFERENCES clips(id) ON DELETE CASCADE
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_clip_builds_clip_id ON clip_builds(clip_id);
CREATE INDEX IF NOT EXISTS idx_clip_builds_status ON clip_builds(status);
CREATE INDEX IF NOT EXISTS idx_clip_builds_created_at ON clip_builds(created_at);

-- Migrate existing builds from clips table to clip_builds table
INSERT INTO clip_builds (
    id,
    clip_id,
    file_path,
    thumbnail_path,
    file_size,
    duration,
    build_number,
    status,
    started_at,
    completed_at,
    created_at
)
SELECT 
    lower(hex(randomblob(16))),  -- Generate a new UUID
    id,
    built_file_path,
    built_thumbnail_path,
    built_file_size,
    built_duration,
    1,
    'completed',
    COALESCE(built_at, created_at),
    built_at,
    COALESCE(built_at, created_at)
FROM clips
WHERE built_file_path IS NOT NULL AND build_status = 'completed';

