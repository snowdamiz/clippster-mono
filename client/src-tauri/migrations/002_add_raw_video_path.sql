-- Add raw_video_path field to projects table
-- Migration: 002_add_raw_video_path
-- Created: 2025-10-27

ALTER TABLE projects ADD COLUMN raw_video_path TEXT;
