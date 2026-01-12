import { getDatabase, generateId, timestamp, getCurrentUserId } from './core';

// ==========================================
// Video Editor Types (Database Layer)
// ==========================================

export interface VideoEditorProject {
  id: string;
  name: string;
  description: string | null;
  thumbnail_path: string | null;
  total_duration: number;
  created_at: number;
  updated_at: number;
}

export interface VideoEditorSource {
  id: string;
  project_id: string;
  source_type: 'clip' | 'raw_video' | 'imported';
  source_id: string | null; // Reference to clips/raw_videos table (null for imported)
  source_path: string; // File path for preview/export
  source_name: string | null;
  source_thumbnail: string | null;
  source_duration: number | null; // Original duration of source
  start_time: number; // Position in timeline
  end_time: number; // End position in timeline
  trim_start: number; // Trim from source start (video)
  trim_end: number | null; // Trim from source end (null = use full duration)
  // J/L Cut support: Independent audio trim points
  audio_trim_start?: number | null; // Audio trim start (J-cut: earlier than video)
  audio_trim_end?: number | null; // Audio trim end (L-cut: later than video)
  order_index: number;
  track_index?: number;
  is_muted?: boolean;
  is_locked?: boolean;
  keyframes_data?: string; // JSON string of Keyframe[]
  speed?: number; // Playback speed multiplier (1.0 = normal, 0.5 = half speed, 2.0 = double speed)
  created_at: number;
}

export interface VideoEditorProjectWithSources extends VideoEditorProject {
  sources: VideoEditorSource[];
}

// ==========================================
// Video Editor Project CRUD Operations
// ==========================================

// Note: Tables are created via Tauri migrations (058_add_video_editor_projects.sql)

export async function createVideoEditorProject(
  name: string,
  description?: string
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();
  const userId = getCurrentUserId();

  await db.execute(
    `INSERT INTO video_editor_projects (id, name, description, thumbnail_path, total_duration, user_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, name, description || null, null, 0, userId, now, now]
  );

  return id;
}

export async function getVideoEditorProject(id: string): Promise<VideoEditorProject | null> {
  const db = await getDatabase();
  const result = await db.select<VideoEditorProject[]>(
    'SELECT * FROM video_editor_projects WHERE id = ?',
    [id]
  );
  return result[0] || null;
}

export async function getAllVideoEditorProjects(): Promise<VideoEditorProject[]> {
  const db = await getDatabase();
  const userId = getCurrentUserId();

  if (userId === null) {
    return await db.select<VideoEditorProject[]>(
      'SELECT * FROM video_editor_projects WHERE user_id IS NULL ORDER BY updated_at DESC'
    );
  }

  return await db.select<VideoEditorProject[]>(
    'SELECT * FROM video_editor_projects WHERE user_id = ? OR user_id IS NULL ORDER BY updated_at DESC',
    [userId]
  );
}

export async function updateVideoEditorProject(
  id: string,
  updates: Partial<{
    name: string;
    description: string | null;
    thumbnail_path: string | null;
    total_duration: number;
  }>
): Promise<void> {
  const db = await getDatabase();
  const now = timestamp();

  const updateFields: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) {
    updateFields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    updateFields.push('description = ?');
    values.push(updates.description);
  }
  if (updates.thumbnail_path !== undefined) {
    updateFields.push('thumbnail_path = ?');
    values.push(updates.thumbnail_path);
  }
  if (updates.total_duration !== undefined) {
    updateFields.push('total_duration = ?');
    values.push(updates.total_duration);
  }

  if (updateFields.length === 0) return;

  updateFields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await db.execute(
    `UPDATE video_editor_projects SET ${updateFields.join(', ')} WHERE id = ?`,
    values
  );
}

export async function deleteVideoEditorProject(id: string): Promise<void> {
  const db = await getDatabase();
  // Sources are deleted automatically via CASCADE
  await db.execute('DELETE FROM video_editor_projects WHERE id = ?', [id]);
}

// ==========================================
// Video Editor Source CRUD Operations
// ==========================================

export async function createVideoEditorSource(
  projectId: string,
  data: {
    sourceType: 'clip' | 'raw_video' | 'imported';
    sourceId?: string | null;
    sourcePath: string;
    sourceName?: string | null;
    sourceThumbnail?: string | null;
    sourceDuration?: number | null;
    startTime: number;
    endTime: number;
    trimStart?: number;
    trimEnd?: number | null;
    orderIndex: number;
    keyframesData?: string;
  }
): Promise<VideoEditorSource> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  // Ensure keyframes_data column exists before inserting
  await ensureKeyframesDataColumn();

  await db.execute(
    `INSERT INTO video_editor_sources 
     (id, project_id, source_type, source_id, source_path, source_name, source_thumbnail, 
      source_duration, start_time, end_time, trim_start, trim_end, order_index, keyframes_data, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      projectId,
      data.sourceType,
      data.sourceId || null,
      data.sourcePath,
      data.sourceName || null,
      data.sourceThumbnail || null,
      data.sourceDuration || null,
      data.startTime,
      data.endTime,
      data.trimStart || 0,
      data.trimEnd || null,
      data.orderIndex,
      data.keyframesData || null,
      now,
    ]
  );

  return {
    id,
    project_id: projectId,
    source_type: data.sourceType,
    source_id: data.sourceId || null,
    source_path: data.sourcePath,
    source_name: data.sourceName || null,
    source_thumbnail: data.sourceThumbnail || null,
    source_duration: data.sourceDuration || null,
    start_time: data.startTime,
    end_time: data.endTime,
    trim_start: data.trimStart || 0,
    trim_end: data.trimEnd || null,
    order_index: data.orderIndex,
    keyframes_data: data.keyframesData,
    created_at: now,
  };
}

