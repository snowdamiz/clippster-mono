-- Creator Profiles table
CREATE TABLE IF NOT EXISTS creator_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  profile_image_path TEXT,
  -- Asset references (all assets live in global tables, uploaded assets get added there first)
  intro_id TEXT REFERENCES intro_outros(id) ON DELETE SET NULL,
  outro_id TEXT REFERENCES intro_outros(id) ON DELETE SET NULL,
  watermark_id TEXT REFERENCES watermark_images(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Creator Platform Links table (for multi-platform support)
CREATE TABLE IF NOT EXISTS creator_platform_links (
  id TEXT PRIMARY KEY,
  creator_profile_id TEXT NOT NULL REFERENCES creator_profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'pumpfun', 'kick', 'twitch', 'youtube'
  platform_id TEXT NOT NULL, -- mint_id for pumpfun, channel_slug for kick, etc.
  display_name TEXT,
  profile_image_url TEXT,
  monitored_streamer_id TEXT REFERENCES monitored_streamers(id) ON DELETE SET NULL,
  is_primary INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE(creator_profile_id, platform, platform_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_creator_platform_links_profile ON creator_platform_links(creator_profile_id);
CREATE INDEX IF NOT EXISTS idx_creator_platform_links_platform ON creator_platform_links(platform, platform_id);

