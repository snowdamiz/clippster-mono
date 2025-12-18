-- Add watermark settings to creator_profiles
-- Migration: 060_add_creator_watermark_position
-- Created: 2025-01-09
-- This allows each creator to have custom watermark positions per aspect ratio

-- Add watermark settings as JSON (stores positions for each aspect ratio)
-- Format: { "16:9": { x, y, opacity, scale } | null, "9:16": {...} | null, ... }
-- A null value means watermark is disabled for that aspect ratio
-- By default, only 16:9 is enabled
ALTER TABLE creator_profiles ADD COLUMN watermark_settings TEXT DEFAULT '{"16:9":{"x":90,"y":10,"opacity":80,"scale":15},"9:16":null,"1:1":null,"4:5":null}';

