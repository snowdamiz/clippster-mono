// Re-export core functionality
export { initDatabase, getDatabase, timestamp, generateId } from './database/core';

// Re-export types
export type {
  Project,
  Prompt,
  Transcript,
  ChunkedTranscript,
  TranscriptChunk,
  TranscriptSegment,
  IntroOutro,
  Clip,
  Thumbnail,
  RawVideo,
  ClipDetectionSession,
  ClipVersion,
  ClipSegment,
  ClipWithVersion,
} from './database/types';

// Re-export project functions
export {
  createProject,
  getProject,
  getAllProjects,
  updateProject,
  deleteProject,
  hasRawVideosForProject,
  hasClipsForProject,
  hasDetectedOrGeneratedClips,
} from './database/projects';

// Re-export prompt functions
export {
  createPrompt,
  getPrompt,
  getAllPrompts,
  updatePrompt,
  deletePrompt,
  seedDefaultPrompt,
} from './database/prompts';

// Re-export transcript functions
export {
  createTranscript,
  getTranscriptByRawVideoId,
  getTranscriptByProjectId,
  createTranscriptSegment,
  getTranscriptSegments,
  getTranscriptWithSegmentsByProjectId,
  searchTranscripts,
  searchSegments,
} from './database/transcripts';

// Re-export chunked transcript functions
export {
  createChunkedTranscript,
  storeTranscriptChunk,
  getChunkedTranscriptByRawVideoId,
  getTranscriptChunks,
  updateChunkedTranscriptCompleteness,
  getChunkMetadataForProcessing,
} from './database/chunked-transcripts';

// Re-export raw video functions
export {
  createRawVideo,
  getAllRawVideos,
  getNextSegmentNumber,
  getRawVideo,
  getRawVideosByProjectId,
  getRawVideoByPath,
  updateRawVideo,
  deleteRawVideo,
  hasClipsReferencingRawVideo,
} from './database/raw-videos';

// Keep the remaining imports for functionality not yet extracted
import { getDatabase, timestamp, generateId } from './database/core';
import {
  getTranscriptByRawVideoId,
  createTranscript,
  createTranscriptSegment,
  getTranscriptByProjectId,
} from './database/transcripts';
import { getRawVideosByProjectId } from './database/raw-videos';
import type {
  IntroOutro,
  Clip,
  Thumbnail,
  ClipDetectionSession,
  ClipVersion,
  ClipSegment,
  ClipWithVersion,
} from './database/types';

// Manual migration fallback function
export async function ensureClipVersioningTables(): Promise<void> {
  const db = await getDatabase();

  try {
    // Check if tables exist
    const sessionResult = await db.select<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='clip_detection_sessions'"
    );

    if (sessionResult.length === 0) {
      await db.execute(`
        CREATE TABLE clip_detection_sessions (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          prompt TEXT NOT NULL,
          detection_model TEXT NOT NULL DEFAULT 'claude-3.5-sonnet',
          server_response_id TEXT,
          quality_score REAL,
          total_clips_detected INTEGER DEFAULT 0,
          processing_time_ms INTEGER,
          validation_data TEXT,
          run_color TEXT NOT NULL DEFAULT '#8B5CF6',
          created_at INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
      `);
    } else {
      // Add run_color column if it doesn't exist (for existing tables)
      const pragmaResult = await db.select<{ name: string }[]>(
        'PRAGMA table_info(clip_detection_sessions)'
      );
      const hasRunColorColumn = pragmaResult.some((column) => column.name === 'run_color');

      if (!hasRunColorColumn) {
        await db.execute(
          "ALTER TABLE clip_detection_sessions ADD COLUMN run_color TEXT NOT NULL DEFAULT '#8B5CF6'"
        );
      }
    }

    const versionResult = await db.select<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='clip_versions'"
    );

    if (versionResult.length === 0) {
      await db.execute(`
        CREATE TABLE clip_versions (
          id TEXT PRIMARY KEY,
          clip_id TEXT NOT NULL,
          session_id TEXT NOT NULL,
          version_number INTEGER NOT NULL,
          parent_version_id TEXT,
          name TEXT NOT NULL,
          description TEXT,
          start_time REAL NOT NULL,
          end_time REAL NOT NULL,
          confidence_score REAL,
          relevance_score REAL,
          detection_reason TEXT,
          tags TEXT,
          change_type TEXT NOT NULL CHECK(change_type IN ('detected', 'modified', 'deleted')),
          change_description TEXT,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (clip_id) REFERENCES clips(id) ON DELETE CASCADE,
          FOREIGN KEY (session_id) REFERENCES clip_detection_sessions(id) ON DELETE CASCADE,
          FOREIGN KEY (parent_version_id) REFERENCES clip_versions(id)
        )
      `);
    }

    // Add columns to clips table if they don't exist
    // Check if columns exist first to avoid ALTER TABLE errors
    try {
      const columnResult = await db.select<any[]>('PRAGMA table_info(clips)');
      const columns = columnResult.map((col) => col.name);

      if (!columns.includes('current_version_id')) {
        await db.execute('ALTER TABLE clips ADD COLUMN current_version_id TEXT');
      }

      if (!columns.includes('detection_session_id')) {
        await db.execute('ALTER TABLE clips ADD COLUMN detection_session_id TEXT');
      }
    } catch (e) {
      // Try the basic ALTER TABLE as fallback
      try {
        await db.execute('ALTER TABLE clips ADD COLUMN current_version_id TEXT');
      } catch {
        // Ignore if still fails
      }
      try {
        await db.execute('ALTER TABLE clips ADD COLUMN detection_session_id TEXT');
      } catch {
        // Ignore if still fails
      }
    }

    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_clip_detection_sessions_project_id ON clip_detection_sessions(project_id)',
      'CREATE INDEX IF NOT EXISTS idx_clip_detection_sessions_created_at ON clip_detection_sessions(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_clip_versions_clip_id ON clip_versions(clip_id)',
      'CREATE INDEX IF NOT EXISTS idx_clip_versions_session_id ON clip_versions(session_id)',
      'CREATE INDEX IF NOT EXISTS idx_clip_versions_parent_version_id ON clip_versions(parent_version_id)',
      'CREATE INDEX IF NOT EXISTS idx_clips_detection_session_id ON clips(detection_session_id)',
      'CREATE INDEX IF NOT EXISTS idx_clips_current_version_id ON clips(current_version_id)',
    ];

    for (const indexSql of indexes) {
      await db.execute(indexSql);
    }
  } catch (error) {
    throw error;
  }
}

// Clip queries
export async function createClip(
  projectId: string,
  filePath: string,
  options?: {
    name?: string;
    duration?: number;
    startTime?: number;
    endTime?: number;
    orderIndex?: number;
    introId?: string;
    outroId?: string;
  }
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  await db.execute(
    'INSERT INTO clips (id, project_id, name, file_path, duration, start_time, end_time, order_index, intro_id, outro_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      id,
      projectId,
      options?.name || null,
      filePath,
      options?.duration || null,
      options?.startTime || null,
      options?.endTime || null,
      options?.orderIndex || null,
      options?.introId || null,
      options?.outroId || null,
      now,
      now,
    ]
  );

  return id;
}

export async function getAllClips(): Promise<Clip[]> {
  const db = await getDatabase();
  return await db.select<Clip[]>('SELECT * FROM clips ORDER BY created_at DESC');
}

