-- Add waveform_data table for storing pre-computed audio waveform data
-- Migration: 017_add_waveform_data
-- Created: 2025-11-03

-- Create waveform_data table
CREATE TABLE IF NOT EXISTS waveform_data (
    id TEXT PRIMARY KEY,
    raw_video_id TEXT NOT NULL,
    sample_rate INTEGER NOT NULL,
    samples_per_pixel INTEGER NOT NULL,
    duration REAL NOT NULL,
    peaks TEXT NOT NULL, -- JSON array of compressed peaks
    min_peaks TEXT NOT NULL, -- JSON array of minimum values
    max_peaks TEXT NOT NULL, -- JSON array of maximum values
    created_at INTEGER NOT NULL,
    FOREIGN KEY (raw_video_id) REFERENCES raw_videos(id) ON DELETE CASCADE
);

-- Create index for efficient lookups by raw video ID
CREATE INDEX IF NOT EXISTS idx_waveform_data_raw_video_id ON waveform_data(raw_video_id);

-- Create index for efficient lookups by creation time
CREATE INDEX IF NOT EXISTS idx_waveform_data_created_at ON waveform_data(created_at);