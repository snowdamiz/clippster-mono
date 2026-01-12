-- Add keyframes_data column to video_editor_text_overlays for animation keyframes
ALTER TABLE video_editor_text_overlays ADD COLUMN keyframes_data TEXT;

-- Add keyframes_data column to video_editor_stickers for animation keyframes
ALTER TABLE video_editor_stickers ADD COLUMN keyframes_data TEXT;

-- Add keyframes_data column to video_editor_watermarks for animation keyframes
ALTER TABLE video_editor_watermarks ADD COLUMN keyframes_data TEXT;