export async function getGeneratedClips(): Promise<Clip[]> {
  const db = await getDatabase();
  return await db.select<Clip[]>('SELECT * FROM clips WHERE status = ? ORDER BY created_at DESC', [
    'generated',
  ]);
}

export async function getDetectedClips(): Promise<Clip[]> {
  const db = await getDatabase();
  return await db.select<Clip[]>('SELECT * FROM clips WHERE status = ? ORDER BY created_at DESC', [
    'detected',
  ]);
}

export async function getClipsByProjectId(projectId: string): Promise<Clip[]> {
  const db = await getDatabase();
  return await db.select<Clip[]>(
    'SELECT * FROM clips WHERE project_id = ? ORDER BY order_index, created_at',
    [projectId]
  );
}

export async function updateClip(
  id: string,
  updates: Partial<Omit<Clip, 'id' | 'project_id' | 'created_at'>>
): Promise<void> {
  const db = await getDatabase();
  const now = timestamp();

  const updateFields: string[] = [];
  const values: any[] = [];

  for (const [key, value] of Object.entries(updates)) {
    updateFields.push(`${key} = ?`);
    values.push(value);
  }

  updateFields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await db.execute(`UPDATE clips SET ${updateFields.join(', ')} WHERE id = ?`, values);
}

export async function deleteClip(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM clips WHERE id = ?', [id]);
}

// IntroOutro queries
export async function createIntroOutro(
  type: 'intro' | 'outro',
  name: string,
  filePath: string,
  duration?: number,
  thumbnailPath?: string | null,
  thumbnailGenerationStatus?: 'pending' | 'processing' | 'completed' | 'failed'
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  await db.execute(
    'INSERT INTO intro_outros (id, type, name, file_path, duration, thumbnail_path, thumbnail_generation_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      id,
      type,
      name,
      filePath,
      duration || null,
      thumbnailPath || null,
      thumbnailGenerationStatus || 'pending',
      now,
      now,
    ]
  );

  return id;
}

export async function getAllIntroOutros(type?: 'intro' | 'outro'): Promise<IntroOutro[]> {
  const db = await getDatabase();

  if (type) {
    return await db.select<IntroOutro[]>(
      'SELECT * FROM intro_outros WHERE type = ? ORDER BY name',
      [type]
    );
  }

  return await db.select<IntroOutro[]>('SELECT * FROM intro_outros ORDER BY type, name');
}

export async function updateIntroOutroCompletion(
  id: string,
  filePath: string,
  thumbnailPath: string | null,
  duration: number | undefined,
  status: 'completed' | 'failed'
): Promise<void> {
  const db = await getDatabase();

  if (status === 'completed') {
    await db.execute(
      'UPDATE intro_outros SET file_path = ?, thumbnail_path = ?, duration = ?, thumbnail_generation_status = ?, updated_at = ? WHERE id = ?',
      [filePath, thumbnailPath, duration || null, status, timestamp(), id]
    );
  } else {
    await db.execute(
      'UPDATE intro_outros SET thumbnail_generation_status = ?, updated_at = ? WHERE id = ?',
      [status, timestamp(), id]
    );
  }
}

export async function updateIntroOutroThumbnailStatus(
  id: string,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  thumbnailPath?: string | null
): Promise<void> {
  const db = await getDatabase();
  const now = timestamp();

  if (thumbnailPath) {
    await db.execute(
      'UPDATE intro_outros SET thumbnail_generation_status = ?, thumbnail_path = ?, updated_at = ? WHERE id = ?',
      [status, thumbnailPath, now, id]
    );
  } else {
    await db.execute(
      'UPDATE intro_outros SET thumbnail_generation_status = ?, updated_at = ? WHERE id = ?',
      [status, now, id]
    );
  }
}

export async function deleteIntroOutro(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM intro_outros WHERE id = ?', [id]);
}

// Thumbnail queries
export async function createThumbnail(
  clipId: string,
  filePath: string,
  width?: number,
  height?: number
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  await db.execute(
    'INSERT INTO thumbnails (id, clip_id, file_path, width, height, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, clipId, filePath, width || null, height || null, now]
  );

  return id;
}

export async function getThumbnailByClipId(clipId: string): Promise<Thumbnail | null> {
  const db = await getDatabase();
  const result = await db.select<Thumbnail[]>('SELECT * FROM thumbnails WHERE clip_id = ?', [
    clipId,
  ]);
  return result[0] || null;
}

// Check if segment tracking columns exist in the database
async function checkSegmentTrackingExists(): Promise<boolean> {
  try {
    const db = await getDatabase();
    // Try to query one of the new columns - if it fails, the columns don't exist
    await db.execute('SELECT segment_number FROM raw_videos LIMIT 1');
    return true;
  } catch (error) {
    return false;
  }
}

// Generate a random color for clip detection runs
function generateRunColor(): string {
  const colors = [
    '#8B5CF6', // Purple (default)
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#06B6D4', // Cyan
    '#F97316', // Orange
    '#84CC16', // Lime
    '#EC4899', // Pink
    '#6366F1', // Indigo
    '#14B8A6', // Teal
    '#A855F7', // Violet
  ];

  // Pick a random color from the predefined list
  return colors[Math.floor(Math.random() * colors.length)];
}

// Clip Detection Session queries
export async function createClipDetectionSession(
  projectId: string,
  prompt: string,
  options?: {
    detectionModel?: string;
    serverResponseId?: string;
    qualityScore?: number;
    totalClipsDetected?: number;
    processingTimeMs?: number;
    validationData?: any;
    runColor?: string;
  }
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  await db.execute(
    `INSERT INTO clip_detection_sessions (
      id, project_id, prompt, detection_model, server_response_id,
      quality_score, total_clips_detected, processing_time_ms,
      validation_data, run_color, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      projectId,
      prompt,
      options?.detectionModel || 'claude-3.5-sonnet',
      options?.serverResponseId || null,
      options?.qualityScore || null,
      options?.totalClipsDetected || 0,
      options?.processingTimeMs || null,
      options?.validationData ? JSON.stringify(options.validationData) : null,
      options?.runColor || generateRunColor(),
      now,
    ]
  );

  return id;
}

export async function getClipDetectionSession(id: string): Promise<ClipDetectionSession | null> {
  const db = await getDatabase();
  const result = await db.select<ClipDetectionSession[]>(
    'SELECT * FROM clip_detection_sessions WHERE id = ?',
    [id]
  );
  return result[0] || null;
}

export async function getClipDetectionSessionsByProjectId(
  projectId: string
): Promise<ClipDetectionSession[]> {
  const db = await getDatabase();
  return await db.select<ClipDetectionSession[]>(
    'SELECT * FROM clip_detection_sessions WHERE project_id = ? ORDER BY created_at DESC',
    [projectId]
  );
}

export async function updateClipDetectionSession(
  id: string,
  updates: Partial<
    Omit<ClipDetectionSession, 'id' | 'project_id' | 'prompt' | 'detection_model' | 'created_at'>
  >
): Promise<void> {
  const db = await getDatabase();

  const updateFields: string[] = [];
  const values: any[] = [];

  for (const [key, value] of Object.entries(updates)) {
    updateFields.push(`${key} = ?`);
    values.push(value);
  }

  if (updateFields.length === 0) return;

  await db.execute(`UPDATE clip_detection_sessions SET ${updateFields.join(', ')} WHERE id = ?`, [
    ...values,
    id,
  ]);
}

export async function deleteClipDetectionSession(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM clip_detection_sessions WHERE id = ?', [id]);
}

// Clip Version queries
export async function createClipVersion(
  clipId: string,
  sessionId: string,
  versionNumber: number,
  clipData: {
    name: string;
    description?: string;
    startTime: number;
    endTime: number;
    confidenceScore?: number;
    relevanceScore?: number;
    detectionReason?: string;
    tags?: string[];
  },
  changeType: 'detected' | 'modified' | 'deleted',
  changeDescription?: string,
  parentVersionId?: string
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  await db.execute(
    `INSERT INTO clip_versions (
      id, clip_id, session_id, version_number, parent_version_id,
      name, description, start_time, end_time,
      confidence_score, relevance_score, detection_reason, tags,
      change_type, change_description, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      clipId,
      sessionId,
      versionNumber,
      parentVersionId || null,
      clipData.name,
      clipData.description || null,
      clipData.startTime,
      clipData.endTime,
      clipData.confidenceScore || null,
      clipData.relevanceScore || null,
      clipData.detectionReason || null,
      clipData.tags ? JSON.stringify(clipData.tags) : null,
      changeType,
      changeDescription || null,
      now,
    ]
  );

  return id;
}

