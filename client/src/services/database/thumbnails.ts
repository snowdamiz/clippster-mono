import { getDatabase, timestamp, generateId } from './core';
import type { Thumbnail } from './types';

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
