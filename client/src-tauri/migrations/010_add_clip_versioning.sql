-- Add clip versioning system
-- This migration adds support for tracking multiple versions of detected clips
-- with complete audit trail and rollback capabilities

-- Table to track each clip detection session/run
CREATE TABLE clip_detection_sessions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    prompt TEXT NOT NULL,
    detection_model TEXT NOT NULL DEFAULT 'claude-3.5-sonnet',
    server_response_id TEXT,
    quality_score REAL,
    total_clips_detected INTEGER DEFAULT 0,
    processing_time_ms INTEGER,
    validation_data TEXT,  -- JSON string with validation details
    created_at INTEGER NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Table to store version history for clips
CREATE TABLE clip_versions (
    id TEXT PRIMARY KEY,
    clip_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    parent_version_id TEXT,

    -- Clip data from detection
    name TEXT NOT NULL,
    description TEXT,
    start_time REAL NOT NULL,
    end_time REAL NOT NULL,

    -- Detection metadata
    confidence_score REAL,
    relevance_score REAL,
    detection_reason TEXT,
    tags TEXT,  -- JSON array of tags

    -- Change tracking
    change_type TEXT NOT NULL CHECK(change_type IN ('detected', 'modified', 'deleted')),
    change_description TEXT,

    created_at INTEGER NOT NULL,

    FOREIGN KEY (clip_id) REFERENCES clips(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES clip_detection_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_version_id) REFERENCES clip_versions(id)
);

-- Add versioning support to existing clips table
ALTER TABLE clips ADD COLUMN current_version_id TEXT;
ALTER TABLE clips ADD COLUMN detection_session_id TEXT;

-- Create indexes for performance
CREATE INDEX idx_clip_detection_sessions_project_id ON clip_detection_sessions(project_id);
CREATE INDEX idx_clip_detection_sessions_created_at ON clip_detection_sessions(created_at);
CREATE INDEX idx_clip_versions_clip_id ON clip_versions(clip_id);
CREATE INDEX idx_clip_versions_session_id ON clip_versions(session_id);
CREATE INDEX idx_clip_versions_parent_version_id ON clip_versions(parent_version_id);
CREATE INDEX idx_clips_detection_session_id ON clips(detection_session_id);
CREATE INDEX idx_clips_current_version_id ON clips(current_version_id);

-- Trigger to automatically set current_version_id when new clip versions are created
CREATE TRIGGER update_clip_current_version
AFTER INSERT ON clip_versions
WHEN NEW.change_type = 'detected'
BEGIN
    UPDATE clips
    SET current_version_id = NEW.id,
        detection_session_id = NEW.session_id
    WHERE id = NEW.clip_id;
END;

-- Trigger to update current_version_id when a clip is modified
CREATE TRIGGER update_clip_current_version_on_modify
AFTER INSERT ON clip_versions
WHEN NEW.change_type = 'modified'
BEGIN
    UPDATE clips
    SET current_version_id = NEW.id
    WHERE id = NEW.clip_id;
END;