-- Add virality_score column to clip_versions table
-- This migration adds support for AI-generated virality scores for detected clips

ALTER TABLE clip_versions ADD COLUMN virality_score REAL;

