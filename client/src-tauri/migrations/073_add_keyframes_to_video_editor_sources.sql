-- Add keyframes_data column to video_editor_sources table
ALTER TABLE video_editor_sources ADD COLUMN keyframes_data TEXT DEFAULT NULL;
