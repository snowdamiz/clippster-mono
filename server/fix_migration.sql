-- Remove the migration record so it can be re-run
DELETE FROM schema_migrations WHERE version = 20260227000001;
