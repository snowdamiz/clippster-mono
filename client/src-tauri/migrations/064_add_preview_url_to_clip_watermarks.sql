-- Add preview_url column to clip_watermarks table
-- Migration: 064_add_preview_url_to_clip_watermarks
-- Created: 2025-01-XX
--
-- Purpose: Store preview URL for watermark display in clip editor.
-- This is needed for organization watermarks which use server URLs instead of local file paths.

ALTER TABLE clip_watermarks ADD COLUMN preview_url TEXT;

