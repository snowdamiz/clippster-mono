-- Create audio_playlists table for organizing downloaded audio
CREATE TABLE IF NOT EXISTS audio_playlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  user_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Create index on user_id for efficient filtering
CREATE INDEX IF NOT EXISTS idx_audio_playlists_user_id ON audio_playlists(user_id);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_audio_playlists_created_at ON audio_playlists(created_at DESC);
