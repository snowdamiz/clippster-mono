-- Add preview_height column to clip_text_overlays table
-- Migration: 054_add_preview_height_to_text_overlays
-- Created: 2025-01-XX
--
-- Purpose: Store the preview container height when text overlay was configured.
-- This is used to calculate the correct font scaling factor during export.
-- Font sizes are relative to this height, so we scale by (output_height / preview_height).

ALTER TABLE clip_text_overlays ADD COLUMN preview_height REAL;