export async function getClipVersion(id: string): Promise<ClipVersion | null> {
  const db = await getDatabase();
  const result = await db.select<ClipVersion[]>('SELECT * FROM clip_versions WHERE id = ?', [id]);
  return result[0] || null;
}

export async function getClipSegmentsByVersionId(versionId: string): Promise<ClipSegment[]> {
  const db = await getDatabase();
  return await db.select<ClipSegment[]>(
    'SELECT * FROM clip_segments WHERE clip_version_id = ? ORDER BY segment_index ASC',
    [versionId]
  );
}

// Update a single clip segment's timing
export async function updateClipSegment(
  clipId: string,
  segmentIndex: number,
  startTime: number,
  endTime: number
): Promise<void> {
  const db = await getDatabase();
  const duration = endTime - startTime;

  // Get the current version ID for this clip
  const clipVersions = await db.select<ClipVersion[]>(
    'SELECT id FROM clip_versions WHERE clip_id = ? ORDER BY version_number DESC LIMIT 1',
    [clipId]
  );

  if (clipVersions.length === 0) {
    throw new Error('No clip version found for clip');
  }

  const versionId = clipVersions[0].id;

  // Update the clip segment
  await db.execute(
    'UPDATE clip_segments SET start_time = ?, end_time = ?, duration = ? WHERE clip_version_id = ? AND segment_index = ?',
    [startTime, endTime, duration, versionId, segmentIndex]
  );
}

// Get adjacent clip segments for collision detection
export async function getAdjacentClipSegments(
  clipId: string,
  segmentIndex: number
): Promise<{ previous: ClipSegment | null; next: ClipSegment | null }> {
  const db = await getDatabase();

  // Get the current version ID for this clip
  const clipVersions = await db.select<ClipVersion[]>(
    'SELECT id FROM clip_versions WHERE clip_id = ? ORDER BY version_number DESC LIMIT 1',
    [clipId]
  );

  if (clipVersions.length === 0) {
    return { previous: null, next: null };
  }

  const versionId = clipVersions[0].id;

  // Get all segments for this clip version, ordered by time
  const segments = await db.select<ClipSegment[]>(
    'SELECT * FROM clip_segments WHERE clip_version_id = ? ORDER BY start_time, segment_index',
    [versionId]
  );

  if (segments.length === 0 || segmentIndex < 0 || segmentIndex >= segments.length) {
    return { previous: null, next: null };
  }

  return {
    previous: segmentIndex > 0 ? segments[segmentIndex - 1] : null,
    next: segmentIndex < segments.length - 1 ? segments[segmentIndex + 1] : null,
  };
}

// Get all clip segments for a clip (ordered by time)
export async function getClipSegmentsByClipId(clipId: string): Promise<ClipSegment[]> {
  const db = await getDatabase();

  // Get the current version ID for this clip
  const clipVersions = await db.select<ClipVersion[]>(
    'SELECT id FROM clip_versions WHERE clip_id = ? ORDER BY version_number DESC LIMIT 1',
    [clipId]
  );

  if (clipVersions.length === 0) {
    return [];
  }

  const versionId = clipVersions[0].id;

  return await db.select<ClipSegment[]>(
    'SELECT * FROM clip_segments WHERE clip_version_id = ? ORDER BY start_time, segment_index ASC',
    [versionId]
  );
}

