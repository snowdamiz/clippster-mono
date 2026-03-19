-- Create audio_playlist_items table for tracks in playlists
CREATE TABLE IF NOT EXISTS audio_playlist_items (
  id TEXT PRIMARY KEY,
  playlist_id TEXT NOT NULL,
  audio_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (playlist_id) REFERENCES audio_playlists(id) ON DELETE CASCADE,
  FOREIGN KEY (audio_id) REFERENCES downloaded_audio(id) ON DELETE CASCADE
);

-- Create index on playlist_id for efficient filtering
CREATE INDEX IF NOT EXISTS idx_audio_playlist_items_playlist_id ON audio_playlist_items(playlist_id);

-- Create index on audio_id for checking if audio is in playlists
CREATE INDEX IF NOT EXISTS idx_audio_playlist_items_audio_id ON audio_playlist_items(audio_id);

-- Create index on position for ordering
CREATE INDEX IF NOT EXISTS idx_audio_playlist_items_position ON audio_playlist_items(playlist_id, position);
