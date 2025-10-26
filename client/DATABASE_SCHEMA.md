# Clippster Client Database Schema

This document describes the SQLite database schema for the Clippster desktop client. The local database stores project data, clips, transcripts, and user assets. Authentication and payments are handled by the server PostgreSQL database.

## Overview

The schema supports:
- Video project management
- Clip organization with timestamps
- Full-text search on transcripts using Whisper AI output
- Reusable intro/outro assets
- Prompt templates

## Entity Relationship Diagram

```
Projects (1) ──→ (1) Transcripts
    │
    └──→ (many) Clips (1) ──→ (1) Thumbnails
                   │
                   ├──→ (1) Intro (from intro_outros)
                   ├──→ (1) Outro (from intro_outros)
                   └──→ (many) Transcript Segments

Transcripts (1) ──→ (many) Transcript Segments

Prompts (global templates)
Intro/Outros (global assets)
```

## Core Tables

### projects
Represents a video editing project.

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### prompts
Global reusable prompt templates for AI operations.

```sql
CREATE TABLE prompts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### transcripts
Stores Whisper AI transcription results for each project.

```sql
CREATE TABLE transcripts (
  id TEXT PRIMARY KEY,
  project_id TEXT UNIQUE NOT NULL,
  raw_json TEXT NOT NULL,      -- Full verbose_json output from Whisper API
  text TEXT NOT NULL,           -- Plain text extraction for quick access
  language TEXT,                -- Detected language
  duration REAL,                -- Total duration in seconds
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

**Notes:**
- `raw_json` contains the complete Whisper verbose_json response with word-level timestamps
- `text` is extracted for quick display and search indexing
- One transcript per project (1:1 relationship)

### transcript_segments
Individual segments/sentences from the transcript with precise timestamps.

```sql
CREATE TABLE transcript_segments (
  id TEXT PRIMARY KEY,
  transcript_id TEXT NOT NULL,
  clip_id TEXT,                 -- Optional: link segment to a specific clip
  start_time REAL NOT NULL,     -- Segment start time in seconds
  end_time REAL NOT NULL,       -- Segment end time in seconds
  text TEXT NOT NULL,           -- Segment text content
  segment_index INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (transcript_id) REFERENCES transcripts(id) ON DELETE CASCADE,
  FOREIGN KEY (clip_id) REFERENCES clips(id) ON DELETE SET NULL
);

CREATE INDEX idx_segments_transcript ON transcript_segments(transcript_id);
CREATE INDEX idx_segments_clip ON transcript_segments(clip_id);
CREATE INDEX idx_segments_time ON transcript_segments(start_time, end_time);
```

**Notes:**
- Enables timestamp-based queries
- `clip_id` allows linking segments to exported clips
- Indexed for efficient time-range queries

### intro_outros
Global library of reusable intro and outro video segments.

```sql
CREATE TABLE intro_outros (
  id TEXT PRIMARY KEY,
  type TEXT CHECK(type IN ('intro', 'outro')) NOT NULL,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  duration REAL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

**Notes:**
- Global assets (not project-specific)
- Referenced by clips as needed

### clips
Video segments cut from projects, optionally with intro/outro attachments.

```sql
CREATE TABLE clips (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT,
  file_path TEXT NOT NULL,
  duration REAL,
  start_time REAL,              -- Start time in source video
  end_time REAL,                -- End time in source video
  order_index INTEGER,          -- Sort order within project
  intro_id TEXT,                -- Optional intro attachment
  outro_id TEXT,                -- Optional outro attachment
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (intro_id) REFERENCES intro_outros(id) ON DELETE SET NULL,
  FOREIGN KEY (outro_id) REFERENCES intro_outros(id) ON DELETE SET NULL
);

CREATE INDEX idx_clips_project ON clips(project_id);
```

**Notes:**
- Each clip can have one intro and one outro
- If intro/outro is deleted, clip reference is set to NULL

### thumbnails
Preview images for clips (1:1 relationship).

```sql
CREATE TABLE thumbnails (
  id TEXT PRIMARY KEY,
  clip_id TEXT UNIQUE NOT NULL,
  file_path TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (clip_id) REFERENCES clips(id) ON DELETE CASCADE
);
```

## Full-Text Search

SQLite FTS5 virtual tables for fuzzy search functionality.

### transcripts_fts
Enables full-text search on project transcripts.

```sql
CREATE VIRTUAL TABLE transcripts_fts USING fts5(
  text,
  content=transcripts,
  content_rowid=rowid
);
```

### transcript_segments_fts
Enables full-text search on individual transcript segments.

```sql
CREATE VIRTUAL TABLE transcript_segments_fts USING fts5(
  text,
  content=transcript_segments,
  content_rowid=rowid
);
```

### FTS Sync Triggers

These triggers keep the FTS tables synchronized with source data.

#### Transcripts FTS Triggers
```sql
CREATE TRIGGER transcripts_ai AFTER INSERT ON transcripts BEGIN
  INSERT INTO transcripts_fts(rowid, text) VALUES (new.rowid, new.text);
END;

CREATE TRIGGER transcripts_ad AFTER DELETE ON transcripts BEGIN
  DELETE FROM transcripts_fts WHERE rowid = old.rowid;
END;

CREATE TRIGGER transcripts_au AFTER UPDATE ON transcripts BEGIN
  UPDATE transcripts_fts SET text = new.text WHERE rowid = old.rowid;
END;
```

#### Transcript Segments FTS Triggers
```sql
CREATE TRIGGER segments_ai AFTER INSERT ON transcript_segments BEGIN
  INSERT INTO transcript_segments_fts(rowid, text) VALUES (new.rowid, new.text);
END;

CREATE TRIGGER segments_ad AFTER DELETE ON transcript_segments BEGIN
  DELETE FROM transcript_segments_fts WHERE rowid = old.rowid;
END;

CREATE TRIGGER segments_au AFTER UPDATE ON transcript_segments BEGIN
  UPDATE transcript_segments_fts SET text = new.text WHERE rowid = old.rowid;
END;
```

## Search Query Examples

### Find projects containing a phrase
```sql
SELECT DISTINCT p.* 
FROM projects p
JOIN transcripts t ON t.project_id = p.id
JOIN transcripts_fts fts ON fts.rowid = t.rowid
WHERE transcripts_fts MATCH 'funny moment';
```

### Find clips with specific words/phrases
```sql
SELECT c.*, ts.start_time, ts.end_time, ts.text
FROM clips c
JOIN transcript_segments ts ON ts.clip_id = c.id
JOIN transcript_segments_fts fts ON fts.rowid = ts.rowid
WHERE transcript_segments_fts MATCH 'subscribe AND like';
```

### Find all segments in a time range
```sql
SELECT * FROM transcript_segments
WHERE transcript_id = ?
  AND start_time >= ?
  AND end_time <= ?
ORDER BY segment_index;
```

## Design Decisions

### No User Table
- Authentication handled by server PostgreSQL database
- Local SQLite is single-user (current logged-in user)
- All data implicitly belongs to the authenticated user

### Text IDs
- UUIDs stored as TEXT for cross-platform sync compatibility
- Easier to sync between local SQLite and server PostgreSQL

### Integer Timestamps
- Unix timestamps (seconds since epoch) for SQLite efficiency
- Store as INTEGER (8 bytes)

### Cascade Deletes
- Automatic cleanup when parent records deleted
- Prevents orphaned data

### SET NULL on Optional References
- Intro/outro deletions don't break clips
- Transcript segment unlinking preserves clip data

### FTS5 Full-Text Search
- Modern SQLite full-text search
- Supports phrase queries, AND/OR/NOT operators
- Built-in ranking for relevance

## Implementation Notes

1. **Whisper Integration**: When transcribing, store both `raw_json` and extract `text` field
2. **Segment Parsing**: Parse Whisper segments into `transcript_segments` for timestamp queries
3. **FTS Population**: Triggers automatically maintain search indexes
4. **File Paths**: Store absolute paths for media files (videos, thumbnails, intro/outros)
5. **Sync Strategy**: Use TEXT IDs to match records between local SQLite and server PostgreSQL
