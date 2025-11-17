import { getDatabase, timestamp, generateId } from './core';
import type { RawVideo } from './types';

// RawVideo queries
export async function createRawVideo(
  filePath: string,
  options?: {
    projectId?: string;
    originalFilename?: string;
    thumbnailPath?: string;
    duration?: number;
    width?: number;
    height?: number;
    frameRate?: number;
    codec?: string;
    fileSize?: number;
    // Segment tracking options
    sourceClipId?: string;
    sourceMintId?: string;
    segmentNumber?: number;
    isSegment?: boolean;
    segmentStartTime?: number;
    segmentEndTime?: number;
  }
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  try {
    await db.execute(
      'INSERT INTO raw_videos (id, project_id, file_path, original_filename, thumbnail_path, duration, width, height, frame_rate, codec, file_size, created_at, updated_at, source_clip_id, source_mint_id, segment_number, is_segment, segment_start_time, segment_end_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        options?.projectId || null,
        filePath,
        options?.originalFilename || null,
        options?.thumbnailPath || null,
        options?.duration || null,
        options?.width || null,
        options?.height || null,
        options?.frameRate || null,
        options?.codec || null,
        options?.fileSize || null,
        now,
        now,
        options?.sourceClipId || null,
        options?.sourceMintId || null,
        options?.segmentNumber || null,
        options?.isSegment || false,
        options?.segmentStartTime || null,
        options?.segmentEndTime || null,
      ]
    );

    return id;
  } catch (error) {
    throw error;
  }
}

export async function getAllRawVideos(): Promise<RawVideo[]> {
  const db = await getDatabase();
  return await db.select<RawVideo[]>('SELECT * FROM raw_videos ORDER BY created_at DESC');
}

// Check if segment tracking columns exist in the database
async function checkSegmentTrackingExists(): Promise<boolean> {
  try {
    const db = await getDatabase();
    // Try to query one of the new columns - if it fails, the columns don't exist
    await db.execute('SELECT segment_number FROM raw_videos LIMIT 1');
    return true;
  } catch (error) {
    return false;
  }
}

// Get the next segment number for a given clip
export async function getNextSegmentNumber(sourceClipId: string): Promise<number> {
  // First check if the segment tracking columns exist
  const columnsExist = await checkSegmentTrackingExists();
  if (!columnsExist) {
    return 1;
  }

  try {
    const db = await getDatabase();

    const result = await db.select<{ max_segment: number | null }[]>(
      'SELECT MAX(segment_number) as max_segment FROM raw_videos WHERE source_clip_id = ? AND (is_segment = TRUE OR is_segment = "true" OR is_segment = 1)',
      [sourceClipId]
    );

    const maxSegment = result[0]?.max_segment || 0;
    return maxSegment + 1;
  } catch (error) {
    return 1;
  }
}

export async function getRawVideo(id: string): Promise<RawVideo | null> {
  const db = await getDatabase();
  const result = await db.select<RawVideo[]>('SELECT * FROM raw_videos WHERE id = ?', [id]);
  return result[0] || null;
}

export async function getRawVideosByProjectId(projectId: string): Promise<RawVideo[]> {
  const db = await getDatabase();
  return await db.select<RawVideo[]>(
    'SELECT * FROM raw_videos WHERE project_id = ? ORDER BY created_at DESC',
    [projectId]
  );
}

