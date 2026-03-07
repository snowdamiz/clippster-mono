-- Remove broken FOREIGN KEY (user_id) REFERENCES users(id) from project_media
-- The users table doesn't exist, causing CASCADE deletes to fail

CREATE TABLE project_media_new (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL REFERENCES video_editor_projects(id) ON DELETE CASCADE,
    media_type TEXT NOT NULL CHECK(media_type IN ('video', 'audio', 'image')),
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    thumbnail_path TEXT,
    duration REAL,
    width INTEGER,
    height INTEGER,
    file_size INTEGER,
    is_favorite INTEGER DEFAULT 0,
    use_count INTEGER DEFAULT 0,
    last_used_at INTEGER,
    created_at INTEGER NOT NULL,
    user_id TEXT
);

INSERT INTO project_media_new SELECT * FROM project_media;

DROP TABLE project_media;

ALTER TABLE project_media_new RENAME TO project_media;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_project_media_project_id ON project_media(project_id);
CREATE INDEX IF NOT EXISTS idx_project_media_type ON project_media(project_id, media_type);
CREATE INDEX IF NOT EXISTS idx_project_media_favorite ON project_media(project_id, is_favorite);
CREATE INDEX IF NOT EXISTS idx_project_media_recent ON project_media(project_id, last_used_at DESC);
