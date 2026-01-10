-- Add source_id and keyframes_data columns to video_editor_audio_tracks
-- Migration: 076_add_source_id_keyframes_to_audio_tracks
-- Created: 2026-01-09
--
-- Purpose: Add missing columns to audio tracks table:
-- - source_id: Links extracted audio back to its source video
-- - keyframes_data: Stores keyframe animation data for volume/pan

-- Add source_id to video_editor_audio_tracks
ALTER TABLE video_editor_audio_tracks ADD COLUMN source_id TEXT DEFAULT NULL;

-- Add keyframes_data to video_editor_audio_tracks  
ALTER TABLE video_editor_audio_tracks ADD COLUMN keyframes_data TEXT DEFAULT NULL;
