-- Add layer column to editor overlay tables for multi-track support
-- NOTE: The actual ALTER TABLEs are handled by self-healing code in schema-healing.ts
-- because SQLite does not support ALTER TABLE ADD COLUMN IF NOT EXISTS.
SELECT 1;
