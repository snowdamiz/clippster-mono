-- Mobile migration 009: cached organization branding assets
CREATE TABLE IF NOT EXISTS organization_assets_cache (
  server_id INTEGER PRIMARY KEY,
  org_id INTEGER NOT NULL,
  asset_type TEXT NOT NULL,
  local_path TEXT NOT NULL,
  url TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_organization_assets_cache_org_id
  ON organization_assets_cache(org_id);
