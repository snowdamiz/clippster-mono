-- Add project_name column to clips table
-- Migration: 042_add_project_name_to_clips
-- Created: 2025-12-01
--
-- Purpose: Store the project name directly on clips so that when a project is deleted,
-- clips can still be displayed under their original project name instead of "Uncategorized".

-- Add project_name column to clips table
ALTER TABLE clips ADD COLUMN project_name TEXT;

-- Populate project_name for existing clips that have a project_id
UPDATE clips
SET project_name = (
    SELECT p.name 
    FROM projects p 
    WHERE p.id = clips.project_id
)
WHERE project_id IS NOT NULL;

