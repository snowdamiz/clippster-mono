import { getDatabase, timestamp, generateId, getCurrentUserId } from './core';
import type { Project, Clip } from './types';

// Project queries
export async function createProject(
  name: string,
  description?: string,
  parentId?: string,
  platform?: 'PumpFun' | 'Kick' | 'Youtube' | 'Twitch' | 'Manual',
  defaultWatermarkSettings?: string, // JSON string with watermark_id and watermark_settings from creator profile
  creatorProfileId?: string // Direct link to creator profile (for local video imports)
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();
  const userId = getCurrentUserId();

  await db.execute(
    'INSERT INTO projects (id, name, description, thumbnail_path, parent_id, platform, default_watermark_settings, creator_profile_id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      id,
      name,
      description || null,
      null,
      parentId || null,
      platform || null,
      defaultWatermarkSettings || null,
      creatorProfileId || null,
      userId,
      now,
      now,
    ]
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
  const userId = getCurrentUserId();

  if (userId === null) {
    // No user logged in - only return unowned records
    return await db.select<Project[]>(
      'SELECT * FROM projects WHERE user_id IS NULL ORDER BY updated_at DESC'
    );
  }

  // Return current user's records + unowned records (for backwards compatibility)
  return await db.select<Project[]>(
    'SELECT * FROM projects WHERE user_id = ? OR user_id IS NULL ORDER BY updated_at DESC',
    [userId]
  );
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

/**
 * Get clips for a project that should be deleted (unbuilt and not in-editor).
 * Built clips (built_file_path not null) and in-editor clips are retained.
 * @param projectId - The project ID
 * @param inEditorClipIds - Set of clip IDs currently in the in-editor store
 */
export async function getClipsToDeleteForProject(
  projectId: string,
  inEditorClipIds: Set<string>
): Promise<Clip[]> {
  const db = await getDatabase();
  // Get all clips for this project that are NOT built
  const unbuiltClips = await db.select<Clip[]>(
    `SELECT * FROM clips WHERE project_id = ? AND (built_file_path IS NULL OR built_file_path = '')`,
    [projectId]
  );
  // Filter out clips that are in-editor
  return unbuiltClips.filter((clip) => !inEditorClipIds.has(clip.id));
}

/**
 * Enhanced project deletion that respects in-editor and built clip retention.
 * - Deletes raw videos from disk and DB
 * - Deletes unbuilt/unopened clips (not built, not in-editor)
 * - Retains built clips (sets project_id = NULL, preserves project_name)
 * - Retains in-editor clips (sets project_id = NULL, preserves project_name)
 * @param projectId - The project ID to delete
 * @param inEditorClipIds - Set of clip IDs currently in the in-editor store
 */
export async function deleteProjectWithRetention(
  projectId: string,
  inEditorClipIds: Set<string>
): Promise<{ deletedClipIds: string[]; retainedClipIds: string[] }> {
  const db = await getDatabase();

  // Get the project name before deleting so we can preserve it on clips
  const project = await getProject(projectId);
  const projectName = project?.name || null;

  // Get clips to delete (unbuilt and not in-editor)
  const clipsToDelete = await getClipsToDeleteForProject(projectId, inEditorClipIds);
  const deletedClipIds = clipsToDelete.map((c) => c.id);

  // Get clips to retain (built OR in-editor)
  const allClips = await db.select<Clip[]>('SELECT * FROM clips WHERE project_id = ?', [projectId]);
  const retainedClipIds = allClips.filter((c) => !deletedClipIds.includes(c.id)).map((c) => c.id);

  // Delete unbuilt/unopened clips
  for (const clip of clipsToDelete) {
    // Delete clip segments first (foreign key constraint)
    await db.execute('DELETE FROM clip_segments WHERE clip_id = ?', [clip.id]);
    // Delete clip edits
    await db.execute('DELETE FROM clip_edits WHERE clip_id = ?', [clip.id]);
    // Delete the clip record
    await db.execute('DELETE FROM clips WHERE id = ?', [clip.id]);
  }

  // Preserve project name and disassociate retained clips
  if (retainedClipIds.length > 0 && projectName) {
    await db.execute(
      `UPDATE clips SET project_name = ?, project_id = NULL WHERE project_id = ? AND (project_name IS NULL OR project_name = '')`,
      [projectName, projectId]
    );
    await db.execute('UPDATE clips SET project_id = NULL WHERE project_id = ?', [projectId]);
  }

  // Disassociate raw videos (they will be deleted separately by the caller)
  try {
    await db.execute('UPDATE raw_videos SET project_id = NULL WHERE project_id = ?', [projectId]);
  } catch (error) {
    console.warn('[Database] raw_videos project_id column update failed:', error);
  }

  // Disassociate child projects
  try {
    await db.execute('UPDATE projects SET parent_id = NULL WHERE parent_id = ?', [projectId]);
  } catch (error) {
    console.warn('[Database] projects parent_id column update failed:', error);
  }

  // Disassociate clip detection sessions
  try {
    await db.execute('UPDATE clip_detection_sessions SET project_id = NULL WHERE project_id = ?', [projectId]);
  } catch (error) {
    console.warn('[Database] clip_detection_sessions project_id column update failed:', error);
  }

  // Delete the project record
  await db.execute('DELETE FROM projects WHERE id = ?', [projectId]);

  return { deletedClipIds, retainedClipIds };
}