export async function getVideoEditorSourcesByProjectId(
  projectId: string
): Promise<VideoEditorSource[]> {
  const db = await getDatabase();
  return await db.select<VideoEditorSource[]>(
    'SELECT * FROM video_editor_sources WHERE project_id = ? ORDER BY order_index ASC',
    [projectId]
  );
}

export async function getVideoEditorSource(id: string): Promise<VideoEditorSource | null> {
  const db = await getDatabase();
  const result = await db.select<VideoEditorSource[]>(
    'SELECT * FROM video_editor_sources WHERE id = ?',
    [id]
  );
  return result[0] || null;
}

// Check if track_index column exists, if not add it
let trackIndexColumnExists = false;
async function ensureTrackIndexColumn() {
  if (trackIndexColumnExists) return;

  const db = await getDatabase();
  try {
    // Try to query the column - if it fails, it doesn't exist
    await db.execute('SELECT track_index FROM video_editor_sources LIMIT 1', []);
    trackIndexColumnExists = true;
  } catch (error) {
    // Column doesn't exist, add it
    console.log('[video-editor-projects] Adding track_index column to video_editor_sources');
    try {
      await db.execute(
        'ALTER TABLE video_editor_sources ADD COLUMN track_index INTEGER DEFAULT 0',
        []
      );
      trackIndexColumnExists = true;
      console.log('[video-editor-projects] Successfully added track_index column');
    } catch (alterError) {
      console.error('[video-editor-projects] Failed to add track_index column:', alterError);
    }
  }
}

// Check if keyframes_data column exists, if not add it
let keyframesDataColumnExists = false;
async function ensureKeyframesDataColumn() {
  if (keyframesDataColumnExists) return;

  const db = await getDatabase();
  try {
    // Try to query the column - if it fails, it doesn't exist
    await db.execute('SELECT keyframes_data FROM video_editor_sources LIMIT 1', []);
    keyframesDataColumnExists = true;
  } catch (error) {
    // Column doesn't exist, add it
    console.log('[video-editor-projects] Adding keyframes_data column to video_editor_sources');
    try {
      await db.execute(
        'ALTER TABLE video_editor_sources ADD COLUMN keyframes_data TEXT DEFAULT NULL',
        []
      );
      keyframesDataColumnExists = true;
      console.log('[video-editor-projects] Successfully added keyframes_data column');
    } catch (alterError) {
      console.error('[video-editor-projects] Failed to add keyframes_data column:', alterError);
    }
  }
}

