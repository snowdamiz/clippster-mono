-- Add thumbnail_path field to raw_videos table
-- Migration: 007_add_thumbnail_path
-- Created: 2025-10-28

ALTER TABLE raw_videos ADD COLUMN thumbnail_path TEXT;