// Split a clip segment into two separate segments at a specific time
export async function splitClipSegment(
  clipId: string,
  segmentIndex: number,
  cutTime: number
): Promise<{ leftSegmentIndex: number; rightSegmentIndex: number }> {
  const db = await getDatabase();

  // Get the current version ID for this clip
  const clipVersions = await db.select<ClipVersion[]>(
    'SELECT id FROM clip_versions WHERE clip_id = ? ORDER BY version_number DESC LIMIT 1',
    [clipId]
  );

  if (clipVersions.length === 0) {
    throw new Error('No clip version found for clip');
  }

  const versionId = clipVersions[0].id;

  // Get the segment to split and all subsequent segments
  const segments = await db.select<ClipSegment[]>(
    'SELECT * FROM clip_segments WHERE clip_version_id = ? ORDER BY start_time, segment_index',
    [versionId]
  );

  if (segments.length <= segmentIndex) {
    throw new Error('Segment not found');
  }

  const segmentToSplit = segments[segmentIndex];

  // Validate cut time is within segment bounds
  if (cutTime <= segmentToSplit.start_time || cutTime >= segmentToSplit.end_time) {
    throw new Error('Cut time must be within segment boundaries');
  }

  // Validate minimum segment durations (0.5 seconds each)
  const leftDuration = cutTime - segmentToSplit.start_time;
  const rightDuration = segmentToSplit.end_time - cutTime;

  if (leftDuration < 0.5 || rightDuration < 0.5) {
    throw new Error('Both segments must be at least 0.5 seconds long');
  }

  try {
    // Split the transcript if it contains word-level timing
    let leftTranscript = null;
    let rightTranscript = null;

    if (segmentToSplit.transcript) {
      let transcriptData;

      try {
        transcriptData = JSON.parse(segmentToSplit.transcript);
      } catch (parseError) {
        // Transcript is plain text, not JSON - handle as plain text split

        // For plain text, we'll use a simple approach: keep original on left, none on right
        // This preserves the transcript content without requiring word-level timing
        leftTranscript = segmentToSplit.transcript;
        // Right segment gets no transcript for plain text splits
      }

      // Handle different transcript formats only if we successfully parsed JSON
      if (transcriptData) {
        if (transcriptData.words && Array.isArray(transcriptData.words)) {
          // Split words array
          const leftWords = [];
          const rightWords = [];

          for (const word of transcriptData.words) {
            if (word.end !== undefined && word.end <= cutTime) {
              leftWords.push(word);
            } else if (word.start !== undefined && word.start >= cutTime) {
              rightWords.push(word);
            }
          }

          leftTranscript = JSON.stringify({ ...transcriptData, words: leftWords });
          rightTranscript = JSON.stringify({ ...transcriptData, words: rightWords });
        } else if (transcriptData.segments && Array.isArray(transcriptData.segments)) {
          // Split segments array
          const leftSegments = [];
          const rightSegments = [];

          for (const seg of transcriptData.segments) {
            if (seg.end !== undefined && seg.end <= cutTime) {
              leftSegments.push(seg);
            } else if (seg.start !== undefined && seg.start >= cutTime) {
              rightSegments.push(seg);
            }
          }

          leftTranscript = JSON.stringify({ ...transcriptData, segments: leftSegments });
          rightTranscript = JSON.stringify({ ...transcriptData, segments: rightSegments });
        } else if (Array.isArray(transcriptData)) {
          // Split direct array of words
          const leftWords = [];
          const rightWords = [];

          for (const word of transcriptData) {
            if (word.end !== undefined && word.end <= cutTime) {
              leftWords.push(word);
            } else if (word.start !== undefined && word.start >= cutTime) {
              rightWords.push(word);
            }
          }

          leftTranscript = JSON.stringify(leftWords);
          rightTranscript = JSON.stringify(rightWords);
        }
      }
    }

    // Create the two new segments
    const leftSegmentId = generateId();
    const rightSegmentId = generateId();
    const now = timestamp();

    // First, shift all segments that come after the original segment up by 1
    // This creates space for our new right segment
    await db.execute(
      `UPDATE clip_segments
       SET segment_index = segment_index + 1
       WHERE clip_version_id = ? AND segment_index > ?`,
      [versionId, segmentIndex]
    );

    // Delete the original segment to free up its index
    await db.execute('DELETE FROM clip_segments WHERE id = ?', [segmentToSplit.id]);

    // Now insert the left segment at the original index
    await db.execute(
      `INSERT INTO clip_segments (
        id, clip_version_id, segment_index, start_time, end_time, duration, transcript, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        leftSegmentId,
        versionId,
        segmentIndex,
        segmentToSplit.start_time,
        cutTime,
        leftDuration,
        leftTranscript,
        now,
      ]
    );

    // Insert right segment at index + 1 (which is now free due to the shift)
    await db.execute(
      `INSERT INTO clip_segments (
        id, clip_version_id, segment_index, start_time, end_time, duration, transcript, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rightSegmentId,
        versionId,
        segmentIndex + 1,
        cutTime,
        segmentToSplit.end_time,
        rightDuration,
        rightTranscript,
        now,
      ]
    );

    return {
      leftSegmentIndex: segmentIndex,
      rightSegmentIndex: segmentIndex + 1,
    };
  } catch (error) {
    throw new Error(
      `Failed to split segment: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// Delete a clip segment
export async function deleteClipSegment(clipId: string, segmentIndex: number): Promise<void> {
  const db = await getDatabase();

  try {
    // Get the current clip version to find the segment
    const clip = await db.select<{ current_version_id: string }[]>(
      'SELECT current_version_id FROM clips WHERE id = ?',
      [clipId]
    );

    if (clip.length === 0) {
      throw new Error('Clip not found');
    }

    const versionId = clip[0].current_version_id;

    // Get all segments to determine segment count
    const segments = await db.select<{ id: string; segment_index: number }[]>(
      'SELECT id, segment_index FROM clip_segments WHERE clip_version_id = ? ORDER BY segment_index',
      [versionId]
    );

    if (segmentIndex < 0 || segmentIndex >= segments.length) {
      throw new Error('Invalid segment index');
    }

    // Don't allow deletion if it's the only segment
    if (segments.length <= 1) {
      throw new Error('Cannot delete the last segment of a clip');
    }

    const segmentToDelete = segments[segmentIndex];

    // Delete the segment
    await db.execute('DELETE FROM clip_segments WHERE id = ?', [segmentToDelete.id]);

    // Update segment indices for segments after the deleted one
    await db.execute(
      'UPDATE clip_segments SET segment_index = segment_index - 1 WHERE clip_version_id = ? AND segment_index > ?',
      [versionId, segmentIndex]
    );
  } catch (error) {
    throw new Error(
      `Failed to delete segment: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

// Realign transcript words within a moved clip segment
export async function realignClipSegment(
  clipId: string,
  segmentIndex: number,
  originalStartTime: number,
  originalEndTime: number,
  newStartTime: number,
  newEndTime: number
): Promise<void> {
  const db = await getDatabase();

  // Get the current version ID for this clip
  const clipVersions = await db.select<ClipVersion[]>(
    'SELECT id FROM clip_versions WHERE clip_id = ? ORDER BY version_number DESC LIMIT 1',
    [clipId]
  );

  if (clipVersions.length === 0) {
    throw new Error('No clip version found for clip');
  }

  const versionId = clipVersions[0].id;

  // Get the clip segment to realign
  const segments = await db.select<ClipSegment[]>(
    'SELECT * FROM clip_segments WHERE clip_version_id = ? ORDER BY start_time, segment_index',
    [versionId]
  );

  if (segments.length <= segmentIndex) {
    throw new Error('Segment not found');
  }

  // Calculate time shift and scale for realignment
  const timeShift = newStartTime - originalStartTime;
  const timeScale = (newEndTime - newStartTime) / (originalEndTime - originalStartTime);

  // Get the segment data
  const segment = segments[segmentIndex];
  if (!segment.transcript) {
    return;
  }

  try {
    // Parse the transcript to extract word-level timing if available
    let realignedTranscript = segment.transcript;

    // Check if transcript contains word-level timestamps (JSON format)
    if (segment.transcript.trim().startsWith('{') || segment.transcript.trim().startsWith('[')) {
      try {
        const transcriptData = JSON.parse(segment.transcript);

        // Handle different transcript formats
        if (transcriptData.words && Array.isArray(transcriptData.words)) {
          // Format: { words: [{word: "hello", start: 0.0, end: 0.5}, ...] }
          transcriptData.words.forEach((word: any) => {
            if (word.start !== undefined) word.start = word.start * timeScale + timeShift;
            if (word.end !== undefined) word.end = word.end * timeScale + timeShift;
          });
          realignedTranscript = JSON.stringify(transcriptData);
        } else if (transcriptData.segments && Array.isArray(transcriptData.segments)) {
          // Format: { segments: [{start: 0.0, end: 2.0, text: "hello world"}] }
          transcriptData.segments.forEach((seg: any) => {
            if (seg.start !== undefined) seg.start = seg.start * timeScale + timeShift;
            if (seg.end !== undefined) seg.end = seg.end * timeScale + timeShift;
          });
          realignedTranscript = JSON.stringify(transcriptData);
        } else if (Array.isArray(transcriptData)) {
          // Format: [{word: "hello", start: 0.0, end: 0.5}, ...]
          transcriptData.forEach((word: any) => {
            if (word.start !== undefined) word.start = word.start * timeScale + timeShift;
            if (word.end !== undefined) word.end = word.end * timeScale + timeShift;
          });
          realignedTranscript = JSON.stringify(transcriptData);
        }
      } catch (parseError) {
        console.log('[Database] Transcript is not valid JSON, treating as plain text');
        // Keep as plain text, no word-level timing to adjust
      }
    }

    // Update the segment with realigned transcript
    await db.execute(
      'UPDATE clip_segments SET transcript = ? WHERE clip_version_id = ? AND segment_index = ?',
      [realignedTranscript, versionId, segmentIndex]
    );
  } catch (error) {
    console.error('[Database] Failed to realign segment transcript:', error);
    // Continue without transcript realignment - segment timing is still updated
  }
}

export async function getClipVersionsByClipId(clipId: string): Promise<ClipVersion[]> {
  const db = await getDatabase();
  return await db.select<ClipVersion[]>(
    'SELECT * FROM clip_versions WHERE clip_id = ? ORDER BY version_number DESC',
    [clipId]
  );
}

export async function getClipVersionsBySessionId(sessionId: string): Promise<ClipVersion[]> {
  const db = await getDatabase();
  return await db.select<ClipVersion[]>(
    'SELECT * FROM clip_versions WHERE session_id = ? ORDER BY version_number',
    [sessionId]
  );
}

export async function getCurrentClipVersion(clipId: string): Promise<ClipVersion | null> {
  const db = await getDatabase();
  const result = await db.select<ClipVersion[]>(
    `SELECT cv.* FROM clip_versions cv
     JOIN clips c ON c.current_version_id = cv.id
     WHERE c.id = ?`,
    [clipId]
  );
  return result[0] || null;
}

// Enhanced clip queries with versioning support
export async function createVersionedClip(
  projectId: string,
  sessionId: string,
  clipData: {
    name: string;
    startTime: number;
    endTime: number;
    description?: string;
    confidenceScore?: number;
    relevanceScore?: number;
    detectionReason?: string;
    tags?: string[];
    segments?: Array<{
      start_time: number;
      end_time: number;
      duration: number;
      transcript?: string;
    }>;
  },
  filePath?: string
): Promise<string> {
  const db = await getDatabase();
  const clipId = generateId();
  const now = timestamp();

  // Create the clip record first
  await db.execute(
    `INSERT INTO clips (
      id, project_id, name, file_path, start_time, end_time,
      detection_session_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      clipId,
      projectId,
      clipData.name,
      filePath || '',
      clipData.startTime,
      clipData.endTime,
      sessionId,
      now,
      now,
    ]
  );

  // Create the initial version (version 1)
  const versionId = await createClipVersion(
    clipId,
    sessionId,
    1,
    clipData,
    'detected',
    'Initial clip detection'
  );

  // Create segments if provided
  if (clipData.segments && Array.isArray(clipData.segments) && clipData.segments.length > 0) {
    for (let i = 0; i < clipData.segments.length; i++) {
      const segment = clipData.segments[i];
      const segmentId = generateId();

      await db.execute(
        `INSERT INTO clip_segments (
          id, clip_version_id, segment_index, start_time, end_time, duration, transcript, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          segmentId,
          versionId,
          i,
          segment.start_time,
          segment.end_time,
          segment.duration || segment.end_time - segment.start_time,
          segment.transcript || null,
          now,
        ]
      );
    }
  }

  // Update the clip with the current version and session ID
  await db.execute(
    'UPDATE clips SET current_version_id = ?, detection_session_id = ? WHERE id = ?',
    [versionId, sessionId, clipId]
  );

  return clipId;
}

export async function getClipsWithVersionsByProjectId(
  projectId: string
): Promise<ClipWithVersion[]> {
  const db = await getDatabase();

  const clips = await db.select<any[]>(
    `SELECT
      c.*,
      cv.id as current_version_id,
      cv.name as current_version_name,
      cv.description as current_version_description,
      cv.start_time as current_version_start_time,
      cv.end_time as current_version_end_time,
      cv.confidence_score as current_version_confidence_score,
      cv.relevance_score as current_version_relevance_score,
      cv.detection_reason as current_version_detection_reason,
      cv.tags as current_version_tags,
      cv.change_type as current_version_change_type,
      cv.created_at as current_version_created_at,
      s.id as detection_session_id,
      s.created_at as session_created_at,
      s.run_color as session_run_color,
      s.prompt as session_prompt,
      (SELECT COUNT(*) + 1 FROM clip_detection_sessions s2
       WHERE s2.project_id = ? AND s2.created_at < s.created_at) as run_number
     FROM clips c
     LEFT JOIN clip_versions cv ON c.current_version_id = cv.id
     LEFT JOIN clip_detection_sessions s ON c.detection_session_id = s.id
     WHERE c.project_id = ?
     ORDER BY s.created_at DESC, c.created_at DESC`,
    [projectId, projectId]
  );

  // Load segments for each clip's current version
  for (const clip of clips) {
    if (clip.current_version_id) {
      const segments = await db.select<ClipSegment[]>(
        `SELECT * FROM clip_segments
         WHERE clip_version_id = ?
         ORDER BY segment_index ASC`,
        [clip.current_version_id]
      );
      clip.current_version_segments = segments;
    }
  }

  return clips.map((clip) => {
    const mapped = {
      ...clip,
      current_version: clip.current_version_id
        ? {
            id: clip.current_version_id,
            clip_id: clip.id,
            session_id: clip.detection_session_id || '',
            version_number: 1,
            parent_version_id: null,
            name: clip.current_version_name || clip.name || '',
            description: clip.current_version_description || null,
            start_time: clip.current_version_start_time || clip.start_time || 0,
            end_time: clip.current_version_end_time || clip.end_time || 0,
            confidence_score: clip.current_version_confidence_score,
            relevance_score: clip.current_version_relevance_score,
            detection_reason: clip.current_version_detection_reason,
            tags: clip.current_version_tags,
            change_type: clip.current_version_change_type as 'detected' | 'modified' | 'deleted',
            change_description: null,
            created_at: clip.current_version_created_at,
          }
        : undefined,
    };

    return mapped;
  }) as ClipWithVersion[];
}

export async function persistClipDetectionResults(
  projectId: string,
  prompt: string,
  detectionResults: {
    clips: any[];
    transcript?: any;
    validation?: any;
  },
  options?: {
    detectionModel?: string;
    serverResponseId?: string;
    processingTimeMs?: number;
  }
): Promise<string> {
  const startTime = Date.now();
  // Check for nested structure in clips property
  if (
    detectionResults.clips &&
    typeof detectionResults.clips === 'object' &&
    (detectionResults.clips as any).clips
  ) {
    (detectionResults as any).clips = (detectionResults.clips as any).clips;
  }

  // Double-check if clips might be in a different property
  if (!detectionResults.clips || (detectionResults.clips as any[]).length === 0) {
    for (const key of Object.keys(detectionResults)) {
      const value = detectionResults[key as keyof typeof detectionResults];
      if (Array.isArray(value) && value.length > 0) {
        // Check if this looks like clips data
        if ((value[0] as any)?.id || (value[0] as any)?.title || (value[0] as any)?.segments) {
          (detectionResults as any).clips = value;
          break;
        }
      }
    }
  }

  // Ensure clip versioning tables exist before proceeding
  await ensureClipVersioningTables();

  // Store transcript if provided
  let transcriptId: string | null = null;
  if (detectionResults.transcript) {
    try {
      // Get the raw video associated with this project
      const rawVideos = await getRawVideosByProjectId(projectId);
      if (rawVideos.length === 0) {
        console.warn('[Database] No raw video found for project, cannot store transcript');
      } else {
        const rawVideo = rawVideos[0]; // Use the first raw video found

        // Check if transcript already exists for this raw video
        const existingTranscript = await getTranscriptByRawVideoId(rawVideo.id);

        if (existingTranscript) {
          transcriptId = existingTranscript.id;

          // Check if this was a fresh transcription or cached
          const usedCachedTranscript = (detectionResults as any).processing_info
            ?.used_cached_transcript;

          if (!usedCachedTranscript) {
            // Update the existing transcript with fresh data
            const transcriptText =
              detectionResults.transcript.text ||
              detectionResults.transcript.segments?.map((seg: any) => seg.text).join(' ') ||
              '' ||
              JSON.stringify(detectionResults.transcript);

            const language = detectionResults.transcript.language;
            const duration =
              detectionResults.transcript.duration ||
              detectionResults.transcript.segments?.reduce(
                (acc: number, seg: any) => Math.max(acc, seg.end_time || 0),
                0
              ) ||
              null;

            const db = await getDatabase();
            await db.execute(
              'UPDATE transcripts SET raw_json = ?, text = ?, language = ?, duration = ? WHERE id = ?',
              [
                JSON.stringify(detectionResults.transcript),
                transcriptText,
                language,
                duration,
                transcriptId,
              ]
            );

            // Delete existing segments to refresh them
            await db.execute('DELETE FROM transcript_segments WHERE transcript_id = ?', [
              transcriptId,
            ]);
          } else {
            console.log('[Database] Used cached transcript, no database update needed');
          }
        } else {
          // Extract transcript data from Whisper response (only when no existing transcript)
          const transcriptText =
            detectionResults.transcript.text ||
            detectionResults.transcript.segments?.map((seg: any) => seg.text).join(' ') ||
            '' ||
            JSON.stringify(detectionResults.transcript);

          const language = detectionResults.transcript.language;
          const duration =
            detectionResults.transcript.duration ||
            detectionResults.transcript.segments?.reduce(
              (acc: number, seg: any) => Math.max(acc, seg.end_time || 0),
              0
            ) ||
            null;

          transcriptId = await createTranscript(
            rawVideo.id, // Use raw_video_id instead of project_id
            JSON.stringify(detectionResults.transcript), // Store full raw response
            transcriptText,
            language,
            duration
          );
        }

        // Store transcript segments if available (only for fresh transcriptions)
        const usedCachedTranscript = (detectionResults as any).processing_info
          ?.used_cached_transcript;
        if (
          !usedCachedTranscript &&
          detectionResults.transcript.segments &&
          Array.isArray(detectionResults.transcript.segments)
        ) {
          for (let i = 0; i < detectionResults.transcript.segments.length; i++) {
            const segment = detectionResults.transcript.segments[i];
            await createTranscriptSegment(
              transcriptId,
              segment.start_time || 0,
              segment.end_time || 0,
              segment.text || '',
              i
            );
          }
        } else if (usedCachedTranscript) {
          console.log('[Database] Using cached transcript segments, no segment storage needed');
        }
      }
    } catch (error) {
      console.error('[Database] Failed to store transcript:', error);
    }
  } else {
    console.log('[Database] No transcript data provided in detection results');
  }

  // Create detection session
  const sessionId = await createClipDetectionSession(projectId, prompt, {
    detectionModel: options?.detectionModel || 'claude-3.5-sonnet',
    serverResponseId: options?.serverResponseId,
    qualityScore: detectionResults.validation?.qualityScore,
    totalClipsDetected: detectionResults.clips?.length || 0,
    processingTimeMs: options?.processingTimeMs || Date.now() - startTime,
    validationData: detectionResults.validation,
  });

  // Keep all existing clips - each detection run creates new clips without removing previous ones
  // This allows users to see all clips generated across all detection runs

  // Persist detected clips
  const clipsArray = detectionResults.clips as any[];
  for (let i = 0; i < clipsArray.length; i++) {
    const clipData = clipsArray[i];

    // Extract timing data from segments
    let startTime = 0;
    let endTime = 0;

    if (clipData.segments && Array.isArray(clipData.segments) && clipData.segments.length > 0) {
      // Calculate total duration from all segments
      const firstSegment = clipData.segments[0];
      const lastSegment = clipData.segments[clipData.segments.length - 1];
      startTime = firstSegment.start_time || 0;
      endTime = lastSegment.end_time || 0;
    } else if (clipData.total_duration) {
      // Fallback to total_duration if available
      endTime = clipData.total_duration;
    } else {
      console.log(`[Database] No timing data found for clip ${i + 1}:`, {
        hasSegments: !!clipData.segments,
        segmentsLength: clipData.segments?.length,
        hasTotalDuration: !!clipData.total_duration,
        clipDataKeys: Object.keys(clipData),
      });
    }

    // Extract clip information from the detected data
    const clipInfo = {
      name: clipData.name || clipData.title || `Clip ${i + 1}`,
      startTime: startTime,
      endTime: endTime,
      description: clipData.description || clipData.summary || clipData.socialMediaPost,
      confidenceScore: clipData.confidenceScore || clipData.confidence,
      relevanceScore: clipData.relevanceScore || clipData.relevance,
      detectionReason:
        clipData.reason || clipData.detectionReason || 'AI detected clip-worthy moment',
      tags: clipData.tags || clipData.keywords || [],
      segments: clipData.segments || [],
    };

    try {
      await createVersionedClip(projectId, sessionId, clipInfo);
    } catch (e) {
      console.error(`[Database] Failed to create clip ${i + 1}:`, e);
    }
  }

  // Verify the clips were actually saved
  try {
    await getClipsWithVersionsByProjectId(projectId);
  } catch (e) {
    console.error('[Database] Error verifying saved clips:', e);
  }

  return sessionId;
}

export async function restoreClipVersion(clipId: string, versionId: string): Promise<void> {
  const db = await getDatabase();

  // Get the version to restore
  const version = await getClipVersion(versionId);
  if (!version) {
    throw new Error(`Version ${versionId} not found`);
  }

  // Create a new version based on the old one
  const newVersionId = await createClipVersion(
    clipId,
    version.session_id,
    await getNextVersionNumber(clipId),
    {
      name: version.name,
      description: version.description || undefined,
      startTime: version.start_time,
      endTime: version.end_time,
      confidenceScore: version.confidence_score || undefined,
      relevanceScore: version.relevance_score || undefined,
      detectionReason: version.detection_reason || undefined,
      tags: version.tags ? JSON.parse(version.tags) : undefined,
    },
    'modified',
    `Restored from version ${version.version_number}`,
    versionId
  );

  // Update the clip's current version
  await db.execute('UPDATE clips SET current_version_id = ? WHERE id = ?', [newVersionId, clipId]);

  // Also update the clip's basic fields for compatibility
  await db.execute(
    'UPDATE clips SET name = ?, start_time = ?, end_time = ?, updated_at = ? WHERE id = ?',
    [version.name, version.start_time, version.end_time, timestamp(), clipId]
  );
}

async function getNextVersionNumber(clipId: string): Promise<number> {
  const db = await getDatabase();
  const result = await db.select<{ max_version: number }[]>(
    'SELECT COALESCE(MAX(version_number), 0) as max_version FROM clip_versions WHERE clip_id = ?',
    [clipId]
  );
  return (result[0]?.max_version || 0) + 1;
}

// Update a word in the transcript and all related segments
export async function updateTranscriptWord(
  projectId: string,
  wordIndex: number,
  newText: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const db = await getDatabase();

    // Get transcript for this project
    const transcript = await getTranscriptByProjectId(projectId);
    if (!transcript) {
      return { success: false, error: 'No transcript found for this project' };
    }

    // Parse the raw_json to update word data
    let transcriptData;
    try {
      transcriptData = JSON.parse(transcript.raw_json);
    } catch (parseError) {
      return { success: false, error: 'Failed to parse transcript data' };
    }

    // Find and update the word in different possible formats
    let wordUpdated = false;

    // Format 1: Direct words array
    if (transcriptData.words && Array.isArray(transcriptData.words)) {
      if (wordIndex < transcriptData.words.length) {
        const oldText = transcriptData.words[wordIndex].word;
        transcriptData.words[wordIndex].word = newText;
        wordUpdated = true;

        console.log(`[Database] Updated word ${wordIndex}: "${oldText}" -> "${newText}"`);
      }
    }

    // Format 2: Words in segments
    if (!wordUpdated && transcriptData.segments && Array.isArray(transcriptData.segments)) {
      let currentWordIndex = 0;
      for (const segment of transcriptData.segments) {
        if (segment.words && Array.isArray(segment.words)) {
          if (wordIndex < currentWordIndex + segment.words.length) {
            const segmentWordIndex = wordIndex - currentWordIndex;
            const oldText = segment.words[segmentWordIndex].word;
            segment.words[segmentWordIndex].word = newText;
            wordUpdated = true;

            console.log(`[Database] Updated word in segment: "${oldText}" -> "${newText}"`);
            break;
          }
          currentWordIndex += segment.words.length;
        }
      }
    }

    if (!wordUpdated) {
      return { success: false, error: 'Word not found in transcript' };
    }

    // Update the main text field by reconstructing from words
    let fullText = '';
    if (transcriptData.words && Array.isArray(transcriptData.words)) {
      fullText = transcriptData.words.map((w: any) => w.word).join(' ');
    } else if (transcriptData.segments && Array.isArray(transcriptData.segments)) {
      fullText = transcriptData.segments
        .flatMap((seg: any) => seg.words || [])
        .map((w: any) => w.word)
        .join(' ');
    }

    // Update the transcript in the database
    await db.execute('UPDATE transcripts SET raw_json = ?, text = ?, updated_at = ? WHERE id = ?', [
      JSON.stringify(transcriptData),
      fullText,
      timestamp(),
      transcript.id,
    ]);

    // Update all clip segments that use this word
    await updateClipSegmentsWithWordChange(projectId, wordIndex, newText);

    return { success: true };
  } catch (error) {
    console.error('[Database] Failed to update transcript word:', error);
    return { success: false, error: 'Database update failed' };
  }
}

