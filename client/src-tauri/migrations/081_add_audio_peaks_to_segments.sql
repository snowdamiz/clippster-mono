-- Add audio_peaks column to clip_segments for storing audio peak data
-- This makes clips self-contained with their own audio analysis data

ALTER TABLE clip_segments ADD COLUMN audio_peaks TEXT;

-- audio_peaks will store JSON array of peak objects: [{ time: number, amplitude: number }, ...]
