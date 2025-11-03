-- Drop waveform_data table and related indexes
-- Migration: 018_drop_waveform_data
-- Created: 2025-11-03

-- Drop indexes first
DROP INDEX IF EXISTS idx_waveform_data_raw_video_id;
DROP INDEX IF EXISTS idx_waveform_data_created_at;

-- Drop the waveform_data table
DROP TABLE IF EXISTS waveform_data;