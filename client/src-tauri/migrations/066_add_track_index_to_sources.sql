-- Add track_index column to video_editor_sources for multi-track video support
ALTER TABLE video_editor_sources ADD COLUMN track_index INTEGER DEFAULT 0;

-- Add layer column to video_editor_text_overlays for multi-track overlay support
ALTER TABLE video_editor_text_overlays ADD COLUMN layer INTEGER DEFAULT 0;

-- Add layer column to video_editor_stickers for multi-track overlay support
ALTER TABLE video_editor_stickers ADD COLUMN layer INTEGER DEFAULT 0;

-- Add layer column to video_editor_watermarks for multi-track overlay support
ALTER TABLE video_editor_watermarks ADD COLUMN layer INTEGER DEFAULT 0;

-- Add layer column to clip_watermarks for multi-track overlay support (clip mode)
ALTER TABLE clip_watermarks ADD COLUMN layer INTEGER DEFAULT 0;
