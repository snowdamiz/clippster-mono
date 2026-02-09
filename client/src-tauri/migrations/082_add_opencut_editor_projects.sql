-- OpenCut editor projects storage
-- Stores serialized project data as JSON (replaces IndexedDB)
CREATE TABLE IF NOT EXISTS opencut_projects (
    id TEXT PRIMARY KEY NOT NULL,
    project_data TEXT NOT NULL,  -- Full serialized TProject JSON
    user_id INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- OpenCut editor media assets metadata
-- Stores media asset metadata per project (replaces IndexedDB media-metadata)
-- Actual files live on disk, referenced by file_path
CREATE TABLE IF NOT EXISTS opencut_media_assets (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,  -- 'image' | 'video' | 'audio'
    file_path TEXT NOT NULL,  -- Filesystem path to the actual file
    file_size INTEGER NOT NULL DEFAULT 0,
    last_modified INTEGER NOT NULL DEFAULT 0,
    width INTEGER,
    height INTEGER,
    duration REAL,
    fps REAL,
    thumbnail_url TEXT,  -- Data URL or file path for thumbnail
    ephemeral INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (project_id) REFERENCES opencut_projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_opencut_media_assets_project_id ON opencut_media_assets(project_id);

-- Saved sounds from Freesound
CREATE TABLE IF NOT EXISTS opencut_saved_sounds (
    id INTEGER PRIMARY KEY NOT NULL,  -- freesound id
    name TEXT NOT NULL,
    username TEXT NOT NULL,
    preview_url TEXT,
    download_url TEXT,
    duration REAL NOT NULL DEFAULT 0,
    tags TEXT,  -- JSON array
    license TEXT,
    saved_at TEXT NOT NULL,
    user_id INTEGER
);
