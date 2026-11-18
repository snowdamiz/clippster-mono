CREATE TABLE IF NOT EXISTS creator_skill_edits (
  clip_id TEXT PRIMARY KEY REFERENCES clips(id) ON DELETE CASCADE,
  detection_session_id TEXT NOT NULL,
  status TEXT NOT NULL,
  selected_version TEXT NOT NULL DEFAULT 'raw',
  raw_source TEXT NOT NULL,
  edited TEXT,
  sources TEXT NOT NULL DEFAULT '[]',
  review_items TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_creator_skill_edits_session ON creator_skill_edits(detection_session_id);
