-- Add status field to clips table
-- Migration: 015_add_clip_status
-- Created: 2025-11-01

-- Add status field to clips table
ALTER TABLE clips ADD COLUMN status TEXT CHECK(status IN ('detected', 'generated', 'processing')) DEFAULT 'detected';

-- Create index for status field for efficient querying
CREATE INDEX IF NOT EXISTS idx_clips_status ON clips(status);

-- Update existing clips based on file existence
-- Clips with existing files are marked as 'generated'
-- Clips without existing files are marked as 'detected'
UPDATE clips
SET status = CASE
    WHEN file_path IS NOT NULL AND file_path != '' THEN 'generated'
    ELSE 'detected'
END
WHERE status IS NULL OR status = 'detected';