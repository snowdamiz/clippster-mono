-- Add clip build status fields
-- Migration: 016_add_clip_build_fields
-- Created: 2025-11-16

-- Add build-specific status field to clips table
ALTER TABLE clips ADD COLUMN build_status TEXT CHECK(build_status IN ('pending', 'building', 'completed', 'failed')) DEFAULT 'pending';

-- Add file path for the built clip
ALTER TABLE clips ADD COLUMN built_file_path TEXT;

-- Add thumbnail path for the built clip
ALTER TABLE clips ADD COLUMN built_thumbnail_path TEXT;

-- Add build progress tracking
ALTER TABLE clips ADD COLUMN build_progress REAL DEFAULT 0.0;

-- Add build error message
ALTER TABLE clips ADD COLUMN build_error TEXT;

-- Add build completion timestamp
ALTER TABLE clips ADD COLUMN built_at INTEGER;

-- Add file size of the built clip
ALTER TABLE clips ADD COLUMN built_file_size INTEGER;

-- Add duration of the built clip (may differ from detected duration)
ALTER TABLE clips ADD COLUMN built_duration REAL;

-- Create indexes for build fields for efficient querying
CREATE INDEX IF NOT EXISTS idx_clips_build_status ON clips(build_status);
CREATE INDEX IF NOT EXISTS idx_clips_built_at ON clips(built_at);

-- Update existing clips to have 'pending' build status if they have file_path but no build_status
UPDATE clips
SET build_status = 'pending'
WHERE build_status IS NULL AND file_path IS NOT NULL AND file_path != '';

-- Set default build_status to NULL for clips without file_path
UPDATE clips
SET build_status = NULL
WHERE build_status IS NULL AND (file_path IS NULL OR file_path = '');