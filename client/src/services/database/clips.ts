import { getDatabase, generateId, timestamp, getCurrentUserId } from './core';
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
    thumbnailPath?: string;
    campaignId?: number;
  }
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();
  const userId = getCurrentUserId();

  await db.execute(
    'INSERT INTO clips (id, project_id, name, file_path, built_thumbnail_path, duration, start_time, end_time, order_index, intro_id, outro_id, campaign_id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      id,
      projectId,
      options?.name || null,
      filePath,
      options?.thumbnailPath || null,
      options?.duration || null,
      options?.startTime || null,
      options?.endTime || null,
      options?.orderIndex || null,
      options?.introId || null,
      options?.outroId || null,
      options?.campaignId || null,
      userId,
      now,
      now,
    ]
  );

  return id;
}

export async function getClip(id: string): Promise<Clip | null> {
  const db = await getDatabase();
  const result = await db.select<Clip[]>('SELECT * FROM clips WHERE id = ?', [id]);
  return result[0] || null;
}

export async function getClipCampaignId(clipId: string): Promise<number | null> {
  const db = await getDatabase();
  const result = await db.select<{ campaign_id: number | null }[]>(
    'SELECT campaign_id FROM clips WHERE id = ?',
    [clipId]
  );
  return result[0]?.campaign_id || null;
}

export async function getProjectCampaignId(projectId: string): Promise<number | null> {
  const db = await getDatabase();
  const result = await db.select<{ campaign_id: number | null }[]>(
    'SELECT campaign_id FROM clips WHERE project_id = ? AND campaign_id IS NOT NULL LIMIT 1',
    [projectId]
  );
  return result[0]?.campaign_id || null;
}

export async function getAllClips(): Promise<Clip[]> {
  const db = await getDatabase();
  const userId = getCurrentUserId();

  if (userId === null) {
    return await db.select<Clip[]>(
      'SELECT * FROM clips ORDER BY created_at DESC'
    );
  }

  let clips = await db.select<Clip[]>(
    'SELECT * FROM clips WHERE (CAST(user_id AS INTEGER) = ? OR user_id IS NULL) ORDER BY created_at DESC',
    [userId]
  );
  if (clips.length === 0) {
    const total = await db.select<any[]>('SELECT COUNT(*) as cnt FROM clips');
    if (total[0]?.cnt > 0) {
      clips = await db.select<Clip[]>('SELECT * FROM clips ORDER BY created_at DESC');
    }
  }
  return clips;
}

export async function getGeneratedClips(): Promise<Clip[]> {
  const db = await getDatabase();
  const userId = getCurrentUserId();

  if (userId === null) {
    return await db.select<Clip[]>(
      'SELECT * FROM clips WHERE status = ? ORDER BY created_at DESC',
      ['generated']
    );
  }

  let clips = await db.select<Clip[]>(
    'SELECT * FROM clips WHERE status = ? AND (CAST(user_id AS INTEGER) = ? OR user_id IS NULL) ORDER BY created_at DESC',
    ['generated', userId]
  );
  if (clips.length === 0) {
    const total = await db.select<any[]>('SELECT COUNT(*) as cnt FROM clips WHERE status = ?', ['generated']);
    if (total[0]?.cnt > 0) {
      clips = await db.select<Clip[]>('SELECT * FROM clips WHERE status = ? ORDER BY created_at DESC', ['generated']);
    }
  }
  return clips;
}

