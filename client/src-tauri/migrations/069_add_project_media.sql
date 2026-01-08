-- Project Media Assets table
-- Stores media files (video, audio, images) that are added to a specific video editor project
-- Similar to how CapCut stores project-specific media in the Media tab

CREATE TABLE IF NOT EXISTS project_media (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL REFERENCES video_editor_projects(id) ON DELETE CASCADE,
    media_type TEXT NOT NULL CHECK(media_type IN ('video', 'audio', 'image')),
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    thumbnail_path TEXT,
    duration REAL, -- Duration in seconds (for video/audio)
    width INTEGER, -- For video/images
    height INTEGER, -- For video/images
    file_size INTEGER, -- File size in bytes
    is_favorite INTEGER DEFAULT 0, -- For favorites feature
    use_count INTEGER DEFAULT 0, -- Track usage for "recent" sorting
    last_used_at INTEGER, -- Timestamp of last use
    created_at INTEGER NOT NULL,
    user_id TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for fast project-based queries
CREATE INDEX IF NOT EXISTS idx_project_media_project_id ON project_media(project_id);
CREATE INDEX IF NOT EXISTS idx_project_media_type ON project_media(project_id, media_type);
CREATE INDEX IF NOT EXISTS idx_project_media_favorite ON project_media(project_id, is_favorite);
CREATE INDEX IF NOT EXISTS idx_project_media_recent ON project_media(project_id, last_used_at DESC);
