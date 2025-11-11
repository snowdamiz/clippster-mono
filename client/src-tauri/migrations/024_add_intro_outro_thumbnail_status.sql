-- Add thumbnail_generation_status column to intro_outros table
ALTER TABLE intro_outros ADD COLUMN thumbnail_generation_status TEXT CHECK(thumbnail_generation_status IN ('pending', 'processing', 'completed', 'failed') );

-- Set default status for existing records
UPDATE intro_outros SET thumbnail_generation_status = 'completed' WHERE thumbnail_path IS NOT NULL AND thumbnail_path != '';
UPDATE intro_outros SET thumbnail_generation_status = 'pending' WHERE thumbnail_path IS NULL OR thumbnail_path = '';