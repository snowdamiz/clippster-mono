-- Add output_paths column to clip_builds table to store all aspect ratio variations
-- Migration: 047_add_output_paths_to_clip_builds
-- Created: 2025-12-06
--
-- Purpose: Store all output file paths when building a clip with multiple aspect ratios
-- Previously only the first output path was stored, now we store all of them as JSON array

-- Add output_paths column (JSON array of all output file paths)
ALTER TABLE clip_builds ADD COLUMN output_paths TEXT;

-- Migrate existing data: if file_path exists, create a JSON array with it
UPDATE clip_builds 
SET output_paths = json_array(file_path) 
WHERE file_path IS NOT NULL AND file_path != '' AND output_paths IS NULL;

