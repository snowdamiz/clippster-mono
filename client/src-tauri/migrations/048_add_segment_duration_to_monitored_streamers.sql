-- Add segment_duration_minutes column to monitored_streamers table
-- Migration: 048_add_segment_duration_to_monitored_streamers
-- Created: 2025-12-06
--
-- Purpose: Allow per-streamer configuration of recording segment duration
-- Default is 5 minutes which was the previous hardcoded value

ALTER TABLE monitored_streamers ADD COLUMN segment_duration_minutes INTEGER DEFAULT 5;

