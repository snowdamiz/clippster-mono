import { getDatabase, timestamp, generateId, getCurrentUserId } from './core';
import type { WatermarkImage } from './types';

export async function createWatermarkImage(
  name: string,
  filePath: string,
  width?: number,
  height?: number,
  fileSize?: number
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();
  const userId = getCurrentUserId();

  await db.execute(
    'INSERT INTO watermark_images (id, name, file_path, width, height, file_size, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, name, filePath, width || null, height || null, fileSize || null, userId, now, now]
  );

  return id;
}

export async function getAllWatermarkImages(): Promise<WatermarkImage[]> {
  const db = await getDatabase();
  const userId = getCurrentUserId();

  if (userId === null) {
    return await db.select<WatermarkImage[]>(
      'SELECT * FROM watermark_images WHERE user_id IS NULL ORDER BY name'
    );
  }

  return await db.select<WatermarkImage[]>(
    'SELECT * FROM watermark_images WHERE user_id = ? OR user_id IS NULL ORDER BY name',
    [userId]
  );
}

export async function getWatermarkImage(id: string): Promise<WatermarkImage | null> {
  const db = await getDatabase();
  const results = await db.select<WatermarkImage[]>('SELECT * FROM watermark_images WHERE id = ?', [
    id,
  ]);
  return results.length > 0 ? results[0] : null;
}

export async function updateWatermarkImage(
  id: string,
  updates: {
    name?: string;
    width?: number;
    height?: number;
  }
): Promise<void> {
  const db = await getDatabase();
  const now = timestamp();

  const setClause: string[] = ['updated_at = ?'];
  const params: any[] = [now];

  if (updates.name !== undefined) {
    setClause.push('name = ?');
    params.push(updates.name);
  }
  if (updates.width !== undefined) {
    setClause.push('width = ?');
    params.push(updates.width);
  }
  if (updates.height !== undefined) {
    setClause.push('height = ?');
    params.push(updates.height);
  }

  params.push(id);
  await db.execute(`UPDATE watermark_images SET ${setClause.join(', ')} WHERE id = ?`, params);
}

export async function deleteWatermarkImage(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM watermark_images WHERE id = ?', [id]);
}
