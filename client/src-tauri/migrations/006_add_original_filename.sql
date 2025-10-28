-- Add original_filename field to raw_videos table
-- Migration: 006_add_original_filename
-- Created: 2025-10-28

ALTER TABLE raw_videos ADD COLUMN original_filename TEXT;
