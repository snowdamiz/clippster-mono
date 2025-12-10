-- Create the audio_assets table for storing audio files (background music, sound effects, etc.)
CREATE TABLE IF NOT EXISTS audio_assets (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    file_path TEXT NOT NULL UNIQUE,
    duration REAL,
    file_size INTEGER,
    sample_rate INTEGER,
    channels INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audio_assets_created_at ON audio_assets(created_at);

