-- Initial schema for Clippster SQLite database
-- Migration: 001_initial_schema
-- Created: 2025-10-26

-- Core tables
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS prompts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS transcripts (
  id TEXT PRIMARY KEY,
  project_id TEXT UNIQUE NOT NULL,
  raw_json TEXT NOT NULL,
  text TEXT NOT NULL,
  language TEXT,
  duration REAL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS transcript_segments (
  id TEXT PRIMARY KEY,
  transcript_id TEXT NOT NULL,
  clip_id TEXT,
  start_time REAL NOT NULL,
  end_time REAL NOT NULL,
  text TEXT NOT NULL,
  segment_index INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (transcript_id) REFERENCES transcripts(id) ON DELETE CASCADE,
  FOREIGN KEY (clip_id) REFERENCES clips(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_segments_transcript ON transcript_segments(transcript_id);
CREATE INDEX IF NOT EXISTS idx_segments_clip ON transcript_segments(clip_id);
CREATE INDEX IF NOT EXISTS idx_segments_time ON transcript_segments(start_time, end_time);

CREATE TABLE IF NOT EXISTS intro_outros (
  id TEXT PRIMARY KEY,
  type TEXT CHECK(type IN ('intro', 'outro')) NOT NULL,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  duration REAL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS clips (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT,
  file_path TEXT NOT NULL,
  duration REAL,
  start_time REAL,
  end_time REAL,
  order_index INTEGER,
  intro_id TEXT,
  outro_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (intro_id) REFERENCES intro_outros(id) ON DELETE SET NULL,
  FOREIGN KEY (outro_id) REFERENCES intro_outros(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_clips_project ON clips(project_id);

CREATE TABLE IF NOT EXISTS thumbnails (
  id TEXT PRIMARY KEY,
  clip_id TEXT UNIQUE NOT NULL,
  file_path TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (clip_id) REFERENCES clips(id) ON DELETE CASCADE
);

-- Full-text search tables
CREATE VIRTUAL TABLE IF NOT EXISTS transcripts_fts USING fts5(
  text,
  content=transcripts,
  content_rowid=rowid
);

CREATE VIRTUAL TABLE IF NOT EXISTS transcript_segments_fts USING fts5(
  text,
  content=transcript_segments,
  content_rowid=rowid
);

-- Triggers to keep FTS tables synchronized
CREATE TRIGGER IF NOT EXISTS transcripts_ai AFTER INSERT ON transcripts BEGIN
  INSERT INTO transcripts_fts(rowid, text) VALUES (new.rowid, new.text);
END;

CREATE TRIGGER IF NOT EXISTS transcripts_ad AFTER DELETE ON transcripts BEGIN
  DELETE FROM transcripts_fts WHERE rowid = old.rowid;
END;

CREATE TRIGGER IF NOT EXISTS transcripts_au AFTER UPDATE ON transcripts BEGIN
  UPDATE transcripts_fts SET text = new.text WHERE rowid = old.rowid;
END;

CREATE TRIGGER IF NOT EXISTS segments_ai AFTER INSERT ON transcript_segments BEGIN
  INSERT INTO transcript_segments_fts(rowid, text) VALUES (new.rowid, new.text);
END;

CREATE TRIGGER IF NOT EXISTS segments_ad AFTER DELETE ON transcript_segments BEGIN
  DELETE FROM transcript_segments_fts WHERE rowid = old.rowid;
END;

CREATE TRIGGER IF NOT EXISTS segments_au AFTER UPDATE ON transcript_segments BEGIN
  UPDATE transcript_segments_fts SET text = new.text WHERE rowid = old.rowid;
END;
