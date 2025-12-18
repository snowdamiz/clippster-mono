-- Add default_watermark_settings column to projects table
-- This stores watermark settings from creator profiles when downloading VODs
-- so watermarks can be applied even when the creator profile isn't linked locally

ALTER TABLE projects ADD COLUMN default_watermark_settings TEXT;

