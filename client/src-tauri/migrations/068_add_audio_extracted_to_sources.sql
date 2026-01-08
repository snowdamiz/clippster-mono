-- Add audio_extracted column to video_editor_sources to track when audio has been extracted
ALTER TABLE video_editor_sources ADD COLUMN audio_extracted INTEGER DEFAULT 0;
