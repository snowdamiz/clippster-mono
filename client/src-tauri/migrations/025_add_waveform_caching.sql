-- Add waveform_data table for storing pre-computed audio waveform data
-- Migration: 025_add_waveform_caching
-- Created: 2025-01-12

-- Create waveform_data table with improved schema
CREATE TABLE IF NOT EXISTS waveform_data (
    id TEXT PRIMARY KEY,
    raw_video_id TEXT NOT NULL,
    video_path_hash TEXT NOT NULL, -- Hash of video path for direct lookup
    sample_rate INTEGER NOT NULL DEFAULT 44100,
    duration REAL NOT NULL,
    -- Multi-resolution waveform data stored as JSON
    resolutions TEXT NOT NULL, -- JSON object with resolution levels (low, medium, high, ultra, extreme)
    -- Metadata for cache validation
    file_size INTEGER, -- Video file size for cache invalidation
    file_modified_time INTEGER, -- Video file modification time for cache invalidation
    created_at INTEGER NOT NULL,
    accessed_at INTEGER NOT NULL, -- Track last access for LRU cleanup
    FOREIGN KEY (raw_video_id) REFERENCES raw_videos(id) ON DELETE CASCADE
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_waveform_data_raw_video_id ON waveform_data(raw_video_id);
CREATE INDEX IF NOT EXISTS idx_waveform_data_video_path_hash ON waveform_data(video_path_hash);
CREATE INDEX IF NOT EXISTS idx_waveform_data_accessed_at ON waveform_data(accessed_at);

-- Create unique constraint to prevent duplicate waveforms for same video
CREATE UNIQUE INDEX IF NOT EXISTS idx_waveform_data_unique_video ON waveform_data(raw_video_id, video_path_hash);

-- Note: accessed_at timestamp will be updated manually in application code