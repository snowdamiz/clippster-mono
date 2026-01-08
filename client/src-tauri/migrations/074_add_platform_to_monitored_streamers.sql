-- Add platform column to monitored_streamers to support Kick and other platforms
-- Default to 'pumpfun' for existing records (backwards compatibility)
ALTER TABLE monitored_streamers ADD COLUMN platform TEXT DEFAULT 'pumpfun';

-- Create index for platform-based queries
CREATE INDEX IF NOT EXISTS idx_monitored_streamers_platform ON monitored_streamers(platform);

-- Rename mint_id to platform_id for clarity (it's the platform-specific identifier)
-- Note: SQLite doesn't support RENAME COLUMN in older versions, so we keep mint_id for now
-- The column will store: mint_id for PumpFun, channel_slug for Kick