export async function updateVideoEditorSource(
  id: string,
  updates: Partial<{
    source_path: string;
    source_name: string | null;
    source_thumbnail: string | null;
    source_duration: number | null;
    start_time: number;
    end_time: number;
    trim_start: number;
    trim_end: number | null;
    // J/L Cut support
    audio_trim_start: number | null;
    audio_trim_end: number | null;
    order_index: number;
    track_index: number;
    audio_extracted: boolean;
    keyframes_data: string;
  }>
): Promise<void> {
  const db = await getDatabase();

  // Ensure track_index column exists before trying to update it
  if (updates.track_index !== undefined) {
    await ensureTrackIndexColumn();
  }

  const updateFields: string[] = [];
  const values: any[] = [];

  if (updates.source_path !== undefined) {
    updateFields.push('source_path = ?');
    values.push(updates.source_path);
  }
  if (updates.source_name !== undefined) {
    updateFields.push('source_name = ?');
    values.push(updates.source_name);
  }
  if (updates.source_thumbnail !== undefined) {
    updateFields.push('source_thumbnail = ?');
    values.push(updates.source_thumbnail);
  }
  if (updates.source_duration !== undefined) {
    updateFields.push('source_duration = ?');
    values.push(updates.source_duration);
  }
  if (updates.start_time !== undefined) {
    updateFields.push('start_time = ?');
    values.push(updates.start_time);
  }
  if (updates.end_time !== undefined) {
    updateFields.push('end_time = ?');
    values.push(updates.end_time);
  }
  if (updates.trim_start !== undefined) {
    updateFields.push('trim_start = ?');
    values.push(updates.trim_start);
  }
  if (updates.trim_end !== undefined) {
    updateFields.push('trim_end = ?');
    values.push(updates.trim_end);
  }
  if (updates.audio_trim_start !== undefined) {
    updateFields.push('audio_trim_start = ?');
    values.push(updates.audio_trim_start);
  }
  if (updates.audio_trim_end !== undefined) {
    updateFields.push('audio_trim_end = ?');
    values.push(updates.audio_trim_end);
  }
  if (updates.order_index !== undefined) {
    updateFields.push('order_index = ?');
    values.push(updates.order_index);
  }
  if (updates.track_index !== undefined && trackIndexColumnExists) {
    updateFields.push('track_index = ?');
    values.push(updates.track_index);
  }
  if (updates.audio_extracted !== undefined) {
    updateFields.push('audio_extracted = ?');
    values.push(updates.audio_extracted ? 1 : 0);
  }
  if (updates.keyframes_data !== undefined) {
    updateFields.push('keyframes_data = ?');
    values.push(updates.keyframes_data);
  }

  if (updateFields.length === 0) return;

  values.push(id);
  await db.execute(
    `UPDATE video_editor_sources SET ${updateFields.join(', ')} WHERE id = ?`,
    values
  );
}

export async function deleteVideoEditorSource(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM video_editor_sources WHERE id = ?', [id]);
}

export async function deleteAllVideoEditorSources(projectId: string): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM video_editor_sources WHERE project_id = ?', [projectId]);
}

/**
 * Split a video editor source at a specific time
 * Creates two new sources from one, similar to clip segment splitting
 */
export async function splitVideoEditorSource(
  projectId: string,
  sourceIndex: number,
  cutTime: number
): Promise<void> {
  const db = await getDatabase();

  // Get all sources for this project, ordered by order_index
  const sources = await getVideoEditorSourcesByProjectId(projectId);

  if (sourceIndex < 0 || sourceIndex >= sources.length) {
    throw new Error(`Invalid source index: ${sourceIndex}`);
  }

  const sourceToSplit = sources[sourceIndex];

  // Validate cut time is within source bounds
  if (cutTime <= sourceToSplit.start_time || cutTime >= sourceToSplit.end_time) {
    throw new Error(
      `Cut time ${cutTime} is outside source bounds [${sourceToSplit.start_time}, ${sourceToSplit.end_time}]`
    );
  }

  // Calculate the trim offset for the cut
  const sourceDuration = sourceToSplit.end_time - sourceToSplit.start_time;
  const trimDuration = sourceToSplit.trim_end
    ? sourceToSplit.trim_end - sourceToSplit.trim_start
    : (sourceToSplit.source_duration || sourceDuration) - sourceToSplit.trim_start;

  // Calculate where in the source video the cut happens
  const cutOffset = cutTime - sourceToSplit.start_time;
  const cutPercentage = cutOffset / sourceDuration;
  const trimCutPoint = sourceToSplit.trim_start + trimDuration * cutPercentage;

  // Update the original source to end at cut time
  await updateVideoEditorSource(sourceToSplit.id, {
    end_time: cutTime,
    trim_end: trimCutPoint,
  });

  // Create new source for the right side of the split
  const newSource = await createVideoEditorSource(projectId, {
    sourceType: sourceToSplit.source_type,
    sourceId: sourceToSplit.source_id,
    sourcePath: sourceToSplit.source_path,
    sourceName: sourceToSplit.source_name,
    sourceThumbnail: sourceToSplit.source_thumbnail,
    sourceDuration: sourceToSplit.source_duration,
    startTime: cutTime,
    endTime: sourceToSplit.end_time,
    trimStart: trimCutPoint,
    trimEnd: sourceToSplit.trim_end,
    orderIndex: sourceToSplit.order_index + 1,
  });

  // Update order_index for all sources after the split point
  for (let i = sourceIndex + 1; i < sources.length; i++) {
    await updateVideoEditorSource(sources[i].id, {
      order_index: sources[i].order_index + 1,
    });
  }

  console.log(
    `[splitVideoEditorSource] Split source ${sourceToSplit.id} at ${cutTime}s, created ${newSource.id}`
  );
}

