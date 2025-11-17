import { getDatabase, timestamp, generateId } from './core';
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

  await db.execute(
    'INSERT INTO intro_outros (id, type, name, file_path, duration, thumbnail_path, thumbnail_generation_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      id,
      type,
      name,
      filePath,
      duration || null,
      thumbnailPath || null,
      thumbnailGenerationStatus || 'pending',
      now,
      now,
    ]
  );

  return id;
}

export async function getAllIntroOutros(type?: 'intro' | 'outro'): Promise<IntroOutro[]> {
  const db = await getDatabase();

  if (type) {
    return await db.select<IntroOutro[]>(
      'SELECT * FROM intro_outros WHERE type = ? ORDER BY name',
      [type]
    );
  }

  return await db.select<IntroOutro[]>('SELECT * FROM intro_outros ORDER BY type, name');
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

export async function deleteIntroOutro(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM intro_outros WHERE id = ?', [id]);
}
