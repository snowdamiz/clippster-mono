import { getDatabase, timestamp, generateId } from './core';
import type { AudioAsset } from './types';

export async function createAudioAsset(
  name: string,
  filePath: string,
  duration?: number,
  fileSize?: number,
  sampleRate?: number,
  channels?: number
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  await db.execute(
    'INSERT INTO audio_assets (id, name, file_path, duration, file_size, sample_rate, channels, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      id,
      name,
      filePath,
      duration || null,
      fileSize || null,
      sampleRate || null,
      channels || null,
      now,
      now,
    ]
  );

  return id;
}

export async function getAllAudioAssets(): Promise<AudioAsset[]> {
  const db = await getDatabase();
  return await db.select<AudioAsset[]>('SELECT * FROM audio_assets ORDER BY created_at DESC');
}

export async function getAudioAsset(id: string): Promise<AudioAsset | null> {
  const db = await getDatabase();
  const results = await db.select<AudioAsset[]>('SELECT * FROM audio_assets WHERE id = ?', [id]);
  return results.length > 0 ? results[0] : null;
}

export async function updateAudioAsset(
  id: string,
  updates: {
    name?: string;
    duration?: number;
    file_size?: number;
    sample_rate?: number;
    channels?: number;
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

  params.push(id);
  await db.execute(`UPDATE audio_assets SET ${setClause.join(', ')} WHERE id = ?`, params);
}

export async function deleteAudioAsset(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM audio_assets WHERE id = ?', [id]);
}
