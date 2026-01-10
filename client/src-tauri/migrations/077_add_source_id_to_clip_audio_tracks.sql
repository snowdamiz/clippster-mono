-- Add source_id column to clip_audio_tracks to link extracted audio back to its source video
-- Migration: 077_add_source_id_to_clip_audio_tracks
-- Created: 2025-01-09
--
-- Purpose: Allow tracking which video source audio was extracted from in clip mode
-- This enables automatic muting of video audio when extracted audio track is present

ALTER TABLE clip_audio_tracks ADD COLUMN source_id TEXT;

