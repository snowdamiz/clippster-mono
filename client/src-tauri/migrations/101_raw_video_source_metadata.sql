-- Store platform + original source URL so cloud sync can rehydrate VOD on other devices
ALTER TABLE raw_videos ADD COLUMN platform TEXT;
ALTER TABLE raw_videos ADD COLUMN source_url TEXT;
