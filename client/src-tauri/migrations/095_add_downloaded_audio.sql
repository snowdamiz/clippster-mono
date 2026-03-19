-- Create downloaded_audio table for audio files downloaded from YouTube/Twitter or uploaded by users
CREATE TABLE IF NOT EXISTS downloaded_audio (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('youtube', 'twitter', 'upload')),
  platform TEXT,
  source_url TEXT,
  file_path TEXT NOT NULL,
  duration REAL,
  file_size INTEGER,
  sample_rate INTEGER,
  channels INTEGER,
  thumbnail_url TEXT,
  user_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Create index on user_id for efficient filtering
CREATE INDEX IF NOT EXISTS idx_downloaded_audio_user_id ON downloaded_audio(user_id);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_downloaded_audio_created_at ON downloaded_audio(created_at DESC);

-- Create index on source for filtering by source type
CREATE INDEX IF NOT EXISTS idx_downloaded_audio_source ON downloaded_audio(source);
