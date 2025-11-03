-- Simple fix for cascade deletion - Update foreign key constraints safely
-- Migration: 020_simple_cascade_fix
-- Created: 2025-11-03

-- Since SQLite doesn't support ALTER TABLE foreign key constraints directly,
-- we'll handle this at the application level by updating the deleteProject function
-- to preserve content before deleting the project.

-- For now, add a note that the cascade deletion fix is handled in the application layer
CREATE TABLE IF NOT EXISTS migration_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    migration_version INTEGER NOT NULL,
    description TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

INSERT INTO migration_notes (migration_version, description, created_at)
VALUES (20, 'Cascade deletion handled in application layer - deleteProject function preserves content', strftime('%s', 'now'));

-- This migration serves as a marker that the application-level cascade deletion fix is active
-- The actual fix is in database.ts deleteProject function which sets project_id to NULL before deletion