// Update clip segments that contain the changed word
async function updateClipSegmentsWithWordChange(
  projectId: string,
  wordIndex: number,
  newText: string
): Promise<void> {
  try {
    const db = await getDatabase();

    // Get all clips for this project with their segments
    const clips = await db.execute(
      `
      SELECT
        c.id as clip_id,
        cv.id as version_id,
        cs.segment_index,
        cs.transcript,
        cs.start_time,
        cs.end_time
      FROM clips c
      JOIN clip_versions cv ON c.id = cv.clip_id
      LEFT JOIN clip_segments cs ON cv.id = cs.clip_version_id
      WHERE c.project_id = ?
      ORDER BY c.id, cv.version_number, cs.segment_index
    `,
      [projectId]
    );

    const transcript = await getTranscriptByProjectId(projectId);
    if (!transcript) return;

    let transcriptData;
    try {
      transcriptData = JSON.parse(transcript.raw_json);
    } catch {
      return;
    }

    // Get all words to find timing info
    let allWords: any[] = [];
    if (transcriptData.words && Array.isArray(transcriptData.words)) {
      allWords = transcriptData.words;
    } else if (transcriptData.segments && Array.isArray(transcriptData.segments)) {
      allWords = transcriptData.segments.flatMap((seg: any) => seg.words || []);
    }

    if (wordIndex >= allWords.length) return;

    const changedWord = allWords[wordIndex];
    const wordStartTime = changedWord.start;
    const wordEndTime = changedWord.end;

    // Update each segment that contains this word
    for (const row of clips as unknown as any[]) {
      if (!row.transcript) continue;

      // Check if this segment's time range contains the changed word
      if (row.start_time <= wordEndTime && row.end_time >= wordStartTime) {
        let segmentTranscriptData;
        try {
          segmentTranscriptData = JSON.parse(row.transcript);
        } catch {
          continue;
        }

        let segmentUpdated = false;

        // Update words in segment transcript
        if (segmentTranscriptData.words && Array.isArray(segmentTranscriptData.words)) {
          for (let i = 0; i < segmentTranscriptData.words.length; i++) {
            const segmentWord = segmentTranscriptData.words[i];
            // Match by timing since word indexes may differ
            if (
              Math.abs(segmentWord.start - wordStartTime) < 0.1 &&
              Math.abs(segmentWord.end - wordEndTime) < 0.1
            ) {
              segmentTranscriptData.words[i].word = newText;
              segmentUpdated = true;
              console.log(
                `[Database] Updated word in clip segment ${row.segment_index}: "${segmentWord.word}" -> "${newText}"`
              );
            }
          }
        }

        if (segmentUpdated) {
          // Update the segment transcript
          await db.execute(
            'UPDATE clip_segments SET transcript = ? WHERE clip_version_id = ? AND segment_index = ?',
            [JSON.stringify(segmentTranscriptData), row.version_id, row.segment_index]
          );
        }
      }
    }
  } catch (error) {
    console.error('[Database] Failed to update clip segments:', error);
  }
}

