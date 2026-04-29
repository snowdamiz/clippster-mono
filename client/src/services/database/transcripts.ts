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

export async function getTranscriptByProjectId(projectId: string): Promise<Transcript | null> {
  const db = await getDatabase();
  const result = await db.select<Transcript[]>(
    `SELECT t.* FROM transcripts t
     JOIN raw_videos rv ON t.raw_video_id = rv.id
     WHERE rv.project_id = ?
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
    [projectId]
  );
  return result[0] || null;
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
     WHERE rv.project_id = ?`,
    [projectId]
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
