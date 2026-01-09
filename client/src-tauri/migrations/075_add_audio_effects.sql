-- Audio effect presets (built-in library of effects)
CREATE TABLE IF NOT EXISTS audio_effect_presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    effect_type TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    ffmpeg_filter TEXT NOT NULL,
    web_audio_config TEXT, -- JSON config for Web Audio API preview
    default_parameters TEXT, -- JSON default parameter values
    parameter_schema TEXT, -- JSON schema defining adjustable parameters
    is_built_in INTEGER DEFAULT 1,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

-- Applied audio effects (per audio track)
CREATE TABLE IF NOT EXISTS audio_track_effects (
    id TEXT PRIMARY KEY,
    track_id TEXT NOT NULL,
    clip_edit_id TEXT,
    video_editor_project_id TEXT,
    effect_type TEXT NOT NULL,
    preset_id TEXT,
    start_time REAL NOT NULL,
    end_time REAL NOT NULL,
    intensity REAL DEFAULT 1.0,
    parameters TEXT, -- JSON parameters
    is_enabled INTEGER DEFAULT 1,
    order_index INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (preset_id) REFERENCES audio_effect_presets(id)
);

-- Audio effect keyframes for automation (volume, pan, etc.)
CREATE TABLE IF NOT EXISTS audio_effect_keyframes (
    id TEXT PRIMARY KEY,
    effect_id TEXT NOT NULL,
    parameter_name TEXT NOT NULL,
    time REAL NOT NULL,
    value REAL NOT NULL,
    easing TEXT DEFAULT 'linear',
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (effect_id) REFERENCES audio_track_effects(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audio_effect_presets_category ON audio_effect_presets(category);
CREATE INDEX IF NOT EXISTS idx_audio_effect_presets_type ON audio_effect_presets(effect_type);
CREATE INDEX IF NOT EXISTS idx_audio_track_effects_track ON audio_track_effects(track_id);
CREATE INDEX IF NOT EXISTS idx_audio_track_effects_clip ON audio_track_effects(clip_edit_id);
CREATE INDEX IF NOT EXISTS idx_audio_track_effects_project ON audio_track_effects(video_editor_project_id);
CREATE INDEX IF NOT EXISTS idx_audio_effect_keyframes_effect ON audio_effect_keyframes(effect_id);