export async function getRawVideoByPath(filePath: string): Promise<RawVideo | null> {
  const db = await getDatabase();

  // Try exact match first
  let result = await db.select<RawVideo[]>('SELECT * FROM raw_videos WHERE file_path = ?', [
    filePath,
  ]);
  if (result.length > 0) {
    return result[0];
  }

  // If no exact match, try normalized paths for different formats
  const normalizedInput = filePath.replace(/\\/g, '/').replace(/^file:\/\//, '');

  // Try finding with different path formats
  const queries = [
    'SELECT * FROM raw_videos WHERE file_path = ?',
    'SELECT * FROM raw_videos WHERE REPLACE(file_path, "\\", "/") = ?',
    'SELECT * FROM raw_videos WHERE REPLACE(REPLACE(file_path, "\\", "/"), "file://", "") = ?',
    'SELECT * FROM raw_videos WHERE REPLACE(file_path, "/", "\\") = ?',
  ];

  for (const query of queries) {
    try {
      result = await db.select<RawVideo[]>(query, [normalizedInput]);
      if (result.length > 0) {
        console.log(`[getRawVideoByPath] Found match using query: ${query}`);
        return result[0];
      }
    } catch (error) {
      console.warn(`[getRawVideoByPath] Query failed: ${query}`, error);
    }
  }

  // Final fallback: try finding videos where the basename matches
  const inputBasename = filePath.split(/[\/\\]/).pop();
  if (inputBasename) {
    result = await db.select<RawVideo[]>(
      'SELECT * FROM raw_videos WHERE original_filename = ? OR file_path LIKE ?',
      [inputBasename, `%/${inputBasename}`]
    );
    if (result.length > 0) {
      console.log(`[getRawVideoByPath] Found match using basename: ${inputBasename}`);
      return result[0];
    }
  }

  return null;
}

export async function updateRawVideo(
  id: string,
  updates: Partial<{
    project_id?: string | null;
    file_path?: string;
    original_filename?: string;
    thumbnail_path?: string;
    duration?: number;
    width?: number;
    height?: number;
    frame_rate?: number;
    codec?: string;
    file_size?: number;
    original_project_id?: string | null;
  }>
): Promise<void> {
  const db = await getDatabase();
  const dbUpdates: string[] = [];
  const values: any[] = [];

  if (updates.project_id !== undefined) {
    dbUpdates.push('project_id = ?');
    values.push(updates.project_id);
  }

  if (updates.file_path !== undefined) {
    dbUpdates.push('file_path = ?');
    values.push(updates.file_path);
  }

  if (updates.original_filename !== undefined) {
    dbUpdates.push('original_filename = ?');
    values.push(updates.original_filename);
  }

  if (updates.thumbnail_path !== undefined) {
    dbUpdates.push('thumbnail_path = ?');
    values.push(updates.thumbnail_path);
  }

  if (updates.duration !== undefined) {
    dbUpdates.push('duration = ?');
    values.push(updates.duration);
  }

  if (updates.width !== undefined) {
    dbUpdates.push('width = ?');
    values.push(updates.width);
  }

  if (updates.height !== undefined) {
    dbUpdates.push('height = ?');
    values.push(updates.height);
  }

  if (updates.frame_rate !== undefined) {
    dbUpdates.push('frame_rate = ?');
    values.push(updates.frame_rate);
  }

  if (updates.codec !== undefined) {
    dbUpdates.push('codec = ?');
    values.push(updates.codec);
  }

  if (updates.file_size !== undefined) {
    dbUpdates.push('file_size = ?');
    values.push(updates.file_size);
  }

  if (updates.original_project_id !== undefined) {
    dbUpdates.push('original_project_id = ?');
    values.push(updates.original_project_id);
  }

  if (dbUpdates.length === 0) return;

  dbUpdates.push('updated_at = ?');
  values.push(timestamp());
  values.push(id);

  await db.execute(`UPDATE raw_videos SET ${dbUpdates.join(', ')} WHERE id = ?`, values);
}

export async function deleteRawVideo(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM raw_videos WHERE id = ?', [id]);
}

export async function hasClipsReferencingRawVideo(rawVideoId: string): Promise<boolean> {
  // Check if any clips reference this raw video through their project relationship
  // Note: Deleting a raw video does NOT delete the clips - it just sets their raw_video_id to NULL
  const db = await getDatabase();
  const result = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count
     FROM clips c
     JOIN projects p ON c.project_id = p.id
     JOIN raw_videos rv ON p.id = rv.project_id
     WHERE rv.id = ?`,
    [rawVideoId]
  );
  return (result[0]?.count || 0) > 0;
}
