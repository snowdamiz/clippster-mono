-- Add parent_id to projects table for hierarchical organization
ALTER TABLE projects ADD COLUMN parent_id TEXT REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_projects_parent_id ON projects(parent_id);


