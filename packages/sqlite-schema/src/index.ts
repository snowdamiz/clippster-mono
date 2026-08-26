export interface SqlMigration {
  version: number;
  name: string;
  sql: string;
}

/** Required before reading/writing schema_version during incremental migrations. */
export const APP_METADATA_TABLE_SQL = `CREATE TABLE IF NOT EXISTS app_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);`;

export const MIGRATIONS: SqlMigration[] = [
  {
    version: 1,
    name: 'projects',
    sql: `-- Mobile migration 001: projects
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  thumbnail_path TEXT,
  parent_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_parent_id ON projects(parent_id);`,
  },
  {
    version: 2,
    name: 'raw_videos',
    sql: `-- Mobile migration 002: raw_videos
CREATE TABLE IF NOT EXISTS raw_videos (
  id TEXT PRIMARY KEY,
  project_id TEXT UNIQUE,
  file_path TEXT NOT NULL,
  original_filename TEXT,
  thumbnail_path TEXT,
  duration REAL,
  width INTEGER,
  height INTEGER,
  frame_rate REAL,
  codec TEXT,
  file_size INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_raw_videos_project ON raw_videos(project_id);`,
  },
  {
    version: 3,
    name: 'clips',
    sql: `-- Mobile migration 003: clips, versions, segments
CREATE TABLE IF NOT EXISTS clip_detection_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  detection_model TEXT NOT NULL DEFAULT 'claude-3.5-sonnet',
  server_response_id TEXT,
  quality_score REAL,
  total_clips_detected INTEGER DEFAULT 0,
  processing_time_ms INTEGER,
  validation_data TEXT,
  run_color TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS clips (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  name TEXT,
  file_path TEXT NOT NULL,
  duration REAL,
  start_time REAL,
  end_time REAL,
  order_index INTEGER,
  current_version_id TEXT,
  detection_session_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_clips_project ON clips(project_id);

CREATE TABLE IF NOT EXISTS clip_versions (
  id TEXT PRIMARY KEY,
  clip_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  parent_version_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  start_time REAL NOT NULL,
  end_time REAL NOT NULL,
  confidence_score REAL,
  virality_score REAL,
  relevance_score REAL,
  detection_reason TEXT,
  tags TEXT,
  change_type TEXT NOT NULL CHECK(change_type IN ('detected', 'modified', 'deleted')),
  change_description TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (clip_id) REFERENCES clips(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES clip_detection_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_clip_versions_clip_id ON clip_versions(clip_id);

CREATE TABLE IF NOT EXISTS clip_segments (
  id TEXT PRIMARY KEY,
  clip_version_id TEXT NOT NULL,
  segment_index INTEGER NOT NULL,
  start_time REAL NOT NULL,
  end_time REAL NOT NULL,
  duration REAL NOT NULL,
  transcript TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (clip_version_id) REFERENCES clip_versions(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clip_segments_unique_order ON clip_segments(clip_version_id, segment_index);`,
  },
  {
    version: 4,
    name: 'transcripts',
    sql: `-- Mobile migration 004: transcripts
CREATE TABLE IF NOT EXISTS transcripts (
  id TEXT PRIMARY KEY,
  raw_video_id TEXT NOT NULL UNIQUE,
  raw_json TEXT NOT NULL,
  text TEXT NOT NULL,
  language TEXT,
  duration REAL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (raw_video_id) REFERENCES raw_videos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_transcripts_raw_video ON transcripts(raw_video_id);`,
  },
  {
    version: 5,
    name: 'clip_builds',
    sql: `-- Mobile migration 005: clip_builds
CREATE TABLE IF NOT EXISTS clip_builds (
  id TEXT PRIMARY KEY,
  clip_id TEXT NOT NULL,
  aspect_ratios TEXT,
  quality TEXT,
  frame_rate INTEGER,
  output_format TEXT,
  include_subtitles INTEGER DEFAULT 0,
  file_path TEXT NOT NULL,
  thumbnail_path TEXT,
  file_size INTEGER,
  duration REAL,
  build_number INTEGER NOT NULL DEFAULT 1,
  status TEXT CHECK(status IN ('building', 'completed', 'failed')) DEFAULT 'building',
  error_message TEXT,
  progress REAL DEFAULT 0.0,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (clip_id) REFERENCES clips(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_clip_builds_clip_id ON clip_builds(clip_id);`,
  },
  {
    version: 6,
    name: 'user_prefs',
    sql: `-- Mobile migration 006: app metadata
CREATE TABLE IF NOT EXISTS app_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO app_metadata (key, value) VALUES ('schema_version', '6');`,
  },
  {
    version: 7,
    name: 'raw_video_metadata',
    sql: `-- Mobile migration 007: raw_videos platform + source metadata
ALTER TABLE raw_videos ADD COLUMN platform TEXT;
ALTER TABLE raw_videos ADD COLUMN source_url TEXT;`,
  },
  {
    version: 8,
    name: 'editor_columns',
    sql: `-- Mobile migration 008: Phase 2 editor columns
ALTER TABLE projects ADD COLUMN active_vod_preset_id TEXT;
ALTER TABLE projects ADD COLUMN active_vod_preset_config TEXT;

ALTER TABLE clips ADD COLUMN subtitle_enabled INTEGER DEFAULT 0;
ALTER TABLE clips ADD COLUMN subtitle_preset_id TEXT;
ALTER TABLE clips ADD COLUMN subtitle_settings TEXT;
ALTER TABLE clips ADD COLUMN clip_text_overlay TEXT;`,
  },
  {
    version: 9,
    name: 'organization_assets_cache',
    sql: `-- Mobile migration 009: cached organization branding assets
CREATE TABLE IF NOT EXISTS organization_assets_cache (
  server_id INTEGER PRIMARY KEY,
  org_id INTEGER NOT NULL,
  asset_type TEXT NOT NULL,
  local_path TEXT NOT NULL,
  url TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_organization_assets_cache_org_id
  ON organization_assets_cache(org_id);`,
  },
  {
    version: 10,
    name: 'cloud_sync_meta',
    sql: `-- Mobile migration 010: cloud sync metadata per project
CREATE TABLE IF NOT EXISTS cloud_sync_meta (
  project_id TEXT PRIMARY KEY,
  sync_status TEXT NOT NULL DEFAULT 'local-only',
  cloud_media_asset_id TEXT,
  store_vod_in_cloud INTEGER NOT NULL DEFAULT 0,
  last_synced_at INTEGER,
  cloud_updated_at INTEGER,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);`,
  },
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;
