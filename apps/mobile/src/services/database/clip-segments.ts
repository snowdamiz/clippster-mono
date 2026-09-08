import type { ClipSegment, ClipVersion } from '@clippster/shared-types';
import { generateId, getDatabase, timestamp } from './index';

async function getCurrentVersionId(clipId: string): Promise<string> {
  const db = getDatabase();
  const clip = await db.getFirstAsync<{ current_version_id: string | null }>(
    'SELECT current_version_id FROM clips WHERE id = ?',
    [clipId],
  );
  if (clip?.current_version_id) return clip.current_version_id;

  const version = await db.getFirstAsync<ClipVersion>(
    'SELECT id FROM clip_versions WHERE clip_id = ? ORDER BY version_number DESC LIMIT 1',
    [clipId],
  );
  if (!version?.id) throw new Error('No clip version found');
  return version.id;
}

export async function getClipSegmentsByClipId(clipId: string): Promise<ClipSegment[]> {
  const versionId = await getCurrentVersionId(clipId);
  const db = getDatabase();
  return db.getAllAsync<ClipSegment>(
    'SELECT * FROM clip_segments WHERE clip_version_id = ? ORDER BY start_time, segment_index ASC',
    [versionId],
  );
}

export async function getAdjacentClipSegments(
  clipId: string,
  segmentIndex: number,
): Promise<{ previous: ClipSegment | null; next: ClipSegment | null }> {
  const segments = await getClipSegmentsByClipId(clipId);
  if (segmentIndex < 0 || segmentIndex >= segments.length) {
    return { previous: null, next: null };
  }
  return {
    previous: segmentIndex > 0 ? segments[segmentIndex - 1] : null,
    next: segmentIndex < segments.length - 1 ? segments[segmentIndex + 1] : null,
  };
}

