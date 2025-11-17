import { getDatabase, timestamp, generateId } from './core';
import type { Clip, ClipWithVersion } from './types';

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
        const thumbnailId = generateId();
        await db.execute(
          'INSERT INTO thumbnails (id, clip_id, file_path, width, height, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          [thumbnailId, clipId, additionalFields.builtThumbnailPath, null, null, timestamp()]
        );
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