// ===== CLIP BUILD MANAGEMENT FUNCTIONS =====

// Update clip build status
export async function updateClipBuildStatus(
  clipId: string,
  buildStatus: 'pending' | 'building' | 'completed' | 'failed',
  additionalFields?: {
    progress?: number;
    error?: string;
    builtFilePath?: string;
    builtThumbnailPath?: string;
    builtFileSize?: number;
    builtDuration?: number;
  }
): Promise<void> {
  try {
    const db = await getDatabase();

    // Prepare the base update query
    let query = 'UPDATE clips SET build_status = ?, updated_at = ?';
    let params: any[] = [buildStatus, timestamp()];

    // Add optional fields if provided
    if (additionalFields?.progress !== undefined) {
      query += ', build_progress = ?';
      params.push(additionalFields.progress);
    }

    if (additionalFields?.error !== undefined) {
      query += ', build_error = ?';
      params.push(additionalFields.error);
    }

    if (additionalFields?.builtFilePath !== undefined) {
      query += ', built_file_path = ?';
      params.push(additionalFields.builtFilePath);

      // Also update the main file_path field when build is completed
      if (buildStatus === 'completed') {
        query += ', file_path = ?';
        params.push(additionalFields.builtFilePath);
      }
    }

    if (additionalFields?.builtThumbnailPath !== undefined) {
      query += ', built_thumbnail_path = ?';
      params.push(additionalFields.builtThumbnailPath);
    }

    if (additionalFields?.builtFileSize !== undefined) {
      query += ', built_file_size = ?';
      params.push(additionalFields.builtFileSize);
    }

    if (additionalFields?.builtDuration !== undefined) {
      query += ', built_duration = ?';
      params.push(additionalFields.builtDuration);
    }

    // Add completed timestamp if status is completed
    if (buildStatus === 'completed') {
      query += ', built_at = ?';
      params.push(timestamp());

      // Also update the main status field to 'generated' when build is completed
      query += ', status = ?';
      params.push('generated');
    }

    // Add WHERE clause
    query += ' WHERE id = ?';
    params.push(clipId);

    await db.execute(query, params);

    // If build is completed and we have a thumbnail path, also create a thumbnail record
    if (buildStatus === 'completed' && additionalFields?.builtThumbnailPath) {
      try {
        await createThumbnail(clipId, additionalFields.builtThumbnailPath);
        console.log(
          `[Database] Created thumbnail record for clip ${clipId}: ${additionalFields.builtThumbnailPath}`
        );
      } catch (thumbnailError) {
        console.warn(
          `[Database] Failed to create thumbnail record for clip ${clipId}:`,
          thumbnailError
        );
        // Don't fail the whole operation if thumbnail creation fails
      }
    }

    console.log(`[Database] Updated clip build status for ${clipId}: ${buildStatus}`);
  } catch (error) {
    console.error('[Database] Failed to update clip build status:', error);
    throw error;
  }
}

