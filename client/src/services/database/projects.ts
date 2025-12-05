import { getDatabase, timestamp, generateId } from './core';
import type { Project } from './types';

// Project queries
export async function createProject(
  name: string,
  description?: string,
  parentId?: string,
  platform?: 'PumpFun' | 'Kick' | 'Youtube' | 'Twitch' | 'Manual'
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  await db.execute(
    'INSERT INTO projects (id, name, description, thumbnail_path, parent_id, platform, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, name, description || null, null, parentId || null, platform || null, now, now]
  );

  return id;
}

export async function getProject(id: string): Promise<Project | null> {
  const db = await getDatabase();
  const result = await db.select<Project[]>('SELECT * FROM projects WHERE id = ?', [id]);
  return result[0] || null;
}

export async function getAllProjects(): Promise<Project[]> {
  const db = await getDatabase();
  return await db.select<Project[]>('SELECT * FROM projects ORDER BY updated_at DESC');
}

export async function updateProject(
  id: string,
  name?: string,
  description?: string,
  thumbnailPath?: string,
  platform?: 'PumpFun' | 'Kick' | 'Youtube' | 'Twitch' | 'Manual'
): Promise<void> {
  const db = await getDatabase();
  const now = timestamp();

  const updates: string[] = [];
  const values: any[] = [];

  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    values.push(description);
  }
  if (thumbnailPath !== undefined) {
    updates.push('thumbnail_path = ?');
    values.push(thumbnailPath);
  }
  if (platform !== undefined) {
    updates.push('platform = ?');
    values.push(platform);
  }

  updates.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await db.execute(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`, values);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDatabase();

  // Get the project name before deleting so we can preserve it on clips
  const project = await getProject(id);
  const projectName = project?.name || null;

  // First, disassociate all associated content by setting project_id to NULL
  // This preserves the content while removing the project association

  try {
    // Disassociate raw videos from this project (has project_id)
    await db.execute('UPDATE raw_videos SET project_id = NULL WHERE project_id = ?', [id]);
  } catch (error) {
    console.warn('[Database] raw_videos project_id column update failed:', error);
  }

  try {
    // Disassociate child projects (has parent_id)
    await db.execute('UPDATE projects SET parent_id = NULL WHERE parent_id = ?', [id]);
  } catch (error) {
    console.warn('[Database] projects parent_id column update failed:', error);
  }

  try {
    // Preserve the project name on clips before disassociating
    // This allows clips to still be displayed under their original project name
    if (projectName) {
      await db.execute(
        'UPDATE clips SET project_name = ? WHERE project_id = ? AND (project_name IS NULL OR project_name = "")',
        [projectName, id]
      );
    }
    // Disassociate clips from this project (has project_id)
    await db.execute('UPDATE clips SET project_id = NULL WHERE project_id = ?', [id]);
  } catch (error) {
    console.warn('[Database] clips project_id column update failed:', error);
  }

  try {
    // Disassociate clip detection sessions from this project (has project_id)
    await db.execute('UPDATE clip_detection_sessions SET project_id = NULL WHERE project_id = ?', [
      id,
    ]);
  } catch (error) {
    console.warn('[Database] clip_detection_sessions project_id column update failed:', error);
  }

  // Note: transcripts table was changed in migration 4 to use raw_video_id instead of project_id
  // So we don't need to update transcripts here

  // Now safely delete the project
  await db.execute('DELETE FROM projects WHERE id = ?', [id]);
}

export async function hasRawVideosForProject(projectId: string): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM raw_videos WHERE project_id = ?',
    [projectId]
  );
  return (result[0]?.count || 0) > 0;
}

export async function hasClipsForProject(projectId: string): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM clips WHERE project_id = ?',
    [projectId]
  );
  return (result[0]?.count || 0) > 0;
}

export async function hasDetectedOrGeneratedClips(projectId: string): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM clips WHERE project_id = ? AND status IN ("detected", "generated")',
    [projectId]
  );
  return (result[0]?.count || 0) > 0;
}

export async function hasChildProjects(projectId: string): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM projects WHERE parent_id = ?',
    [projectId]
  );
  return (result[0]?.count || 0) > 0;
}

export async function getChildProjects(parentId: string): Promise<Project[]> {
  const db = await getDatabase();
  return await db.select<Project[]>(
    'SELECT * FROM projects WHERE parent_id = ? ORDER BY created_at ASC',
    [parentId]
  );
}