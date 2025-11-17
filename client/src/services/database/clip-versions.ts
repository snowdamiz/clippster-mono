import { getDatabase, timestamp, generateId } from './core';
import type { ClipVersion } from './types';

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
