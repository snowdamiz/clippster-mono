import { getDatabase, timestamp, generateId, getCurrentUserId } from './core';
import type { Transcript, TranscriptSegment } from './types';

// Transcript queries
export async function createTranscript(
  rawVideoId: string,
  rawJson: string,
  text: string,
  language?: string,
  duration?: number
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  await db.execute(
    'INSERT INTO transcripts (id, raw_video_id, raw_json, text, language, duration, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, rawVideoId, rawJson, text, language || null, duration || null, now, now]
  );

  return id;
}

export async function getTranscriptByRawVideoId(rawVideoId: string): Promise<Transcript | null> {
  const db = await getDatabase();
  const result = await db.select<Transcript[]>(
    'SELECT * FROM transcripts WHERE raw_video_id = ? ORDER BY created_at DESC, id ASC',
    [rawVideoId]
  );
  return result[0] || null;
}

export async function getTranscriptById(transcriptId: string): Promise<Transcript | null> {
  const db = await getDatabase();
  const result = await db.select<Transcript[]>('SELECT * FROM transcripts WHERE id = ? LIMIT 1', [
    transcriptId,
  ]);
  return result[0] || null;
}

export async function deleteTranscriptsByRawVideoId(rawVideoId: string): Promise<void> {
  const db = await getDatabase();
  const transcripts = await db.select<{ id: string }[]>(
    'SELECT id FROM transcripts WHERE raw_video_id = ?',
    [rawVideoId]
  );

  for (const transcript of transcripts) {
    await db.execute('DELETE FROM transcript_segments WHERE transcript_id = ?', [transcript.id]);
  }

  await db.execute('DELETE FROM transcripts WHERE raw_video_id = ?', [rawVideoId]);
}

export async function getTranscriptByProjectId(projectId: string): Promise<Transcript | null> {
  const db = await getDatabase();
  const result = await db.select<Transcript[]>(
    `SELECT t.* FROM transcripts t
     JOIN raw_videos rv ON t.raw_video_id = rv.id
     WHERE rv.project_id = ?
        OR rv.original_project_id = ?
        OR rv.project_id = (SELECT parent_id FROM projects WHERE id = ?)
        OR rv.original_project_id = (SELECT parent_id FROM projects WHERE id = ?)
     ORDER BY
       CASE
         WHEN (rv.is_segment IS NULL OR rv.is_segment = 0 OR rv.is_segment = 'false')
          AND rv.source_clip_id IS NULL
          AND rv.original_project_id IS NULL
         THEN 0
         ELSE 1
       END ASC,
       COALESCE(t.duration, rv.duration, 0) DESC,
       LENGTH(COALESCE(t.text, '')) DESC,
       t.created_at DESC,
       t.id ASC`,
    [projectId, projectId, projectId, projectId]
  );
  return result[0] || null;
}

export interface TranscriptWithRawVideo {
  transcript: Transcript;
  rawVideo: {
    id: string;
    project_id: string | null;
    file_path: string;
    duration: number | null;
    source_clip_id: string | null;
    original_project_id: string | null;
    is_segment: boolean | number | string | null;
  };
}