export async function getDetectedClips(): Promise<Clip[]> {
  const db = await getDatabase();
  const userId = getCurrentUserId();

  if (userId === null) {
    return await db.select<Clip[]>(
      'SELECT * FROM clips WHERE status = ? ORDER BY created_at DESC',
      ['detected']
    );
  }

  let clips = await db.select<Clip[]>(
    'SELECT * FROM clips WHERE status = ? AND (CAST(user_id AS INTEGER) = ? OR user_id IS NULL) ORDER BY created_at DESC',
    ['detected', userId]
  );
  if (clips.length === 0) {
    const total = await db.select<any[]>('SELECT COUNT(*) as cnt FROM clips WHERE status = ?', ['detected']);
    if (total[0]?.cnt > 0) {
      clips = await db.select<Clip[]>('SELECT * FROM clips WHERE status = ? ORDER BY created_at DESC', ['detected']);
    }
  }
  return clips;
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

/**
 * Update subtitle settings for a clip
 */
export async function updateClipSubtitleSettings(
  clipId: string,
  enabled: boolean,
  presetId: string | null
): Promise<void> {
  const db = await getDatabase();
  const now = timestamp();

  // Ensure subtitle columns exist
  try {
    const columnResult = await db.select<{ name: string }[]>('PRAGMA table_info(clips)');
    const columns = columnResult.map((col) => col.name);

    if (!columns.includes('subtitle_enabled')) {
      await db.execute('ALTER TABLE clips ADD COLUMN subtitle_enabled INTEGER DEFAULT 0');
    }

    if (!columns.includes('subtitle_preset_id')) {
      await db.execute('ALTER TABLE clips ADD COLUMN subtitle_preset_id TEXT');
    }
  } catch (e) {
    console.warn('[Clips] Failed to check/add subtitle columns:', e);
  }

  await db.execute(
    'UPDATE clips SET subtitle_enabled = ?, subtitle_preset_id = ?, updated_at = ? WHERE id = ?',
    [enabled ? 1 : 0, presetId, now, clipId]
  );
}

/**
 * Update subtitle settings for multiple clips
 */
export async function updateMultipleClipsSubtitleSettings(
  clipIds: string[],
  enabled: boolean,
  presetId: string | null
): Promise<void> {
  const db = await getDatabase();
  const now = timestamp();

  // Ensure subtitle columns exist
  try {
    const columnResult = await db.select<{ name: string }[]>('PRAGMA table_info(clips)');
    const columns = columnResult.map((col) => col.name);

    if (!columns.includes('subtitle_enabled')) {
      await db.execute('ALTER TABLE clips ADD COLUMN subtitle_enabled INTEGER DEFAULT 0');
    }

    if (!columns.includes('subtitle_preset_id')) {
      await db.execute('ALTER TABLE clips ADD COLUMN subtitle_preset_id TEXT');
    }

    if (!columns.includes('subtitle_position_x')) {
      await db.execute('ALTER TABLE clips ADD COLUMN subtitle_position_x REAL');
    }

    if (!columns.includes('subtitle_position_y')) {
      await db.execute('ALTER TABLE clips ADD COLUMN subtitle_position_y REAL');
    }
  } catch (e) {
    console.warn('[Clips] Failed to check/add subtitle columns:', e);
  }

  // Ensure subtitle_position_width column exists
  try {
    const columnResult2 = await db.select<{ name: string }[]>('PRAGMA table_info(clips)');
    const columns2 = columnResult2.map((col) => col.name);
    if (!columns2.includes('subtitle_position_width')) {
      await db.execute('ALTER TABLE clips ADD COLUMN subtitle_position_width REAL');
    }
  } catch (e) {
    console.warn('[Clips] Failed to check/add subtitle_position_width column:', e);
  }

  // Update all clips in a transaction
  for (const clipId of clipIds) {
    await db.execute(
      'UPDATE clips SET subtitle_enabled = ?, subtitle_preset_id = ?, updated_at = ? WHERE id = ?',
      [enabled ? 1 : 0, presetId, now, clipId]
    );
  }
}

export async function updateClipSubtitlePosition(
  clipId: string,
  positionX: number,
  positionY: number,
  width?: number
): Promise<void> {
  const db = await getDatabase();
  const now = timestamp();

  // Ensure columns exist
  try {
    const cols = await db.select<{ name: string }[]>('PRAGMA table_info(clips)');
    const colNames = cols.map((c) => c.name);
    if (!colNames.includes('subtitle_position_x'))
      await db.execute('ALTER TABLE clips ADD COLUMN subtitle_position_x REAL');
    if (!colNames.includes('subtitle_position_y'))
      await db.execute('ALTER TABLE clips ADD COLUMN subtitle_position_y REAL');
    if (!colNames.includes('subtitle_position_width'))
      await db.execute('ALTER TABLE clips ADD COLUMN subtitle_position_width REAL');
  } catch (e) {
    console.warn('[Clips] Failed to check/add subtitle position columns:', e);
  }

  await db.execute(
    'UPDATE clips SET subtitle_position_x = ?, subtitle_position_y = ?, subtitle_position_width = ?, updated_at = ? WHERE id = ?',
    [positionX, positionY, width ?? null, now, clipId]
  );
}

/**
 * Update full subtitle settings for a clip (stores complete settings as JSON)
 * This preserves all customizations made to subtitle styling, animation, colors, etc.
 */
export async function updateClipFullSubtitleSettings(
  clipId: string,
  settings: any // SubtitleSettings type from @/types
): Promise<void> {
  const db = await getDatabase();
  const now = timestamp();

  // Ensure subtitle_settings column exists
  try {
    const cols = await db.select<{ name: string }[]>('PRAGMA table_info(clips)');
    const colNames = cols.map((c) => c.name);
    if (!colNames.includes('subtitle_settings')) {
      await db.execute('ALTER TABLE clips ADD COLUMN subtitle_settings TEXT');
      console.log('[Clips] Added subtitle_settings column to clips table');
    }
  } catch (e) {
    console.warn('[Clips] Failed to check/add subtitle_settings column:', e);
  }

  // Store the full settings as JSON
  const settingsJson = JSON.stringify(settings);
  await db.execute(
    'UPDATE clips SET subtitle_enabled = ?, subtitle_preset_id = ?, subtitle_settings = ?, updated_at = ? WHERE id = ?',
    [settings.enabled ? 1 : 0, settings.selectedPresetId ?? null, settingsJson, now, clipId]
  );
  
  console.log(`[Clips] Saved full subtitle settings for clip ${clipId}:`, settings);
  
  // VERIFY: Read back what was actually saved to the database
  const verifyResult = await db.select<any[]>('SELECT subtitle_settings FROM clips WHERE id = ?', [clipId]);
  if (verifyResult && verifyResult[0]) {
    console.log('[Clips] VERIFY - Data actually in database:', {
      hasSubtitleSettings: !!verifyResult[0].subtitle_settings,
      length: verifyResult[0].subtitle_settings?.length,
      preview: verifyResult[0].subtitle_settings?.substring(0, 100)
    });
  } else {
    console.error('[Clips] VERIFY - Could not read back clip data!');
  }
}

// Backward-compatible alias used by ClipBuildSettingsDialog dynamic import
export { updateClipFullSubtitleSettings as saveSubtitleSettings };

