import { getDatabase, generateId, timestamp } from './core';
import type { FocalPoint } from './types';

/**
 * Create a single focal point record
 */
export async function createFocalPoint(
  rawVideoId: string,
  timeOffset: number,
  focalX: number,
  focalY: number,
  confidence: number = 1.0
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  await db.execute(
    'INSERT INTO focal_points (id, raw_video_id, time_offset, focal_x, focal_y, confidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, rawVideoId, timeOffset, focalX, focalY, confidence, now]
  );

  return id;
}

/**
 * Bulk insert focal points efficiently
 */
export async function bulkCreateFocalPoints(
  rawVideoId: string,
  focalPoints: Array<{
    timeOffset: number;
    focalX: number;
    focalY: number;
    confidence?: number;
  }>
): Promise<void> {
  if (focalPoints.length === 0) {
    return;
  }

  const db = await getDatabase();
  const now = timestamp();

  // Build values for batch insert
  const placeholders = focalPoints.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
  const values: (string | number)[] = [];

  for (const point of focalPoints) {
    values.push(
      generateId(),
      rawVideoId,
      point.timeOffset,
      point.focalX,
      point.focalY,
      point.confidence || 1.0,
      now
    );
  }

  const query = `INSERT INTO focal_points (id, raw_video_id, time_offset, focal_x, focal_y, confidence, created_at) VALUES ${placeholders}`;

  await db.execute(query, values);
}

/**
 * Get all focal points for a specific raw video, ordered by time
 */
export async function getFocalPointsByRawVideoId(rawVideoId: string): Promise<FocalPoint[]> {
  const db = await getDatabase();
  return db.select<FocalPoint[]>(
    'SELECT * FROM focal_points WHERE raw_video_id = ? ORDER BY time_offset ASC',
    [rawVideoId]
  );
}

/**
 * Get interpolated focal point at a specific time
 * Returns the interpolated focal point based on surrounding time offsets
 */
export async function getFocalPointAtTime(
  rawVideoId: string,
  timeSeconds: number
): Promise<{ x: number; y: number }> {
  const focalPoints = await getFocalPointsByRawVideoId(rawVideoId);

  // Default to center if no focal points exist
  if (focalPoints.length === 0) {
    return { x: 0.5, y: 0.5 };
  }

  // If only one focal point, use it for all times
  if (focalPoints.length === 1) {
    return { x: focalPoints[0].focal_x, y: focalPoints[0].focal_y };
  }

  // Find the two nearest focal points (before and after current time)
  let beforePoint: FocalPoint | null = null;
  let afterPoint: FocalPoint | null = null;

  for (const point of focalPoints) {
    if (point.time_offset <= timeSeconds) {
      beforePoint = point;
    }
    if (point.time_offset >= timeSeconds && afterPoint === null) {
      afterPoint = point;
      break;
    }
  }

  // If before the first point, use the first point
  if (beforePoint === null && afterPoint !== null) {
    return { x: afterPoint.focal_x, y: afterPoint.focal_y };
  }

  // If after the last point, use the last point
  if (beforePoint !== null && afterPoint === null) {
    return { x: beforePoint.focal_x, y: beforePoint.focal_y };
  }

  // If we have both points, interpolate
  if (beforePoint !== null && afterPoint !== null) {
    // If they're the same point (exact match), use it directly
    if (beforePoint.time_offset === afterPoint.time_offset) {
      return { x: beforePoint.focal_x, y: beforePoint.focal_y };
    }

    // Linear interpolation
    const timeDelta = afterPoint.time_offset - beforePoint.time_offset;
    const timeProgress = (timeSeconds - beforePoint.time_offset) / timeDelta;

    const interpolatedX =
      beforePoint.focal_x + (afterPoint.focal_x - beforePoint.focal_x) * timeProgress;
    const interpolatedY =
      beforePoint.focal_y + (afterPoint.focal_y - beforePoint.focal_y) * timeProgress;

    return { x: interpolatedX, y: interpolatedY };
  }

  // Fallback to center
  return { x: 0.5, y: 0.5 };
}

/**
 * Check if focal points exist for a raw video
 */
export async function hasFocalPoints(rawVideoId: string): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM focal_points WHERE raw_video_id = ?',
    [rawVideoId]
  );
  return result.length > 0 && result[0].count > 0;
}

/**
 * Delete all focal points for a specific raw video
 */
export async function deleteFocalPointsByRawVideoId(rawVideoId: string): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM focal_points WHERE raw_video_id = ?', [rawVideoId]);
}

/**
 * Get the count of focal points for a raw video
 */
export async function getFocalPointCount(rawVideoId: string): Promise<number> {
  const db = await getDatabase();
  const result = await db.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM focal_points WHERE raw_video_id = ?',
    [rawVideoId]
  );
  return result.length > 0 ? result[0].count : 0;
}
