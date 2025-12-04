-- Speaker Detection and Framing Strategy Tables
-- For AI-based speaker/POI detection in video clips

-- Speaker detections table stores individual face detections at specific timestamps
CREATE TABLE IF NOT EXISTS speaker_detections (
  id TEXT PRIMARY KEY NOT NULL,
  clip_id TEXT NOT NULL,
  time_offset REAL NOT NULL,
  speaker_index INTEGER NOT NULL DEFAULT 0,
  -- Bounding box coordinates (normalized 0-1)
  bbox_x REAL NOT NULL DEFAULT 0.5,
  bbox_y REAL NOT NULL DEFAULT 0.5,
  bbox_width REAL NOT NULL DEFAULT 0.2,
  bbox_height REAL NOT NULL DEFAULT 0.3,
  -- Detection confidence (0-1)
  confidence REAL DEFAULT 0.0,
  -- Whether speaker appears to be actively speaking
  is_speaking INTEGER DEFAULT 0,
  -- Additional metadata
  roll_angle REAL DEFAULT 0.0,
  pan_angle REAL DEFAULT 0.0,
  tilt_angle REAL DEFAULT 0.0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (clip_id) REFERENCES clips(id) ON DELETE CASCADE
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_speaker_detections_clip ON speaker_detections(clip_id);
CREATE INDEX IF NOT EXISTS idx_speaker_detections_time ON speaker_detections(clip_id, time_offset);
CREATE INDEX IF NOT EXISTS idx_speaker_detections_speaker ON speaker_detections(clip_id, speaker_index);

-- Framing strategies table stores the computed optimal framing for each clip
CREATE TABLE IF NOT EXISTS framing_strategies (
  id TEXT PRIMARY KEY NOT NULL,
  clip_id TEXT UNIQUE NOT NULL,
  -- Framing mode: 'split_screen', 'dynamic_pan', 'static'
  mode TEXT NOT NULL DEFAULT 'static',
  -- Video content type: 'talking_head', 'gaming', 'irl', 'multi_speaker', 'podcast', 'unknown'
  video_type TEXT NOT NULL DEFAULT 'unknown',
  -- Target aspect ratio (e.g., '9:16')
  target_aspect_ratio TEXT NOT NULL DEFAULT '9:16',
  -- Detection confidence score (0-1)
  confidence REAL DEFAULT 0.5,
  -- Number of speakers detected
  speaker_count INTEGER DEFAULT 0,
  -- Full strategy data as JSON (includes regions, keyframes, FFmpeg filters)
  strategy_data TEXT,
  -- Source video dimensions
  source_width INTEGER,
  source_height INTEGER,
  -- Timestamps
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (clip_id) REFERENCES clips(id) ON DELETE CASCADE
);

-- Index for framing strategies
CREATE INDEX IF NOT EXISTS idx_framing_strategies_clip ON framing_strategies(clip_id);
CREATE INDEX IF NOT EXISTS idx_framing_strategies_mode ON framing_strategies(mode);
CREATE INDEX IF NOT EXISTS idx_framing_strategies_type ON framing_strategies(video_type);

-- Speaker tracking summary table for persistent speaker identification
CREATE TABLE IF NOT EXISTS speaker_summaries (
  id TEXT PRIMARY KEY NOT NULL,
  clip_id TEXT NOT NULL,
  speaker_index INTEGER NOT NULL,
  -- Average position (normalized 0-1)
  avg_x REAL NOT NULL DEFAULT 0.5,
  avg_y REAL NOT NULL DEFAULT 0.5,
  avg_width REAL NOT NULL DEFAULT 0.2,
  avg_height REAL NOT NULL DEFAULT 0.3,
  -- Average confidence
  avg_confidence REAL DEFAULT 0.0,
  -- Detection count (how many frames this speaker appeared in)
  detection_count INTEGER DEFAULT 0,
  -- Position category: 'center', 'left', 'right' for horizontal
  position_horizontal TEXT,
  -- Position category: 'top', 'middle', 'bottom' for vertical
  position_vertical TEXT,
  -- Movement variance (how much this speaker moves)
  movement_variance REAL DEFAULT 0.0,
  -- Time range this speaker appears
  first_seen REAL,
  last_seen REAL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (clip_id) REFERENCES clips(id) ON DELETE CASCADE,
  UNIQUE(clip_id, speaker_index)
);

-- Indexes for speaker summaries
CREATE INDEX IF NOT EXISTS idx_speaker_summaries_clip ON speaker_summaries(clip_id);
CREATE INDEX IF NOT EXISTS idx_speaker_summaries_position ON speaker_summaries(position_horizontal, position_vertical);

