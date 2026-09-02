-- Mobile migration 011: clip preview thumbnails (matches desktop clips.built_thumbnail_path)
ALTER TABLE clips ADD COLUMN built_thumbnail_path TEXT;