// ==========================================
// Batch Operations
// ==========================================

export async function reorderVideoEditorSources(
  projectId: string,
  sourceIds: string[]
): Promise<void> {
  const db = await getDatabase();

  // Update order_index for each source
  for (let i = 0; i < sourceIds.length; i++) {
    await db.execute(
      'UPDATE video_editor_sources SET order_index = ? WHERE id = ? AND project_id = ?',
      [i, sourceIds[i], projectId]
    );
  }
}

export async function recalculateProjectDuration(projectId: string): Promise<number> {
  const sources = await getVideoEditorSourcesByProjectId(projectId);

  if (sources.length === 0) {
    await updateVideoEditorProject(projectId, { total_duration: 0 });
    return 0;
  }

  // Calculate total duration from all sources
  let totalDuration = 0;
  for (const source of sources) {
    totalDuration += source.end_time - source.start_time;
  }

  await updateVideoEditorProject(projectId, { total_duration: totalDuration });
  return totalDuration;
}

// ==========================================
// Project with Sources (for full load)
// ==========================================

export async function getVideoEditorProjectWithSources(
  projectId: string
): Promise<VideoEditorProjectWithSources | null> {
  const project = await getVideoEditorProject(projectId);
  if (!project) return null;

  const sources = await getVideoEditorSourcesByProjectId(projectId);

  return {
    ...project,
    sources,
  };
}

// ==========================================
// Utility Functions
// ==========================================

export async function hasVideoEditorSources(projectId: string): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM video_editor_sources WHERE project_id = ?',
    [projectId]
  );
  return (result[0]?.count || 0) > 0;
}

export async function getVideoEditorSourceCount(projectId: string): Promise<number> {
  const db = await getDatabase();
  const result = await db.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM video_editor_sources WHERE project_id = ?',
    [projectId]
  );
  return result[0]?.count || 0;
}

// Calculate the next start_time for adding a new source at the end
export async function getNextSourceStartTime(projectId: string): Promise<number> {
  const sources = await getVideoEditorSourcesByProjectId(projectId);
  if (sources.length === 0) return 0;

  // Find the end time of the last source
  let maxEndTime = 0;
  for (const source of sources) {
    if (source.end_time > maxEndTime) {
      maxEndTime = source.end_time;
    }
  }

  return maxEndTime;
}

/**
 * Find all video editor projects that contain a specific clip as a source.
 * Used to check if a clip has already been opened in the video editor before.
 */
export async function getVideoEditorProjectsForClip(clipId: string): Promise<VideoEditorProject[]> {
  const db = await getDatabase();

  // Find all projects that have this clip as a source
  const projects = await db.select<VideoEditorProject[]>(
    `SELECT DISTINCT p.* FROM video_editor_projects p
     INNER JOIN video_editor_sources s ON s.project_id = p.id
     WHERE s.source_id = ? AND s.source_type = 'clip'
     ORDER BY p.updated_at DESC`,
    [clipId]
  );

  return projects;
}
