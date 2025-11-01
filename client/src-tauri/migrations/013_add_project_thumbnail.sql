-- Add thumbnail_path to projects table for preserving thumbnails
-- Migration: 013_add_project_thumbnail
-- Created: 2025-11-01

ALTER TABLE projects ADD COLUMN thumbnail_path TEXT;

CREATE INDEX IF NOT EXISTS idx_projects_thumbnail ON projects(thumbnail_path);