// Get clips with their build status
export async function getClipsWithBuildStatus(projectId: string): Promise<ClipWithVersion[]> {
  try {
    const db = await getDatabase();

    const clips = await db.select<any[]>(
      `
      SELECT
        c.*,
        cv.id as current_version_id,
        cv.name as current_version_name,
        cv.description as current_version_description,
        cv.start_time as current_version_start_time,
        cv.end_time as current_version_end_time,
        cv.confidence_score as current_version_confidence_score,
        cv.relevance_score as current_version_relevance_score,
        cv.detection_reason as current_version_detection_reason,
        cv.tags as current_version_tags,
        cv.change_type as current_version_change_type,
        cv.created_at as current_version_created_at,
        cds.id as detection_session_id,
        cds.created_at as session_created_at,
        cds.run_color as session_run_color,
        cds.prompt as session_prompt,
        CASE
          WHEN cds.id IS NOT NULL THEN (
            SELECT COUNT(*) + 1 FROM clip_detection_sessions s2
            WHERE s2.project_id = ? AND s2.created_at < cds.created_at
          )
          ELSE NULL
        END as run_number,
        ROW_NUMBER() OVER (PARTITION BY c.id ORDER BY cv.version_number DESC) as rn
      FROM clips c
      LEFT JOIN clip_versions cv ON c.id = cv.clip_id
      LEFT JOIN clip_detection_sessions cds ON cv.session_id = cds.id
      WHERE c.project_id = ?
      ORDER BY cds.created_at DESC, c.created_at DESC
    `,
      [projectId, projectId]
    );

    // Filter to only include current versions (rn = 1) and convert to ClipWithVersion
    const clipsWithVersion: ClipWithVersion[] = clips
      .filter((row: any) => row.rn === 1)
      .map((row: any) => {
        return {
          id: row.id,
          project_id: row.project_id,
          name: row.name,
          file_path: row.file_path,
          duration: row.duration,
          start_time: row.start_time,
          end_time: row.end_time,
          order_index: row.order_index,
          intro_id: row.intro_id,
          outro_id: row.outro_id,
          status: row.status,
          build_status: row.build_status,
          built_file_path: row.built_file_path,
          built_thumbnail_path: row.built_thumbnail_path,
          build_progress: row.build_progress,
          build_error: row.build_error,
          built_at: row.built_at,
          built_file_size: row.built_file_size,
          built_duration: row.built_duration,
          created_at: row.created_at,
          updated_at: row.updated_at,
          current_version_id: row.current_version_id,
          detection_session_id: row.detection_session_id,
          session_created_at: row.session_created_at,
          session_run_color: row.session_run_color,
          session_prompt: row.session_prompt,
          run_number: row.run_number, // Calculated in SQL query
          current_version_name: row.current_version_name,
          current_version_description: row.current_version_description,
          current_version_start_time: row.current_version_start_time,
          current_version_end_time: row.current_version_end_time,
          current_version_confidence_score: row.current_version_confidence_score,
          current_version_relevance_score: row.current_version_relevance_score,
          current_version_detection_reason: row.current_version_detection_reason,
          current_version_tags: row.current_version_tags,
          current_version_change_type: row.current_version_change_type,
          current_version_created_at: row.current_version_created_at,
          current_version_segments: [], // Will be loaded separately
        };
      });

    // Load segments for each clip
    for (const clip of clipsWithVersion) {
      if (clip.current_version_id) {
        const segments = await db.select<any[]>(
          `
          SELECT id, clip_version_id, segment_index, start_time, end_time,
                 duration, transcript, created_at
          FROM clip_segments
          WHERE clip_version_id = ?
          ORDER BY segment_index
        `,
          [clip.current_version_id]
        );

        clip.current_version_segments = segments.map((seg: any) => ({
          id: seg.id,
          clip_version_id: seg.clip_version_id,
          segment_index: seg.segment_index,
          start_time: seg.start_time,
          end_time: seg.end_time,
          duration: seg.duration,
          transcript: seg.transcript,
          created_at: seg.created_at,
        }));
      }
    }

    return clipsWithVersion;
  } catch (error) {
    console.error('[Database] Failed to get clips with build status:', error);
    throw error;
  }
}

