-- Mobile migration 013: personal branding asset cache (mirrors org assets)
CREATE TABLE IF NOT EXISTS user_assets_cache (
  server_id INTEGER PRIMARY KEY,
  asset_type TEXT NOT NULL,
  name TEXT NOT NULL,
  local_path TEXT NOT NULL,
  url TEXT NOT NULL,
  content_hash TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_creator_profiles_cache (
  server_id INTEGER PRIMARY KEY,
  client_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  profile_image_url TEXT,
  intro_id INTEGER,
  outro_id INTEGER,
  watermark_id INTEGER,
  watermark_settings TEXT,
  intro_outro_settings TEXT,
  intro_ratio_settings TEXT,
  outro_ratio_settings TEXT,
  layout_overlays TEXT,
  scope TEXT NOT NULL DEFAULT 'personal_studio',
  disabled INTEGER NOT NULL DEFAULT 0,
  clip_build_defaults TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_creator_profiles_cache_client
  ON user_creator_profiles_cache(client_id);
