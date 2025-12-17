import { getDatabase, timestamp, generateId, getCurrentUserId } from './core';
import type { IntroOutro } from './types';

export async function createIntroOutro(
  type: 'intro' | 'outro',
  name: string,
  filePath: string,
  duration?: number,
  thumbnailPath?: string | null,
  thumbnailGenerationStatus?: 'pending' | 'processing' | 'completed' | 'failed'
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();
  const userId = getCurrentUserId();

  await db.execute(
    'INSERT INTO intro_outros (id, type, name, file_path, duration, thumbnail_path, thumbnail_generation_status, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      id,
      type,
      name,
      filePath,
      duration || null,
      thumbnailPath || null,
      thumbnailGenerationStatus || 'pending',
      userId,
      now,
      now,
    ]
  );

  return id;
}

export async function getAllIntroOutros(type?: 'intro' | 'outro'): Promise<IntroOutro[]> {
  const db = await getDatabase();
  const userId = getCurrentUserId();

  if (type) {
    if (userId === null) {
      return await db.select<IntroOutro[]>(
        'SELECT * FROM intro_outros WHERE type = ? AND user_id IS NULL ORDER BY name',
        [type]
      );
    }
    return await db.select<IntroOutro[]>(
      'SELECT * FROM intro_outros WHERE type = ? AND (user_id = ? OR user_id IS NULL) ORDER BY name',
      [type, userId]
    );
  }

  if (userId === null) {
    return await db.select<IntroOutro[]>(
      'SELECT * FROM intro_outros WHERE user_id IS NULL ORDER BY type, name'
    );
  }
  return await db.select<IntroOutro[]>(
    'SELECT * FROM intro_outros WHERE user_id = ? OR user_id IS NULL ORDER BY type, name',
    [userId]
  );
}

export async function updateIntroOutroCompletion(
  id: string,
  filePath: string,
  thumbnailPath: string | null,
  duration: number | undefined,
  status: 'completed' | 'failed'
): Promise<void> {
  const db = await getDatabase();

  if (status === 'completed') {
    await db.execute(
      'UPDATE intro_outros SET file_path = ?, thumbnail_path = ?, duration = ?, thumbnail_generation_status = ?, updated_at = ? WHERE id = ?',
      [filePath, thumbnailPath, duration || null, status, timestamp(), id]
    );
  } else {
    await db.execute(
      'UPDATE intro_outros SET thumbnail_generation_status = ?, updated_at = ? WHERE id = ?',
      [status, timestamp(), id]
    );
  }
}

export async function updateIntroOutroThumbnailStatus(
  id: string,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  thumbnailPath?: string | null
): Promise<void> {
  const db = await getDatabase();
  const now = timestamp();

  if (thumbnailPath) {
    await db.execute(
      'UPDATE intro_outros SET thumbnail_generation_status = ?, thumbnail_path = ?, updated_at = ? WHERE id = ?',
      [status, thumbnailPath, now, id]
    );
  } else {
    await db.execute(
      'UPDATE intro_outros SET thumbnail_generation_status = ?, updated_at = ? WHERE id = ?',
      [status, now, id]
    );
  }
}

export async function getIntroOutroById(id: string): Promise<IntroOutro | null> {
  const db = await getDatabase();
  const results = await db.select<IntroOutro[]>('SELECT * FROM intro_outros WHERE id = ?', [id]);
  return results[0] || null;
}

export async function deleteIntroOutro(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM intro_outros WHERE id = ?', [id]);
}