export async function updateClipSegment(
  clipId: string,
  segmentIndex: number,
  startTime: number,
  endTime: number,
): Promise<void> {
  const db = getDatabase();
  const versionId = await getCurrentVersionId(clipId);
  const duration = endTime - startTime;

  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM clip_segments WHERE clip_version_id = ? AND segment_index = ? LIMIT 1',
    [versionId, segmentIndex],
  );

  if (existing?.id) {
    await db.runAsync(
      'UPDATE clip_segments SET start_time = ?, end_time = ?, duration = ? WHERE clip_version_id = ? AND segment_index = ?',
      [startTime, endTime, duration, versionId, segmentIndex],
    );
    return;
  }

  await db.runAsync(
    `INSERT INTO clip_segments (
      id, clip_version_id, segment_index, start_time, end_time, duration, transcript, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [generateId(), versionId, segmentIndex, startTime, endTime, duration, null, timestamp()],
  );
}

export async function splitClipSegment(
  clipId: string,
  segmentIndex: number,
  cutTime: number,
): Promise<{ leftSegmentIndex: number; rightSegmentIndex: number }> {
  const db = getDatabase();
  const versionId = await getCurrentVersionId(clipId);
  const segments = await getClipSegmentsByClipId(clipId);

  if (segmentIndex >= segments.length) {
    throw new Error('Segment not found');
  }

  const segment = segments[segmentIndex];
  if (cutTime <= segment.start_time || cutTime >= segment.end_time) {
    throw new Error(`Cut time must be within segment (${segment.start_time}–${segment.end_time})`);
  }

  const leftDuration = cutTime - segment.start_time;
  const rightDuration = segment.end_time - cutTime;
  if (leftDuration < 0.5 || rightDuration < 0.5) {
    throw new Error('Both segments must be at least 0.5 seconds');
  }

  const now = timestamp();

  await db.runAsync(
    `UPDATE clip_segments SET segment_index = segment_index + 1
     WHERE clip_version_id = ? AND segment_index > ?`,
    [versionId, segmentIndex],
  );

  await db.runAsync('DELETE FROM clip_segments WHERE id = ?', [segment.id!]);

  const leftId = generateId();
  const rightId = generateId();

  await db.runAsync(
    `INSERT INTO clip_segments (
      id, clip_version_id, segment_index, start_time, end_time, duration, transcript, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      leftId,
      versionId,
      segmentIndex,
      segment.start_time,
      cutTime,
      leftDuration,
      segment.transcript,
      now,
    ],
  );

  await db.runAsync(
    `INSERT INTO clip_segments (
      id, clip_version_id, segment_index, start_time, end_time, duration, transcript, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [rightId, versionId, segmentIndex + 1, cutTime, segment.end_time, rightDuration, null, now],
  );

  return { leftSegmentIndex: segmentIndex, rightSegmentIndex: segmentIndex + 1 };
}

export async function deleteClipSegment(clipId: string, segmentIndex: number): Promise<void> {
  const db = getDatabase();
  const versionId = await getCurrentVersionId(clipId);
  const segments = await getClipSegmentsByClipId(clipId);

  if (segments.length <= 1) {
    throw new Error('Cannot delete the last segment');
  }
  if (segmentIndex < 0 || segmentIndex >= segments.length) {
    throw new Error('Invalid segment index');
  }

  await db.runAsync('DELETE FROM clip_segments WHERE id = ?', [segments[segmentIndex].id!]);
  await db.runAsync(
    'UPDATE clip_segments SET segment_index = segment_index - 1 WHERE clip_version_id = ? AND segment_index > ?',
    [versionId, segmentIndex],
  );
}

export async function mergeAdjacentClipSegments(
  clipId: string,
  segmentIndices: number[],
): Promise<void> {
  if (segmentIndices.length < 2) {
    throw new Error('Select at least 2 segments to merge');
  }

  const sorted = [...segmentIndices].sort((a, b) => a - b);
  const segments = await getClipSegmentsByClipId(clipId);
  const firstIndex = sorted[0];
  const lastIndex = sorted[sorted.length - 1];
  const firstSegment = segments[firstIndex];
  const lastSegment = segments[lastIndex];

  if (!firstSegment || !lastSegment) {
    throw new Error('Segments not found');
  }

  await updateClipSegment(clipId, firstIndex, firstSegment.start_time, lastSegment.end_time);

  const toDelete = sorted.filter((idx) => idx !== firstIndex).sort((a, b) => b - a);
  for (const idx of toDelete) {
    await deleteClipSegment(clipId, idx);
  }
}

export async function updateClipTimeRange(
  clipId: string,
  startTime: number,
  endTime: number,
): Promise<void> {
  const start = Math.min(startTime, endTime);
  const end = Math.max(startTime, endTime);
  const segments = await getClipSegmentsByClipId(clipId);

  if (segments.length <= 1) {
    await updateClipSegment(clipId, segments[0]?.segment_index ?? 0, start, end);
  } else {
    const first = segments[0];
    const last = segments[segments.length - 1];
    await updateClipSegment(
      clipId,
      first.segment_index ?? 0,
      start,
      Math.max(start + 0.5, first.end_time),
    );
    await updateClipSegment(
      clipId,
      last.segment_index ?? segments.length - 1,
      Math.min(end - 0.5, last.start_time),
      end,
    );
  }

  await syncClipBoundsFromSegments(clipId);
}

export async function replaceClipSegments(
  clipId: string,
  ranges: { start_time: number; end_time: number; transcript?: string | null }[],
): Promise<void> {
  if (ranges.length === 0) {
    throw new Error('At least one segment is required');
  }

  const versionId = await getCurrentVersionId(clipId);
  const db = getDatabase();
  const now = timestamp();

  await db.runAsync('DELETE FROM clip_segments WHERE clip_version_id = ?', [versionId]);

  for (const [index, range] of ranges.entries()) {
    const duration = range.end_time - range.start_time;
    await db.runAsync(
      `INSERT INTO clip_segments (
        id, clip_version_id, segment_index, start_time, end_time, duration, transcript, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        generateId(),
        versionId,
        index,
        range.start_time,
        range.end_time,
        duration,
        range.transcript ?? null,
        now,
      ],
    );
  }

  await syncClipBoundsFromSegments(clipId);
}

export async function syncClipBoundsFromSegments(clipId: string): Promise<void> {
  const segments = await getClipSegmentsByClipId(clipId);
  if (segments.length === 0) return;

  const start = Math.min(...segments.map((s) => s.start_time));
  const end = Math.max(...segments.map((s) => s.end_time));
  const duration = end - start;
  const now = timestamp();
  const db = getDatabase();

  await db.runAsync(
    'UPDATE clips SET start_time = ?, end_time = ?, duration = ?, updated_at = ? WHERE id = ?',
    [start, end, duration, now, clipId],
  );

  const versionId = await getCurrentVersionId(clipId);
  await db.runAsync(
    'UPDATE clip_versions SET start_time = ?, end_time = ? WHERE id = ?',
    [start, end, versionId],
  );
}

export function segmentsToClipRelative(segments: ClipSegment[], clipStart: number): ClipSegment[] {
  return segments.map((seg) => ({
    ...seg,
    start_time: seg.start_time - clipStart,
    end_time: seg.end_time - clipStart,
    duration: seg.end_time - seg.start_time,
  }));
}

export function segmentsFromClipRelative(
  segments: ClipSegment[],
  clipStart: number,
): ClipSegment[] {
  return segments.map((seg) => ({
    ...seg,
    start_time: seg.start_time + clipStart,
    end_time: seg.end_time + clipStart,
    duration: seg.end_time - seg.start_time,
  }));
}
