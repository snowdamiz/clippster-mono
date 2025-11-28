-- Create the watermark_images table
CREATE TABLE IF NOT EXISTS watermark_images (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    file_path TEXT NOT NULL UNIQUE,
    width INTEGER,
    height INTEGER,
    file_size INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_watermark_images_created_at ON watermark_images(created_at);

