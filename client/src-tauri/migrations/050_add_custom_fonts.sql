-- Add custom fonts table
-- Migration: 050_add_custom_fonts
-- Created: 2025-01-18

-- Create custom_fonts table to store user-uploaded fonts
CREATE TABLE IF NOT EXISTS custom_fonts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL, -- ttf, otf, woff, woff2
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_custom_fonts_name ON custom_fonts(name);
CREATE INDEX IF NOT EXISTS idx_custom_fonts_created_at ON custom_fonts(created_at);

