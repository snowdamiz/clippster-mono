-- Add pan column to audio tracks
-- Migration: 072_add_pan_to_audio_tracks
-- Created: 2025-01-06
--
-- Purpose: Add 'pan' column to clip_audio_tracks and video_editor_audio_tracks
-- to support audio panning (-1.0 to 1.0).

-- Add pan to clip_audio_tracks
ALTER TABLE clip_audio_tracks ADD COLUMN pan REAL DEFAULT 0;

-- Add pan to video_editor_audio_tracks
ALTER TABLE video_editor_audio_tracks ADD COLUMN pan REAL DEFAULT 0;
