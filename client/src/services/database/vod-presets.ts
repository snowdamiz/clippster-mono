import { getDatabase, timestamp, generateId, getCurrentUserId } from './core';
import type { ManualFramingConfig, WatermarkSettings, LayoutOverlay, VodPreset, ActiveVodPresetConfig } from '../../types';

// Database row type (snake_case from SQLite)
interface VodPresetRow {
  id: string;
  name: string;
  creator_profile_id: string | null;
  target_aspect_ratio: string;
  framing_config: string | null;
  layout_overlays: string | null;
  watermark_mode: string;
  custom_watermark_settings: string | null;
  user_id: string | null;
  created_at: number;
  updated_at: number;
}

function rowToVodPreset(row: VodPresetRow): VodPreset {
  return {
    id: row.id,
    name: row.name,
    creatorProfileId: row.creator_profile_id,
    targetAspectRatio: row.target_aspect_ratio,
    framingConfig: row.framing_config ? JSON.parse(row.framing_config) : null,
    layoutOverlays: row.layout_overlays ? JSON.parse(row.layout_overlays) : [],
    watermarkMode: row.watermark_mode as 'creator' | 'custom' | 'none',
    customWatermarkSettings: row.custom_watermark_settings ? JSON.parse(row.custom_watermark_settings) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createVodPreset(preset: {
  name: string;
  creatorProfileId?: string | null;
  targetAspectRatio: string;
  framingConfig?: ManualFramingConfig | null;
  layoutOverlays?: LayoutOverlay[];
  watermarkMode?: 'creator' | 'custom' | 'none';
  customWatermarkSettings?: WatermarkSettings | null;
}): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();
  const userId = getCurrentUserId();

  await db.execute(
    `INSERT INTO vod_presets (
      id, name, creator_profile_id, target_aspect_ratio,
      framing_config, layout_overlays, watermark_mode,
      custom_watermark_settings, user_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      preset.name,
      preset.creatorProfileId || null,
      preset.targetAspectRatio,
      preset.framingConfig ? JSON.stringify(preset.framingConfig) : null,
      preset.layoutOverlays ? JSON.stringify(preset.layoutOverlays) : null,
      preset.watermarkMode || 'none',
      preset.customWatermarkSettings ? JSON.stringify(preset.customWatermarkSettings) : null,
      userId,
      now,
      now,
    ]
  );

  return id;
}

export async function updateVodPreset(
  id: string,
  updates: {
    name?: string;
    creatorProfileId?: string | null;
    targetAspectRatio?: string;
    framingConfig?: ManualFramingConfig | null;
    layoutOverlays?: LayoutOverlay[];
    watermarkMode?: 'creator' | 'custom' | 'none';
    customWatermarkSettings?: WatermarkSettings | null;
  }
): Promise<void> {
  const db = await getDatabase();
  const now = timestamp();

  const setClauses: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    values.push(updates.name);
  }
  if (updates.creatorProfileId !== undefined) {
    setClauses.push('creator_profile_id = ?');
    values.push(updates.creatorProfileId);
  }
  if (updates.targetAspectRatio !== undefined) {
    setClauses.push('target_aspect_ratio = ?');
    values.push(updates.targetAspectRatio);
  }
  if (updates.framingConfig !== undefined) {
    setClauses.push('framing_config = ?');
    values.push(updates.framingConfig ? JSON.stringify(updates.framingConfig) : null);
  }
  if (updates.layoutOverlays !== undefined) {
    setClauses.push('layout_overlays = ?');
    values.push(JSON.stringify(updates.layoutOverlays));
  }
  if (updates.watermarkMode !== undefined) {
    setClauses.push('watermark_mode = ?');
    values.push(updates.watermarkMode);
  }
  if (updates.customWatermarkSettings !== undefined) {
    setClauses.push('custom_watermark_settings = ?');
    values.push(updates.customWatermarkSettings ? JSON.stringify(updates.customWatermarkSettings) : null);
  }

  setClauses.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await db.execute(`UPDATE vod_presets SET ${setClauses.join(', ')} WHERE id = ?`, values);
}

export async function deleteVodPreset(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM vod_presets WHERE id = ?', [id]);
}

export async function getVodPreset(id: string): Promise<VodPreset | null> {
  const db = await getDatabase();
  const rows = await db.select<VodPresetRow[]>('SELECT * FROM vod_presets WHERE id = ?', [id]);
  return rows.length > 0 ? rowToVodPreset(rows[0]) : null;
}

export async function getAllVodPresets(): Promise<VodPreset[]> {
  const db = await getDatabase();
  const userId = getCurrentUserId();

  if (userId === null) {
    const rows = await db.select<VodPresetRow[]>(
      'SELECT * FROM vod_presets WHERE user_id IS NULL ORDER BY updated_at DESC'
    );
    return rows.map(rowToVodPreset);
  }

  const rows = await db.select<VodPresetRow[]>(
    'SELECT * FROM vod_presets WHERE user_id = ? OR user_id IS NULL ORDER BY updated_at DESC',
    [userId]
  );
  return rows.map(rowToVodPreset);
}

export async function getVodPresetsByCreator(creatorProfileId: string): Promise<VodPreset[]> {
  const db = await getDatabase();
  const rows = await db.select<VodPresetRow[]>(
    'SELECT * FROM vod_presets WHERE creator_profile_id = ? ORDER BY updated_at DESC',
    [creatorProfileId]
  );
  return rows.map(rowToVodPreset);
}

export async function getVodPresetsUnlinked(): Promise<VodPreset[]> {
  const db = await getDatabase();
  const userId = getCurrentUserId();

  if (userId === null) {
    const rows = await db.select<VodPresetRow[]>(
      'SELECT * FROM vod_presets WHERE creator_profile_id IS NULL AND user_id IS NULL ORDER BY updated_at DESC'
    );
    return rows.map(rowToVodPreset);
  }

  const rows = await db.select<VodPresetRow[]>(
    'SELECT * FROM vod_presets WHERE creator_profile_id IS NULL AND (user_id = ? OR user_id IS NULL) ORDER BY updated_at DESC',
    [userId]
  );
  return rows.map(rowToVodPreset);
}

export async function setProjectVodPreset(
  projectId: string,
  presetId: string | null,
  configSnapshot: ActiveVodPresetConfig
): Promise<void> {
  const db = await getDatabase();
  const now = timestamp();

  await db.execute(
    'UPDATE projects SET active_vod_preset_id = ?, active_vod_preset_config = ?, updated_at = ? WHERE id = ?',
    [presetId, JSON.stringify(configSnapshot), now, projectId]
  );
}

export async function clearProjectVodPreset(projectId: string): Promise<void> {
  const db = await getDatabase();
  const now = timestamp();

  await db.execute(
    'UPDATE projects SET active_vod_preset_id = NULL, active_vod_preset_config = NULL, updated_at = ? WHERE id = ?',
    [now, projectId]
  );
}

export async function getProjectVodPresetConfig(
  projectId: string
): Promise<ActiveVodPresetConfig | null> {
  const db = await getDatabase();
  const rows = await db.select<{ active_vod_preset_config: string | null }[]>(
    'SELECT active_vod_preset_config FROM projects WHERE id = ?',
    [projectId]
  );

  if (rows.length === 0 || !rows[0].active_vod_preset_config) {
    return null;
  }

  try {
    return JSON.parse(rows[0].active_vod_preset_config) as ActiveVodPresetConfig;
  } catch {
    return null;
  }
}
