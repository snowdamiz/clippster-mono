-- Add campaign_id column to clips table for campaign asset integration
-- NOTE: The actual ALTER TABLE is handled by self-healing code in schema-healing.ts
-- because SQLite does not support ALTER TABLE ADD COLUMN IF NOT EXISTS,
-- and this column may already exist from the unregistered 045 migration.
SELECT 1;
