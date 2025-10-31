-- Drop the table if it exists with different structure
DROP TABLE IF EXISTS audio_files;

-- Create the audio_files table
CREATE TABLE audio_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL UNIQUE,
    original_filename TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    duration REAL,
    format TEXT NOT NULL,
    sample_rate INTEGER,
    channels INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audio_files_file_path ON audio_files(file_path);
CREATE INDEX idx_audio_files_created_at ON audio_files(created_at);