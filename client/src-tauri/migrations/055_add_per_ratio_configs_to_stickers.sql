-- Add per-ratio configuration support for stickers
-- Similar to text overlays, stickers can have different position/scale/rotation per aspect ratio

-- Add per_ratio_configs_data column to store JSON configuration per aspect ratio
ALTER TABLE clip_stickers ADD COLUMN per_ratio_configs_data TEXT;

-- The per_ratio_configs_data column stores JSON like:
-- {
--   "9:16": { "position": { "x": 50, "y": 30 }, "scale": 1.5, "rotation": 0 },
--   "1:1": { "position": { "x": 50, "y": 50 }, "scale": 1.2, "rotation": 15 }
-- }


