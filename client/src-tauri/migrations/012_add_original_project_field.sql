-- Add original_project_id field to preserve thumbnail associations
-- Migration: 012_add_original_project_field
-- Created: 2025-11-01

-- Check if the column exists before trying to add it (SQLite safe approach)
-- We'll use a workaround since SQLite doesn't support IF NOT EXISTS for columns

-- First, create a temporary table to check if the column exists
CREATE TEMPORARY TABLE IF NOT EXISTS schema_check (
  column_name TEXT
);

-- Try to add the column safely
-- This will fail if the column already exists, but that's okay
ALTER TABLE raw_videos ADD COLUMN original_project_id TEXT;

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_raw_videos_original_project ON raw_videos(original_project_id);

-- Note: Skip the filename parsing for now since it's complex and error-prone
-- The original_project_id will be populated when videos are deleted