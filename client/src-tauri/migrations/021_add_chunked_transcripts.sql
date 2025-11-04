-- Add chunked transcript support for long videos
-- This allows storing transcript chunks instead of massive single transcripts

-- Create chunked_transcripts table
CREATE TABLE IF NOT EXISTS chunked_transcripts (
    id TEXT PRIMARY KEY,
    raw_video_id TEXT NOT NULL,
    total_chunks INTEGER NOT NULL,
    chunk_duration_minutes INTEGER NOT NULL,
    overlap_seconds INTEGER NOT NULL,
    total_duration REAL NOT NULL,
    language TEXT,
    is_complete BOOLEAN NOT NULL DEFAULT FALSE,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (raw_video_id) REFERENCES raw_videos(id) ON DELETE CASCADE
);

-- Create transcript_chunks table
CREATE TABLE IF NOT EXISTS transcript_chunks (
    id TEXT PRIMARY KEY,
    chunked_transcript_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    chunk_id TEXT NOT NULL,
    start_time REAL NOT NULL,
    end_time REAL NOT NULL,
    duration REAL NOT NULL,
    raw_json TEXT NOT NULL,
    text TEXT NOT NULL,
    language TEXT,
    file_size INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (chunked_transcript_id) REFERENCES chunked_transcripts(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_chunked_transcripts_raw_video_id ON chunked_transcripts(raw_video_id);
CREATE INDEX IF NOT EXISTS idx_chunked_transcripts_is_complete ON chunked_transcripts(is_complete);
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_chunked_transcript_id ON transcript_chunks(chunked_transcript_id);
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_chunk_index ON transcript_chunks(chunk_index);
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_chunk_id ON transcript_chunks(chunk_id);