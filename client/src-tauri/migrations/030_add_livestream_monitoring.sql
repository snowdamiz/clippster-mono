-- Monitored PumpFun streamers
CREATE TABLE IF NOT EXISTS monitored_streamers (
  id TEXT PRIMARY KEY,
  mint_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  last_check_timestamp INTEGER,
  is_currently_live INTEGER DEFAULT 0,
  current_session_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Live recording sessions (created when stream starts)
CREATE TABLE IF NOT EXISTS livestream_sessions (
  id TEXT PRIMARY KEY,
  monitored_streamer_id TEXT NOT NULL,
  mint_id TEXT NOT NULL,
  stream_start_time INTEGER NOT NULL,
  stream_end_time INTEGER,
  is_recording INTEGER DEFAULT 1,
  total_segments INTEGER DEFAULT 0,
  processed_segments INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (monitored_streamer_id) REFERENCES monitored_streamers(id) ON DELETE CASCADE
);

-- 15-minute segments (created as they're recorded)
CREATE TABLE IF NOT EXISTS livestream_segments (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  segment_number INTEGER NOT NULL,
  start_time_offset REAL NOT NULL,
  duration REAL NOT NULL,
  raw_video_id TEXT,
  status TEXT DEFAULT 'recording',
  clips_detected INTEGER DEFAULT 0,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES livestream_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (raw_video_id) REFERENCES raw_videos(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_monitored_streamers_mint ON monitored_streamers(mint_id);
CREATE INDEX IF NOT EXISTS idx_livestream_sessions_streamer ON livestream_sessions(monitored_streamer_id);
CREATE INDEX IF NOT EXISTS idx_livestream_segments_session ON livestream_segments(session_id);
CREATE INDEX IF NOT EXISTS idx_livestream_segments_status ON livestream_segments(status);

