import { getDatabase, timestamp, generateId, getCurrentUserId } from './core';
import type { ImageAsset } from './types';

export async function createImageAsset(
  name: string,
  filePath: string,
  width?: number,
  height?: number,
  fileSize?: number,
  mimeType?: string
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();
  const userId = getCurrentUserId();

  await db.execute(
    'INSERT INTO image_assets (id, name, file_path, width, height, file_size, mime_type, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      id,
      name,
      filePath,
      width || null,
      height || null,
      fileSize || null,
      mimeType || null,
      userId,
      now,
      now,
    ]
  );

  return id;
}

export async function getAllImageAssets(): Promise<ImageAsset[]> {
  const db = await getDatabase();
  const userId = getCurrentUserId();

  if (userId === null) {
    return await db.select<ImageAsset[]>(
      'SELECT * FROM image_assets WHERE user_id IS NULL ORDER BY created_at DESC'
    );
  }

  return await db.select<ImageAsset[]>(
    'SELECT * FROM image_assets WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC',
    [userId]
  );
}

export async function getImageAsset(id: string): Promise<ImageAsset | null> {
  const db = await getDatabase();
  const results = await db.select<ImageAsset[]>('SELECT * FROM image_assets WHERE id = ?', [id]);
  return results.length > 0 ? results[0] : null;
}

export async function updateImageAsset(
  id: string,
  updates: {
    name?: string;
    width?: number;
    height?: number;
    file_size?: number;
    mime_type?: string;
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
  if (updates.file_size !== undefined) {
    setClause.push('file_size = ?');
    params.push(updates.file_size);
  }
  if (updates.mime_type !== undefined) {
    setClause.push('mime_type = ?');
    params.push(updates.mime_type);
  }

  params.push(id);
  await db.execute(`UPDATE image_assets SET ${setClause.join(', ')} WHERE id = ?`, params);
}

export async function deleteImageAsset(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM image_assets WHERE id = ?', [id]);
}
