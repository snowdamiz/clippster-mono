import { getDatabase, timestamp, generateId, getCurrentUserId } from './core';
import type { WatermarkSettings } from './types';

/**
 * Watermark preset database type
 */
export interface WatermarkPreset {
  id: string;
  name: string;
  description: string | null;
  watermark_id: string | null;
  position_x: number;
  position_y: number;
  opacity: number;
  scale: number;
  created_at: number;
  updated_at: number;
}

/**
 * Create a new watermark preset
 */
export async function createWatermarkPreset(
  name: string,
  description: string | null,
  settings: WatermarkSettings
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();
  const userId = getCurrentUserId();

  await db.execute(
    `INSERT INTO watermark_presets (
      id, name, description, watermark_id,
      position_x, position_y, opacity, scale,
      user_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      name,
      description,
      settings.watermarkId,
      settings.positionX,
      settings.positionY,
      settings.opacity,
      settings.scale,
      userId,
      now,
      now,
    ]
  );

  return id;
}

/**
 * Get a watermark preset by ID
 */
export async function getWatermarkPreset(id: string): Promise<WatermarkPreset | null> {
  const db = await getDatabase();
  const result = await db.select<WatermarkPreset[]>(
    'SELECT * FROM watermark_presets WHERE id = ?',
    [id]
  );

  return result.length > 0 ? result[0] : null;
}

/**
 * Get all watermark presets
 */
export async function getAllWatermarkPresets(): Promise<WatermarkPreset[]> {
  const db = await getDatabase();
  const userId = getCurrentUserId();

  if (userId === null) {
    return await db.select<WatermarkPreset[]>(
      'SELECT * FROM watermark_presets WHERE user_id IS NULL ORDER BY created_at DESC'
    );
  }

  return await db.select<WatermarkPreset[]>(
    'SELECT * FROM watermark_presets WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC',
    [userId]
  );
}

/**
 * Update a watermark preset
 */
export async function updateWatermarkPreset(
  id: string,
  name?: string,
  description?: string | null,
  settings?: Partial<WatermarkSettings>
): Promise<void> {
  const db = await getDatabase();
  const now = timestamp();

  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }

  if (description !== undefined) {
    updates.push('description = ?');
    values.push(description);
  }

  if (settings) {
    if (settings.watermarkId !== undefined) {
      updates.push('watermark_id = ?');
      values.push(settings.watermarkId);
    }
    if (settings.positionX !== undefined) {
      updates.push('position_x = ?');
      values.push(settings.positionX);
    }
    if (settings.positionY !== undefined) {
      updates.push('position_y = ?');
      values.push(settings.positionY);
    }
    if (settings.opacity !== undefined) {
      updates.push('opacity = ?');
      values.push(settings.opacity);
    }
    if (settings.scale !== undefined) {
      updates.push('scale = ?');
      values.push(settings.scale);
    }
  }

  updates.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await db.execute(`UPDATE watermark_presets SET ${updates.join(', ')} WHERE id = ?`, values);
}

/**
 * Delete a watermark preset
 */
export async function deleteWatermarkPreset(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM watermark_presets WHERE id = ?', [id]);
}

/**
 * Convert a WatermarkPreset to WatermarkSettings
 */
export function presetToWatermarkSettings(preset: WatermarkPreset): WatermarkSettings {
  return {
    enabled: true,
    watermarkId: preset.watermark_id,
    positionX: preset.position_x,
    positionY: preset.position_y,
    opacity: preset.opacity,
    scale: preset.scale,
  };
}
