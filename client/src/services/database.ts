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

// Re-export intro/outro functions
export {
  createIntroOutro,
  getAllIntroOutros,
  updateIntroOutroCompletion,
  updateIntroOutroThumbnailStatus,
  deleteIntroOutro,
} from './database/intro-outros';

// Re-export thumbnail functions
export { createThumbnail, getThumbnailByClipId } from './database/thumbnails';

// Re-export clip detection session functions
export {
  createClipDetectionSession,
  getClipDetectionSession,
  getClipDetectionSessionsByProjectId,
  updateClipDetectionSession,
  deleteClipDetectionSession,
} from './database/clip-detection-sessions';

// Re-export clip version functions
export {
  createClipVersion,
  getClipVersion,
  getClipVersionsByClipId,
  getClipVersionsBySessionId,
  getCurrentClipVersion,
  restoreClipVersion,
} from './database/clip-versions';

// Re-export clip segment functions
export {
  getAdjacentClipSegments,
  getClipSegmentsByClipId,
  getClipSegmentsByVersionId,
  updateClipSegment,
  splitClipSegment,
  deleteClipSegment,
  realignClipSegment,
} from './database/clip-segments';

// Re-export clip build management functions
export {
  updateClipBuildStatus,
  getClipsWithBuildStatus,
  getClipWithBuildStatus,
  getClipsCurrentlyBuilding,
  cancelClipBuild,
} from './database/clip-build';

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
import { createClipVersion } from './database/clip-versions';
import { createClipDetectionSession } from './database/clip-detection-sessions';
import type { Clip, ClipSegment, ClipWithVersion } from './database/types';

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
