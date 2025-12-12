-- Add per_ratio_configs_data column to clip_text_overlays table
-- Migration: 053_add_per_ratio_configs_to_text_overlays
-- Created: 2025-01-XX
--
-- Purpose: Store per-aspect-ratio configurations for text overlays.
-- This allows text overlays to have different positions and styles for each aspect ratio.

ALTER TABLE clip_text_overlays ADD COLUMN per_ratio_configs_data TEXT;

