-- Global branding profiles migration
-- NOTE: The scope column on creator_profiles, selected_branding_profile_id on projects,
-- and the index are all handled by self-healing code in schema-healing.ts
-- because SQLite does not support ALTER TABLE ADD COLUMN IF NOT EXISTS.
SELECT 1;
