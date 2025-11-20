ALTER TABLE livestream_sessions
ADD COLUMN project_id TEXT;

CREATE INDEX IF NOT EXISTS idx_livestream_sessions_project
  ON livestream_sessions(project_id);

