-- Mobile migration 007: raw_videos platform + source metadata
ALTER TABLE raw_videos ADD COLUMN platform TEXT;
ALTER TABLE raw_videos ADD COLUMN source_url TEXT;
