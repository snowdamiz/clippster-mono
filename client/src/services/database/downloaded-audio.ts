import { getDatabase, timestamp, generateId, getCurrentUserId } from './core';
import type { DownloadedAudio } from './types';

export async function createDownloadedAudio(
  title: string,
  source: 'youtube' | 'twitter' | 'upload',
  filePath: string,
  platform?: string,
  sourceUrl?: string,
  duration?: number,
  fileSize?: number,
  sampleRate?: number,
  channels?: number,
  thumbnailUrl?: string
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();
  const userId = getCurrentUserId();

  await db.execute(
    `INSERT INTO downloaded_audio (
      id, title, source, platform, source_url, file_path, 
      duration, file_size, sample_rate, channels, thumbnail_url, 
      user_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      title,
      source,
      platform || null,
      sourceUrl || null,
      filePath,
      duration || null,
      fileSize || null,
      sampleRate || null,
      channels || null,
      thumbnailUrl || null,
      userId,
      now,
      now,
    ]
  );

  return id;
}

export async function getAllDownloadedAudio(): Promise<DownloadedAudio[]> {
  const db = await getDatabase();
  const userId = getCurrentUserId();

  if (userId === null) {
    return await db.select<DownloadedAudio[]>(
      'SELECT * FROM downloaded_audio WHERE user_id IS NULL ORDER BY created_at DESC'
    );
  }

  return await db.select<DownloadedAudio[]>(
    'SELECT * FROM downloaded_audio WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC',
    [userId]
  );
}

export async function getDownloadedAudio(id: string): Promise<DownloadedAudio | null> {
  const db = await getDatabase();
  const results = await db.select<DownloadedAudio[]>(
    'SELECT * FROM downloaded_audio WHERE id = ?',
    [id]
  );
  return results.length > 0 ? results[0] : null;
}

export async function updateDownloadedAudio(
  id: string,
  updates: {
    title?: string;
    duration?: number;
    file_size?: number;
    sample_rate?: number;
    channels?: number;
    thumbnail_url?: string;
  }
): Promise<void> {
  const db = await getDatabase();
  const now = timestamp();

  const setClause: string[] = ['updated_at = ?'];
  const params: any[] = [now];

  if (updates.title !== undefined) {
    setClause.push('title = ?');
    params.push(updates.title);
  }
  if (updates.duration !== undefined) {
    setClause.push('duration = ?');
    params.push(updates.duration);
  }
  if (updates.file_size !== undefined) {
    setClause.push('file_size = ?');
    params.push(updates.file_size);
  }
  if (updates.sample_rate !== undefined) {
    setClause.push('sample_rate = ?');
    params.push(updates.sample_rate);
  }
  if (updates.channels !== undefined) {
    setClause.push('channels = ?');
    params.push(updates.channels);
  }
  if (updates.thumbnail_url !== undefined) {
    setClause.push('thumbnail_url = ?');
    params.push(updates.thumbnail_url);
  }

  params.push(id);
  await db.execute(`UPDATE downloaded_audio SET ${setClause.join(', ')} WHERE id = ?`, params);
}

export async function deleteDownloadedAudio(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM downloaded_audio WHERE id = ?', [id]);
}

export async function searchDownloadedAudio(query: string): Promise<DownloadedAudio[]> {
  const db = await getDatabase();
  const userId = getCurrentUserId();
  const searchPattern = `%${query}%`;

  if (userId === null) {
    return await db.select<DownloadedAudio[]>(
      `SELECT * FROM downloaded_audio 
       WHERE user_id IS NULL AND title LIKE ? 
       ORDER BY created_at DESC`,
      [searchPattern]
    );
  }

  return await db.select<DownloadedAudio[]>(
    `SELECT * FROM downloaded_audio 
     WHERE (user_id = ? OR user_id IS NULL) AND title LIKE ? 
     ORDER BY created_at DESC`,
    [userId, searchPattern]
  );
}
