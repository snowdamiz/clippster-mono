-- Add focal points table for time-based focal point detection
-- Migration: 027_add_focal_points
-- Created: 2025-11-17

-- Create focal_points table to store focal point coordinates at time intervals
CREATE TABLE IF NOT EXISTS focal_points (
  id TEXT PRIMARY KEY,
  raw_video_id TEXT NOT NULL,
  time_offset REAL NOT NULL,
  focal_x REAL NOT NULL CHECK(focal_x >= 0.0 AND focal_x <= 1.0),
  focal_y REAL NOT NULL CHECK(focal_y >= 0.0 AND focal_y <= 1.0),
  confidence REAL CHECK(confidence >= 0.0 AND confidence <= 1.0),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (raw_video_id) REFERENCES raw_videos(id) ON DELETE CASCADE
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_focal_points_raw_video ON focal_points(raw_video_id);
CREATE INDEX IF NOT EXISTS idx_focal_points_time ON focal_points(raw_video_id, time_offset);

