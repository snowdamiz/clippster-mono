import { getDatabase, generateId, timestamp } from './core';
import type { Clip } from './types';

// Basic clip CRUD operations
export async function createClip(
  projectId: string,
  filePath: string,
  options?: {
    name?: string;
    duration?: number;
    startTime?: number;
    endTime?: number;
    orderIndex?: number;
    introId?: string;
    outroId?: string;
  }
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  await db.execute(
    'INSERT INTO clips (id, project_id, name, file_path, duration, start_time, end_time, order_index, intro_id, outro_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      id,
      projectId,
      options?.name || null,
      filePath,
      options?.duration || null,
      options?.startTime || null,
      options?.endTime || null,
      options?.orderIndex || null,
      options?.introId || null,
      options?.outroId || null,
      now,
      now,
    ]
  );

  return id;
}

export async function getAllClips(): Promise<Clip[]> {
  const db = await getDatabase();
  return await db.select<Clip[]>('SELECT * FROM clips ORDER BY created_at DESC');
}

export async function getGeneratedClips(): Promise<Clip[]> {
  const db = await getDatabase();
  return await db.select<Clip[]>('SELECT * FROM clips WHERE status = ? ORDER BY created_at DESC', [
    'generated',
  ]);
}

export async function getDetectedClips(): Promise<Clip[]> {
  const db = await getDatabase();
  return await db.select<Clip[]>('SELECT * FROM clips WHERE status = ? ORDER BY created_at DESC', [
    'detected',
  ]);
}

export async function getClipsByProjectId(projectId: string): Promise<Clip[]> {
  const db = await getDatabase();
  return await db.select<Clip[]>(
    'SELECT * FROM clips WHERE project_id = ? ORDER BY order_index, created_at',
    [projectId]
  );
}

export async function updateClip(
  id: string,
  updates: Partial<Omit<Clip, 'id' | 'project_id' | 'created_at'>>
): Promise<void> {
  const db = await getDatabase();
  const now = timestamp();

  const updateFields: string[] = [];
  const values: any[] = [];

  for (const [key, value] of Object.entries(updates)) {
    updateFields.push(`${key} = ?`);
    values.push(value);
  }

  updateFields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await db.execute(`UPDATE clips SET ${updateFields.join(', ')} WHERE id = ?`, values);
}

export async function deleteClip(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM clips WHERE id = ?', [id]);
}