// Get a single clip with its build status
export async function getClipWithBuildStatus(clipId: string): Promise<Clip | null> {
  try {
    const db = await getDatabase();

    const clips = await db.select<any[]>(
      `
      SELECT
        c.*,
        cv.id as current_version_id,
        cds.created_at as session_created_at,
        cds.run_color as session_run_color,
        cds.prompt as session_prompt
      FROM clips c
      LEFT JOIN clip_versions cv ON c.id = cv.clip_id
      LEFT JOIN clip_detection_sessions cds ON cv.session_id = cds.id
      WHERE c.id = ?
      ORDER BY cv.version_number DESC
      LIMIT 1
    `,
      [clipId]
    );

    if (clips.length === 0) {
      return null;
    }

    const row = clips[0];

    return {
      id: row.id,
      project_id: row.project_id,
      name: row.name,
      file_path: row.file_path,
      duration: row.duration,
      start_time: row.start_time,
      end_time: row.end_time,
      order_index: row.order_index,
      intro_id: row.intro_id,
      outro_id: row.outro_id,
      status: row.status,
      build_status: row.build_status,
      built_file_path: row.built_file_path,
      built_thumbnail_path: row.built_thumbnail_path,
      build_progress: row.build_progress,
      build_error: row.build_error,
      built_at: row.built_at,
      built_file_size: row.built_file_size,
      built_duration: row.built_duration,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  } catch (error) {
    console.error('[Database] Failed to get clip with build status:', error);
    throw error;
  }
}

// Get clips that are currently building
export async function getClipsCurrentlyBuilding(): Promise<Clip[]> {
  try {
    const db = await getDatabase();

    const clips = await db.select<Clip[]>(`
      SELECT * FROM clips
      WHERE build_status = 'building'
      ORDER BY updated_at DESC
    `);

    return clips;
  } catch (error) {
    console.error('[Database] Failed to get building clips:', error);
    throw error;
  }
}

// Cancel clip build (set status back to pending)
export async function cancelClipBuild(clipId: string): Promise<void> {
  try {
    await updateClipBuildStatus(clipId, 'pending', {
      error: undefined,
      progress: 0,
    });

    console.log(`[Database] Cancelled build for clip ${clipId}`);
  } catch (error) {
    console.error('[Database] Failed to cancel clip build:', error);
    throw error;
  }
}
