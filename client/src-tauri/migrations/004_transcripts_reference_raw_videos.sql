-- Update transcripts table to reference raw_videos instead of projects
-- Migration: 004_transcripts_reference_raw_videos
-- Created: 2025-10-28

-- Create new transcripts table with raw_video_id
CREATE TABLE transcripts_new (
  id TEXT PRIMARY KEY,
  raw_video_id TEXT UNIQUE NOT NULL,
  raw_json TEXT NOT NULL,
  text TEXT NOT NULL,
  language TEXT,
  duration REAL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (raw_video_id) REFERENCES raw_videos(id) ON DELETE CASCADE
);

-- Migrate existing data - link transcripts to raw_videos via project_id
INSERT INTO transcripts_new (id, raw_video_id, raw_json, text, language, duration, created_at, updated_at)
SELECT 
  t.id,
  rv.id,  -- Link to raw_video via project_id
  t.raw_json,
  t.text,
  t.language,
  t.duration,
  t.created_at,
  t.updated_at
FROM transcripts t
INNER JOIN raw_videos rv ON rv.project_id = t.project_id;

-- Drop old table and rename new one
DROP TABLE transcripts;
ALTER TABLE transcripts_new RENAME TO transcripts;

-- Recreate FTS table with new structure
DROP TABLE IF EXISTS transcripts_fts;
CREATE VIRTUAL TABLE transcripts_fts USING fts5(
  text,
  content=transcripts,
  content_rowid=rowid
);

-- Populate FTS table with existing data
INSERT INTO transcripts_fts(rowid, text)
SELECT rowid, text FROM transcripts;

-- Recreate triggers for FTS synchronization
DROP TRIGGER IF EXISTS transcripts_ai;
DROP TRIGGER IF EXISTS transcripts_ad;
DROP TRIGGER IF EXISTS transcripts_au;

CREATE TRIGGER transcripts_ai AFTER INSERT ON transcripts BEGIN
  INSERT INTO transcripts_fts(rowid, text) VALUES (new.rowid, new.text);
END;

CREATE TRIGGER transcripts_ad AFTER DELETE ON transcripts BEGIN
  DELETE FROM transcripts_fts WHERE rowid = old.rowid;
END;

CREATE TRIGGER transcripts_au AFTER UPDATE ON transcripts BEGIN
  UPDATE transcripts_fts SET text = new.text WHERE rowid = old.rowid;
END;
