import { getDatabase, generateId, timestamp, getCurrentUserId } from './core';

// ==========================================
// Project Media Types
// ==========================================

export type MediaType = 'video' | 'audio' | 'image';

export interface ProjectMedia {
  id: string;
  project_id: string;
  media_type: MediaType;
  file_path: string;
  file_name: string;
  thumbnail_path: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  file_size: number | null;
  is_favorite: boolean;
  use_count: number;
  last_used_at: number | null;
  created_at: number;
  user_id: string | null;
}

// Raw database row type
interface ProjectMediaRow {
  id: string;
  project_id: string;
  media_type: string;
  file_path: string;
  file_name: string;
  thumbnail_path: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  file_size: number | null;
  is_favorite: number;
  use_count: number;
  last_used_at: number | null;
  created_at: number;
  user_id: string | null;
}

function rowToProjectMedia(row: ProjectMediaRow): ProjectMedia {
  return {
    ...row,
    media_type: row.media_type as MediaType,
    is_favorite: row.is_favorite === 1,
  };
}

// ==========================================
// Ensure table exists (for older databases)
// ==========================================

let tableExists = false;

async function ensureTableExists(): Promise<boolean> {
  if (tableExists) return true;

  const db = await getDatabase();
  try {
    await db.execute('SELECT 1 FROM project_media LIMIT 1', []);
    tableExists = true;
    return true;
  } catch {
    // Table doesn't exist, create it
    console.log('[project-media] Creating project_media table');
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS project_media (
          id TEXT PRIMARY KEY NOT NULL,
          project_id TEXT NOT NULL,
          media_type TEXT NOT NULL CHECK(media_type IN ('video', 'audio', 'image')),
          file_path TEXT NOT NULL,
          file_name TEXT NOT NULL,
          thumbnail_path TEXT,
          duration REAL,
          width INTEGER,
          height INTEGER,
          file_size INTEGER,
          is_favorite INTEGER DEFAULT 0,
          use_count INTEGER DEFAULT 0,
          last_used_at INTEGER,
          created_at INTEGER NOT NULL,
          user_id TEXT
        )
      `, []);
      
      await db.execute('CREATE INDEX IF NOT EXISTS idx_project_media_project_id ON project_media(project_id)', []);
      await db.execute('CREATE INDEX IF NOT EXISTS idx_project_media_type ON project_media(project_id, media_type)', []);
      
      tableExists = true;
      console.log('[project-media] Successfully created project_media table');
      return true;
    } catch (createError) {
      console.error('[project-media] Failed to create table:', createError);
      return false;
    }
  }
}

// ==========================================
// CRUD Operations
// ==========================================

export async function addProjectMedia(
  projectId: string,
  data: {
    mediaType: MediaType;
    filePath: string;
    fileName: string;
    thumbnailPath?: string | null;
    duration?: number | null;
    width?: number | null;
    height?: number | null;
    fileSize?: number | null;
  }
): Promise<ProjectMedia | null> {
  if (!(await ensureTableExists())) return null;

  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();
  const userId = getCurrentUserId();

  await db.execute(
    `INSERT INTO project_media 
     (id, project_id, media_type, file_path, file_name, thumbnail_path, duration, width, height, file_size, is_favorite, use_count, last_used_at, created_at, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NULL, ?, ?)`,
    [
      id,
      projectId,
      data.mediaType,
      data.filePath,
      data.fileName,
      data.thumbnailPath || null,
      data.duration || null,
      data.width || null,
      data.height || null,
      data.fileSize || null,
      now,
      userId,
    ]
  );

  return {
    id,
    project_id: projectId,
    media_type: data.mediaType,
    file_path: data.filePath,
    file_name: data.fileName,
    thumbnail_path: data.thumbnailPath || null,
    duration: data.duration || null,
    width: data.width || null,
    height: data.height || null,
    file_size: data.fileSize || null,
    is_favorite: false,
    use_count: 0,
    last_used_at: null,
    created_at: now,
    user_id: userId !== null ? String(userId) : null,
  };
}

export async function getProjectMedia(projectId: string): Promise<ProjectMedia[]> {
  if (!(await ensureTableExists())) return [];

  const db = await getDatabase();
  const rows = await db.select<ProjectMediaRow[]>(
    'SELECT * FROM project_media WHERE project_id = ? ORDER BY created_at DESC',
    [projectId]
  );

  return rows.map(rowToProjectMedia);
}

export async function getProjectMediaByType(
  projectId: string,
  mediaType: MediaType
): Promise<ProjectMedia[]> {
  if (!(await ensureTableExists())) return [];

  const db = await getDatabase();
  const rows = await db.select<ProjectMediaRow[]>(
    'SELECT * FROM project_media WHERE project_id = ? AND media_type = ? ORDER BY created_at DESC',
    [projectId, mediaType]
  );

  return rows.map(rowToProjectMedia);
}

export async function getRecentProjectMedia(
  projectId: string,
  limit: number = 10
): Promise<ProjectMedia[]> {
  if (!(await ensureTableExists())) return [];

  const db = await getDatabase();
  const rows = await db.select<ProjectMediaRow[]>(
    'SELECT * FROM project_media WHERE project_id = ? AND last_used_at IS NOT NULL ORDER BY last_used_at DESC LIMIT ?',
    [projectId, limit]
  );

  return rows.map(rowToProjectMedia);
}

export async function getFavoriteProjectMedia(projectId: string): Promise<ProjectMedia[]> {
  if (!(await ensureTableExists())) return [];

  const db = await getDatabase();
  const rows = await db.select<ProjectMediaRow[]>(
    'SELECT * FROM project_media WHERE project_id = ? AND is_favorite = 1 ORDER BY created_at DESC',
    [projectId]
  );

  return rows.map(rowToProjectMedia);
}

export async function updateProjectMedia(
  id: string,
  updates: Partial<{
    file_name: string;
    thumbnail_path: string | null;
    is_favorite: boolean;
    duration: number | null;
    width: number | null;
    height: number | null;
  }>
): Promise<void> {
  if (!(await ensureTableExists())) return;

  const db = await getDatabase();
  const updateFields: string[] = [];
  const values: any[] = [];

  if (updates.file_name !== undefined) {
    updateFields.push('file_name = ?');
    values.push(updates.file_name);
  }
  if (updates.thumbnail_path !== undefined) {
    updateFields.push('thumbnail_path = ?');
    values.push(updates.thumbnail_path);
  }
  if (updates.is_favorite !== undefined) {
    updateFields.push('is_favorite = ?');
    values.push(updates.is_favorite ? 1 : 0);
  }
  if (updates.duration !== undefined) {
    updateFields.push('duration = ?');
    values.push(updates.duration);
  }
  if (updates.width !== undefined) {
    updateFields.push('width = ?');
    values.push(updates.width);
  }
  if (updates.height !== undefined) {
    updateFields.push('height = ?');
    values.push(updates.height);
  }

  if (updateFields.length === 0) return;

  values.push(id);
  await db.execute(
    `UPDATE project_media SET ${updateFields.join(', ')} WHERE id = ?`,
    values
  );
}

export async function toggleFavorite(id: string): Promise<boolean> {
  if (!(await ensureTableExists())) return false;

  const db = await getDatabase();
  
  // Get current state
  const rows = await db.select<{ is_favorite: number }[]>(
    'SELECT is_favorite FROM project_media WHERE id = ?',
    [id]
  );
  
  if (rows.length === 0) return false;
  
  const newState = rows[0].is_favorite === 0;
  await db.execute(
    'UPDATE project_media SET is_favorite = ? WHERE id = ?',
    [newState ? 1 : 0, id]
  );
  
  return newState;
}

export async function recordMediaUsage(id: string): Promise<void> {
  if (!(await ensureTableExists())) return;

  const db = await getDatabase();
  const now = timestamp();

  await db.execute(
    'UPDATE project_media SET use_count = use_count + 1, last_used_at = ? WHERE id = ?',
    [now, id]
  );
}

export async function deleteProjectMedia(id: string): Promise<void> {
  if (!(await ensureTableExists())) return;

  const db = await getDatabase();
  await db.execute('DELETE FROM project_media WHERE id = ?', [id]);
}

export async function deleteAllProjectMedia(projectId: string): Promise<void> {
  if (!(await ensureTableExists())) return;

  const db = await getDatabase();
  await db.execute('DELETE FROM project_media WHERE project_id = ?', [projectId]);
}

// Check if media already exists in project (by file path)
export async function mediaExistsInProject(
  projectId: string,
  filePath: string
): Promise<boolean> {
  if (!(await ensureTableExists())) return false;

  const db = await getDatabase();
  const rows = await db.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM project_media WHERE project_id = ? AND file_path = ?',
    [projectId, filePath]
  );

  return (rows[0]?.count || 0) > 0;
}
