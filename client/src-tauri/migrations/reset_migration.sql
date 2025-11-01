-- Reset migration state - only use this if migration 11 failed
-- This will remove the migration record so it can run again

DELETE FROM _sqlx_migrations WHERE version = 11;