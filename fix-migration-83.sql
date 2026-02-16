-- Fix migration 83 checksum mismatch
-- Run this SQL against your clippster_v25_dev.db file using a SQLite browser

-- First, check the current migration record
SELECT * FROM _sqlx_migrations WHERE version = 83;

-- Delete the old migration record
DELETE FROM _sqlx_migrations WHERE version = 83;

-- The app will now re-apply migration 83 with the new checksum on next startup
