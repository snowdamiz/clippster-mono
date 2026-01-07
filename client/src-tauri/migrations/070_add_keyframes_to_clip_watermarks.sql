-- Add keyframes_data column to clip_watermarks table
-- Migration: 070_add_keyframes_to_clip_watermarks
-- Created: 2025-01-06
--
-- Purpose: Add keyframes_data column to support animated watermarks in clip editor.
-- This column stores JSON data for keyframe animations.

ALTER TABLE clip_watermarks ADD COLUMN keyframes_data TEXT;