export async function getTranscriptsWithRawVideosByProjectId(
  projectId: string
): Promise<TranscriptWithRawVideo[]> {
  const db = await getDatabase();
  const rows = await db.select<Array<Transcript & {
    rv_id: string;
    rv_project_id: string | null;
    rv_file_path: string;
    rv_duration: number | null;
    rv_source_clip_id: string | null;
    rv_original_project_id: string | null;
    rv_is_segment: boolean | number | string | null;
  }>>(
    `SELECT
       t.*,
       rv.id as rv_id,
       rv.project_id as rv_project_id,
       rv.file_path as rv_file_path,
       rv.duration as rv_duration,
       rv.source_clip_id as rv_source_clip_id,
       rv.original_project_id as rv_original_project_id,
       rv.is_segment as rv_is_segment
     FROM transcripts t
     JOIN raw_videos rv ON t.raw_video_id = rv.id
     WHERE rv.project_id = ?
        OR rv.original_project_id = ?
        OR rv.project_id = (SELECT parent_id FROM projects WHERE id = ?)
        OR rv.original_project_id = (SELECT parent_id FROM projects WHERE id = ?)
     ORDER BY
       t.created_at DESC,
       COALESCE(t.duration, rv.duration, 0) DESC,
       t.id ASC`,
    [projectId, projectId, projectId, projectId]
  );

  return rows.map((row) => ({
    transcript: {
      id: row.id,
      raw_video_id: row.raw_video_id,
      raw_json: row.raw_json,
      text: row.text,
      language: row.language,
      duration: row.duration,
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
    rawVideo: {
      id: row.rv_id,
      project_id: row.rv_project_id,
      file_path: row.rv_file_path,
      duration: row.rv_duration,
      source_clip_id: row.rv_source_clip_id,
      original_project_id: row.rv_original_project_id,
      is_segment: row.rv_is_segment,
    },
  }));
}

// Transcript segment queries
export async function createTranscriptSegment(
  transcriptId: string,
  startTime: number,
  endTime: number,
  text: string,
  segmentIndex: number,
  clipId?: string
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  await db.execute(
    'INSERT INTO transcript_segments (id, transcript_id, clip_id, start_time, end_time, text, segment_index, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, transcriptId, clipId || null, startTime, endTime, text, segmentIndex, now]
  );

  return id;
}

export async function getTranscriptSegments(transcriptId: string): Promise<TranscriptSegment[]> {
  const db = await getDatabase();
  return await db.select<TranscriptSegment[]>(
    'SELECT * FROM transcript_segments WHERE transcript_id = ? ORDER BY segment_index',
    [transcriptId]
  );
}

export async function getTranscriptWithSegmentsByProjectId(
  projectId: string
): Promise<{ transcript: Transcript | null; segments: TranscriptSegment[] }> {
  const transcript = await getTranscriptByProjectId(projectId);
  const segments = transcript ? await getTranscriptSegments(transcript.id) : [];
  return { transcript, segments };
}

// Search queries
export async function searchTranscripts(query: string): Promise<any[]> {
  const db = await getDatabase();
  const userId = getCurrentUserId();

  if (userId === null) {
    return await db.select<any[]>(
      `SELECT DISTINCT p.*
       FROM projects p
       JOIN transcripts t ON t.project_id = p.id
       JOIN transcripts_fts fts ON fts.rowid = t.rowid
       WHERE transcripts_fts MATCH ? AND p.user_id IS NULL
       ORDER BY p.updated_at DESC`,
      [query]
    );
  }

  return await db.select<any[]>(
    `SELECT DISTINCT p.*
     FROM projects p
     JOIN transcripts t ON t.project_id = p.id
     JOIN transcripts_fts fts ON fts.rowid = t.rowid
     WHERE transcripts_fts MATCH ? AND (p.user_id = ? OR p.user_id IS NULL)
     ORDER BY p.updated_at DESC`,
    [query, userId]
  );
}

export async function searchSegments(query: string): Promise<TranscriptSegment[]> {
  const db = await getDatabase();
  const userId = getCurrentUserId();

  if (userId === null) {
    return await db.select<TranscriptSegment[]>(
      `SELECT ts.*
       FROM transcript_segments ts
       JOIN transcripts t ON ts.transcript_id = t.id
       JOIN raw_videos rv ON t.raw_video_id = rv.id
       JOIN transcript_segments_fts fts ON fts.rowid = ts.rowid
       WHERE transcript_segments_fts MATCH ? AND rv.user_id IS NULL
       ORDER BY ts.start_time`,
      [query]
    );
  }

  return await db.select<TranscriptSegment[]>(
    `SELECT ts.*
     FROM transcript_segments ts
     JOIN transcripts t ON ts.transcript_id = t.id
     JOIN raw_videos rv ON t.raw_video_id = rv.id
     JOIN transcript_segments_fts fts ON fts.rowid = ts.rowid
     WHERE transcript_segments_fts MATCH ? AND (rv.user_id = ? OR rv.user_id IS NULL)
     ORDER BY ts.start_time`,
    [query, userId]
  );
}

export async function searchTranscriptSegmentsByClipIds(
  query: string,
  clipIds: string[]
): Promise<string[]> {
  const db = await getDatabase();

  if (clipIds.length === 0) return [];

  // Search clip_segments.transcript for matching text
  // Clips store their transcript data in clip_segments, linked via clip_versions
  const placeholders = clipIds.map(() => '?').join(',');
  const searchPattern = `%${query}%`;

  const result = await db.select<{ clip_id: string }[]>(
    `SELECT DISTINCT cv.clip_id
     FROM clip_versions cv
     JOIN clip_segments cs ON cs.clip_version_id = cv.id
     WHERE cv.clip_id IN (${placeholders})
       AND cs.transcript IS NOT NULL
       AND LOWER(cs.transcript) LIKE LOWER(?)
     ORDER BY cv.clip_id`,
    [...clipIds, searchPattern]
  );

  return result.map((r) => r.clip_id);
}

export async function hasTranscriptForProject(projectId: string): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.select<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM transcripts t
     JOIN raw_videos rv ON t.raw_video_id = rv.id
     WHERE rv.project_id = ?
        OR rv.original_project_id = ?
        OR rv.project_id = (SELECT parent_id FROM projects WHERE id = ?)
        OR rv.original_project_id = (SELECT parent_id FROM projects WHERE id = ?)`,
    [projectId, projectId, projectId, projectId]
  );
  return (result[0]?.cnt || 0) > 0;
}

export async function getClipIdsWithTranscripts(clipIds: string[]): Promise<string[]> {
  const db = await getDatabase();

  if (clipIds.length === 0) return [];

  // Return clip IDs that have clip_segments with non-null transcript data
  // Clips store their transcript in clip_segments.transcript, linked via clip_versions
  const placeholders = clipIds.map(() => '?').join(',');

  const result = await db.select<{ clip_id: string }[]>(
    `SELECT DISTINCT cv.clip_id
     FROM clip_versions cv
     JOIN clip_segments cs ON cs.clip_version_id = cv.id
     WHERE cv.clip_id IN (${placeholders})
       AND cs.transcript IS NOT NULL
       AND cs.transcript != ''
     ORDER BY cv.clip_id`,
    [...clipIds]
  );

  return result.map((r) => r.clip_id);
}
