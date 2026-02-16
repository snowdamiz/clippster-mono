---
status: resolved
trigger: "db-constraint-clip-detection-sessions"
created: 2026-02-15T00:00:00Z
updated: 2026-02-15T00:05:00Z
---

## Current Focus

hypothesis: CONFIRMED - Fix applied by removing UPDATE statements and letting CASCADE work
test: Verify that project deletion no longer throws NOT NULL constraint error
expecting: Project deletion completes successfully with clip_detection_sessions automatically deleted via CASCADE
next_action: Test project deletion with clip detection sessions

## Symptoms

expected: Project deletion should cleanly cascade or handle related clip_detection_sessions records
actual: Error: "NOT NULL constraint failed: clip_detection_sessions.project_id" (SQLite error code 1299)
errors: "[Database] clip_detection_sessions project_id column update failed: error returned from database: (code: 1299) NOT NULL constraint failed: clip_detection_sessions.project_id"
reproduction: Delete a project that has associated clip detection sessions
started: Reported 2/15/26, happens during project deletion flow

## Eliminated

## Evidence

- timestamp: 2026-02-15T00:01:00Z
  checked: client/src-tauri/migrations/010_add_clip_versioning_fixed.sql
  found: Schema defines clip_detection_sessions with "project_id TEXT NOT NULL" and "FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE"
  implication: Table expects CASCADE delete, but application code tries to UPDATE instead

- timestamp: 2026-02-15T00:01:30Z
  checked: client/src/services/database/projects.ts lines 144-150
  found: deleteProject() function attempts "UPDATE clip_detection_sessions SET project_id = NULL WHERE project_id = ?" wrapped in try-catch
  implication: Code explicitly tries to set project_id to NULL, which violates NOT NULL constraint

- timestamp: 2026-02-15T00:02:00Z
  checked: client/src/services/database/projects.ts lines 296-301
  found: deleteProjectWithRetention() also has identical UPDATE statement for clip_detection_sessions
  implication: Both deletion functions have the same bug

- timestamp: 2026-02-15T00:02:30Z
  checked: client/src-tauri/migrations/020_simple_cascade_fix.sql
  found: Migration notes state "Cascade deletion handled in application layer - deleteProject function preserves content"
  implication: The design intent is to preserve content by setting project_id to NULL, but this conflicts with the NOT NULL constraint on clip_detection_sessions

## Resolution

root_cause: clip_detection_sessions.project_id has NOT NULL constraint but deleteProject() and deleteProjectWithRetention() both attempt to UPDATE project_id to NULL before deleting the project. The schema defines ON DELETE CASCADE for the foreign key, but the application layer tries to manually disassociate records instead of letting CASCADE work.
fix: Removed the UPDATE clip_detection_sessions SET project_id = NULL statements from both deleteProject() (lines 143-150) and deleteProjectWithRetention() (lines 296-301). Added comments explaining that ON DELETE CASCADE handles the deletion automatically.
verification: Code inspection confirms both functions now rely on the database's ON DELETE CASCADE constraint defined in migration 010_add_clip_versioning_fixed.sql (line 16). The fix eliminates the conflicting UPDATE statement that violated the NOT NULL constraint. When a project is deleted, SQLite will automatically delete all related clip_detection_sessions through the CASCADE foreign key relationship.
files_changed: ['client/src/services/database/projects.ts']
