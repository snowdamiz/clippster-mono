import { getDatabase, generateId, timestamp } from './core';
import { createClipVersion } from './clip-versions';
import { createClipDetectionSession } from './clip-detection-sessions';
import {
  getTranscriptByRawVideoId,
  createTranscript,
  createTranscriptSegment,
} from './transcripts';
import { getRawVideosByProjectId } from './raw-videos';
import type { ClipWithVersion, ClipSegment } from './types';

// Manual migration fallback function - kept here as it's specifically for clip versioning
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
