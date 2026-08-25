import { getDatabase, generateId, timestamp, getCurrentUserId } from './core';
import { createClipVersion } from './clip-versions';
import { createClipDetectionSession } from './clip-detection-sessions';
import {
  getTranscriptByRawVideoId,
  createTranscript,
  createTranscriptSegment,
} from './transcripts';
import { getRawVideosByProjectId } from './raw-videos';
import { getProject } from './projects';
import { getProjectVodPresetConfig } from './vod-presets';
import { updateClipFullSubtitleSettings, updateClipSubtitleSettings } from './clips';
import type { ClipWithVersion, ClipSegment, ClipWithVersionAndSegment } from './types';
import type { SubtitleSettings } from '@/types';
import { invoke } from '@tauri-apps/api/core';

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
          virality_score REAL,
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
    } else {
      // Check for missing columns in existing table
      const pragmaResult = await db.select<{ name: string }[]>('PRAGMA table_info(clip_versions)');
      const columns = pragmaResult.map((col) => col.name);

      if (!columns.includes('virality_score')) {
        await db.execute('ALTER TABLE clip_versions ADD COLUMN virality_score REAL');
      }
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
    viralityScore?: number;
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
  filePath?: string,
  thumbnailPath?: string
): Promise<string> {
  const db = await getDatabase();
  const clipId = generateId();
  const now = timestamp();
  const userId = getCurrentUserId();

  // Look up the project name to store it on the clip
  // This preserves the project name even if the project is later deleted
  const project = await getProject(projectId);
  const projectName = project?.name || null;

  // Create the clip record first (thumbnail stored in built_thumbnail_path)
  await db.execute(
    `INSERT INTO clips (
      id, project_id, project_name, name, file_path, built_thumbnail_path, start_time, end_time,
      detection_session_id, user_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      clipId,
      projectId,
      projectName,
      clipData.name,
      filePath || '',
      thumbnailPath || null,
      clipData.startTime,
      clipData.endTime,
      sessionId,
      userId,
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

/**
 * After detection, persist subtitle choice onto the clip row. When the project has VOD preset
 * `subtitleDefaults` (e.g. from creator layout), merge the full SubtitlePropertiesPanel snapshot
 * with the preset style selected in the detection dialog.
 */
async function getProjectOrParentVodPresetConfig(projectId: string) {
  const vodPreset = await getProjectVodPresetConfig(projectId);
  if (vodPreset) return vodPreset;

  const project = await getProject(projectId);
  if (!project?.parent_id) return null;
  return getProjectVodPresetConfig(project.parent_id);
}

async function applyDetectionSubtitleChoiceToClip(
  clipId: string,
  projectId: string,
  detectionSubtitle: { enabled: boolean; presetId: string } | null | undefined
): Promise<void> {
  if (!detectionSubtitle?.enabled || !detectionSubtitle.presetId) return;

  try {
    const vodPreset = await getProjectOrParentVodPresetConfig(projectId);
    const seeded = vodPreset?.subtitleDefaults as SubtitleSettings | null | undefined;

    if (seeded && typeof seeded === 'object') {
      const merged: SubtitleSettings = {
        ...JSON.parse(JSON.stringify(seeded)),
        enabled: true,
        selectedPresetId: detectionSubtitle.presetId || seeded.selectedPresetId || null,
      };

      await updateClipFullSubtitleSettings(clipId, merged);
      // Do not mirror Y/X/width into subtitle_position_* columns here. Those columns mean "user
      // dragged in workspace" for layout merge; copying detection defaults blocked creator layout.
      // Position lives on subtitle_settings JSON (merged above).
    } else {
      await updateClipSubtitleSettings(clipId, true, detectionSubtitle.presetId);
    }
  } catch (e) {
    console.warn('[clip-detection] applyDetectionSubtitleChoiceToClip failed:', e);
  }
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
      cv.virality_score as current_version_virality_score,
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
       WHERE s2.project_id = c.project_id AND s2.created_at < s.created_at) as run_number
     FROM clips c
     LEFT JOIN clip_versions cv ON c.current_version_id = cv.id
     LEFT JOIN clip_detection_sessions s ON c.detection_session_id = s.id
     WHERE c.project_id = ?
     ORDER BY COALESCE(cv.start_time, c.start_time) ASC`,
    [projectId]
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
            virality_score: clip.current_version_virality_score,
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

/**
 * Get all clips for a parent project and all its child projects (segments).
 * For standalone projects (no children), returns clips for the project itself.
 * Returns clips with segment information so they can be displayed at the folder level.
 */
export async function getClipsWithVersionsForProjectAndChildren(
  parentProjectId: string
): Promise<ClipWithVersionAndSegment[]> {
  const db = await getDatabase();

  // Get all child project IDs (segments) for this parent
  const childProjects = await db.select<{ id: string; name: string }[]>(
    `SELECT id, name FROM projects WHERE parent_id = ? ORDER BY created_at ASC`,
    [parentProjectId]
  );

  // Build list of project IDs to query
  let projectIds: string[];
  let projectNameMap: Map<string, string>;

  if (childProjects.length === 0) {
    // Standalone project - query clips for the project itself
    const parentProject = await db.select<{ id: string; name: string }[]>(
      `SELECT id, name FROM projects WHERE id = ?`,
      [parentProjectId]
    );
    if (parentProject.length === 0) {
      return [];
    }
    projectIds = [parentProjectId];
    projectNameMap = new Map([[parentProjectId, parentProject[0].name]]);
  } else {
    // Parent with children - query clips for all children
    projectIds = childProjects.map((p) => p.id);
    projectNameMap = new Map(childProjects.map((p) => [p.id, p.name]));
  }

  // Create placeholders for IN clause
  const placeholders = projectIds.map(() => '?').join(', ');

  // Query clips for all child projects
  const clips = await db.select<any[]>(
    `SELECT
      c.*,
      cv.id as current_version_id,
      cv.name as current_version_name,
      cv.description as current_version_description,
      cv.start_time as current_version_start_time,
      cv.end_time as current_version_end_time,
      cv.confidence_score as current_version_confidence_score,
      cv.virality_score as current_version_virality_score,
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
       WHERE s2.project_id = c.project_id AND s2.created_at < s.created_at) as run_number
     FROM clips c
     LEFT JOIN clip_versions cv ON c.current_version_id = cv.id
     LEFT JOIN clip_detection_sessions s ON c.detection_session_id = s.id
     WHERE c.project_id IN (${placeholders})
     ORDER BY COALESCE(cv.virality_score, 0) DESC, COALESCE(cv.start_time, c.start_time) ASC`,
    projectIds
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

  // Load builds for each clip
  for (const clip of clips) {
    const builds = await db.select<any[]>(
      `SELECT * FROM clip_builds 
       WHERE clip_id = ? 
       ORDER BY build_number DESC`,
      [clip.id]
    );
    clip.builds = builds.map((build) => ({
      ...build,
      include_subtitles: Boolean(build.include_subtitles),
    }));
  }

  // Map clips with segment info
  return clips.map((clip) => {
    const mapped = {
      ...clip,
      segment_id: clip.project_id,
      segment_name: projectNameMap.get(clip.project_id) || 'Unknown Segment',
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
            virality_score: clip.current_version_virality_score,
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
  }) as ClipWithVersionAndSegment[];
}

export async function getClipsByDetectionSession(sessionId: string): Promise<ClipWithVersion[]> {
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
      cv.virality_score as current_version_virality_score,
      cv.relevance_score as current_version_relevance_score,
      cv.detection_reason as current_version_detection_reason,
      cv.tags as current_version_tags,
      cv.change_type as current_version_change_type,
      cv.created_at as current_version_created_at,
      s.created_at as session_created_at,
      s.run_color as session_run_color,
      s.prompt as session_prompt,
      (SELECT COUNT(*) + 1 FROM clip_detection_sessions s2
       WHERE s2.project_id = s.project_id AND s2.created_at < s.created_at) as run_number
     FROM clips c
     LEFT JOIN clip_versions cv ON c.current_version_id = cv.id
     LEFT JOIN clip_detection_sessions s ON c.detection_session_id = s.id
     WHERE c.detection_session_id = ?
     ORDER BY COALESCE(cv.start_time, c.start_time) ASC`,
    [sessionId]
  );

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

  return clips as ClipWithVersion[];
}

export async function persistClipDetectionResults(
  projectId: string,
  prompt: string,
  detectionResults: {
    clips?: any[];
    jobId?: string;
    transcript?: any;
    validation?: any;
  },
  metadata?: {
    processingTimeMs?: number;
    detectionModel?: string;
    serverResponseId?: string | null;
    enhanced?: boolean;
    videoFilePath?: string;
    rawVideoId?: string;
  },
  subtitleSettings?: { enabled: boolean; presetId: string } | null
): Promise<string> {
  const startTime = Date.now();
  
  console.log('[Database] persistClipDetectionResults called with:', {
    projectId,
    detectionResultsKeys: Object.keys(detectionResults),
    clipsType: typeof detectionResults.clips,
    clipsIsArray: Array.isArray(detectionResults.clips),
    clipsLength: Array.isArray(detectionResults.clips) ? detectionResults.clips.length : 'N/A',
  });
  
  // Check for nested structure in clips property
  if (
    detectionResults.clips &&
    typeof detectionResults.clips === 'object' &&
    (detectionResults.clips as any).clips
  ) {
    console.log('[Database] Found nested clips structure, unwrapping...');
    (detectionResults as any).clips = (detectionResults.clips as any).clips;
  }

  // Double-check if clips might be in a different property
  if (!detectionResults.clips || (detectionResults.clips as any[]).length === 0) {
    console.log('[Database] No clips found in clips property, searching other properties...');
    for (const key of Object.keys(detectionResults)) {
      const value = detectionResults[key as keyof typeof detectionResults];
      if (Array.isArray(value) && value.length > 0) {
        // Check if this looks like clips data
        if ((value[0] as any)?.id || (value[0] as any)?.title || (value[0] as any)?.segments) {
          console.log(`[Database] Found clips in property: ${key}`);
          (detectionResults as any).clips = value;
          break;
        }
      }
    }
  }
  
  console.log('[Database] After extraction - clips:', {
    hasClips: !!detectionResults.clips,
    isArray: Array.isArray(detectionResults.clips),
    length: Array.isArray(detectionResults.clips) ? detectionResults.clips.length : 'N/A',
  });

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
        let shouldStoreTranscriptSegments = false;

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

            const existingDuration = Number(existingTranscript.duration) || 0;
            const incomingDuration = Number(duration) || 0;
            const existingTextLength = existingTranscript.text?.length || 0;
            const incomingTextLength = transcriptText.length;
            const incomingLooksPartial =
              (existingDuration > 0 && incomingDuration > 0 && incomingDuration < existingDuration * 0.8) ||
              (existingTextLength > 0 && incomingTextLength > 0 && incomingTextLength < existingTextLength * 0.8);

            if (incomingLooksPartial) {
              console.warn('[Database] Skipping transcript overwrite because incoming transcript is shorter than the existing VOD transcript', {
                transcriptId,
                existingDuration,
                incomingDuration,
                existingTextLength,
                incomingTextLength,
              });
            } else {
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
              shouldStoreTranscriptSegments = true;
            }
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
          shouldStoreTranscriptSegments = true;
        }

        // Store transcript segments if available (only for fresh transcriptions)
        if (
          shouldStoreTranscriptSegments &&
          detectionResults.transcript.segments &&
          Array.isArray(detectionResults.transcript.segments)
        ) {
          for (let i = 0; i < detectionResults.transcript.segments.length; i++) {
            const segment = detectionResults.transcript.segments[i];
            await createTranscriptSegment(
              transcriptId,
              segment.start_time || segment.start || 0,
              segment.end_time || segment.end || 0,
              segment.text || '',
              i
            );
          }
        } else if ((detectionResults as any).processing_info?.used_cached_transcript) {
          console.log('[Database] Using cached transcript segments, no segment storage needed');
        }

        // Fire transcript-updated event to notify UI components
        console.log('[Database] Firing transcript-updated event for project:', projectId);
        setTimeout(() => {
          const refreshEvent = new CustomEvent('transcript-updated', {
            detail: { projectId: projectId },
          });
          document.dispatchEvent(refreshEvent);
        }, 300);
      }
    } catch (error) {
      console.error('[Database] Failed to store transcript:', error);
    }
  } else {
    console.log('[Database] No transcript data provided in detection results');
  }

  // Create detection session
  const sessionId = await createClipDetectionSession(projectId, prompt, {
    detectionModel: metadata?.detectionModel || 'claude-3.5-sonnet',
    serverResponseId: metadata?.serverResponseId ?? undefined,
    qualityScore: detectionResults.validation?.qualityScore,
    totalClipsDetected: detectionResults.clips?.length || 0,
    processingTimeMs: metadata?.processingTimeMs || Date.now() - startTime,
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
      viralityScore: clipData.viralityScore || clipData.virality_score || clipData.virality,
      relevanceScore: clipData.relevanceScore || clipData.relevance,
      detectionReason:
        clipData.reason || clipData.detectionReason || 'AI detected clip-worthy moment',
      tags: clipData.tags || clipData.keywords || [],
      segments: clipData.segments || [],
    };

    // Generate thumbnail at the midpoint of the clip
    let thumbnailPath: string | undefined;
    if (metadata?.videoFilePath && startTime !== undefined && endTime !== undefined) {
      try {
        const midpoint = startTime + (endTime - startTime) / 2;
        const clipId = generateId(); // Pre-generate ID for thumbnail filename
        thumbnailPath = await invoke<string>('generate_thumbnail_at_timestamp', {
          videoPath: metadata.videoFilePath,
          timestampSeconds: midpoint,
          outputFilename: `clip_${clipId}`,
        });
        console.log(
          `[Database] Generated thumbnail for clip ${i + 1} at ${midpoint}s:`,
          thumbnailPath
        );
      } catch (e) {
        console.warn(`[Database] Failed to generate thumbnail for clip ${i + 1}:`, e);
      }
    }

    try {
      const clipId = await createVersionedClip(
        projectId,
        sessionId,
        clipInfo,
        metadata?.videoFilePath,
        thumbnailPath
      );
      await applyDetectionSubtitleChoiceToClip(clipId, projectId, subtitleSettings);
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
