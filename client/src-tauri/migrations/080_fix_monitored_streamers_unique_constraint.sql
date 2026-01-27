-- Fix UNIQUE constraint on monitored_streamers to allow same identifier across different platforms
-- This allows adding a Twitch channel "xqc" even if a Kick channel "xqc" already exists

-- SQLite doesn't support dropping constraints directly, so we need to recreate the table
-- Step 1: Create new table with compound unique constraint
CREATE TABLE IF NOT EXISTS monitored_streamers_new (
  id TEXT PRIMARY KEY,
  mint_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  platform TEXT DEFAULT 'pumpfun',
  last_check_timestamp INTEGER,
  is_currently_live INTEGER DEFAULT 0,
  current_session_id TEXT,
  profile_image_url TEXT,
  stream_thumbnail_url TEXT,
  segment_duration_minutes INTEGER DEFAULT 5,
  auto_dvr INTEGER DEFAULT 0,
  user_id INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(mint_id, platform)
);

-- Step 2: Copy data from old table to new table
INSERT INTO monitored_streamers_new 
SELECT * FROM monitored_streamers;

-- Step 3: Drop old table
DROP TABLE monitored_streamers;

-- Step 4: Rename new table to original name
ALTER TABLE monitored_streamers_new RENAME TO monitored_streamers;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_monitored_streamers_mint ON monitored_streamers(mint_id);
CREATE INDEX IF NOT EXISTS idx_monitored_streamers_platform ON monitored_streamers(platform);
