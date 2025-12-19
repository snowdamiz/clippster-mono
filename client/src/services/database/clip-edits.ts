import { getDatabase, generateId, timestamp } from './core';

// ==========================================
// Clip Edit Types (Database Layer)
// ==========================================

export interface ClipEditRecord {
  id: string;
  clip_id: string;
  edit_data: string; // JSON string containing all edit settings
  created_at: number;
  updated_at: number;
}

export interface ClipAudioTrackRecord {
  id: string;
  clip_edit_id: string;
  file_path: string;
  name: string;
  start_time: number;
  end_time: number;
  volume: number;
  fade_in: number;
  fade_out: number;
  track_order: number;
  is_muted: number;
  is_solo: number;
  created_at: number;
}

export interface ClipTextOverlayRecord {
  id: string;
  clip_edit_id: string;
  text: string;
  start_time: number;
  end_time: number;
  position_x: number;
  position_y: number;
  style_data: string; // JSON string
  per_ratio_configs_data?: string; // JSON string for per-aspect-ratio configurations
  preview_height?: number; // Height of preview container for proper font scaling
  animation: string;
  created_at: number;
}

export interface ClipStickerRecord {
  id: string;
  clip_edit_id: string;
  sticker_path: string;
  sticker_type: string;
  start_time: number;
  end_time: number;
  position_x: number;
  position_y: number;
  scale: number;
  rotation: number;
  animation: string;
  per_ratio_configs_data?: string; // JSON string for per-aspect-ratio configurations
  created_at: number;
}

export interface ClipEffectRecord {
  id: string;
  clip_edit_id: string;
  effect_type: string;
  start_time: number;
  end_time: number;
  settings: string; // JSON string
  created_at: number;
}

export interface ClipWatermarkRecord {
  id: string;
  clip_edit_id: string;
  watermark_id: string; // Reference to watermark_images table
  watermark_path: string; // File path for rendering
  preview_url?: string; // Data URL for preview display
  start_time: number;
  end_time: number;
  position_x: number;
  position_y: number;
  scale: number;
  opacity: number;
  per_ratio_configs_data?: string; // JSON string for per-aspect-ratio configurations
  created_at: number;
}

// ==========================================
// Clip Edit CRUD Operations
// ==========================================

export async function createClipEdit(
  clipId: string,
  editData: Record<string, any>
): Promise<ClipEditRecord> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  await db.execute(
    `INSERT INTO clip_edits (id, clip_id, edit_data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, clipId, JSON.stringify(editData), now, now]
  );

  return {
    id,
    clip_id: clipId,
    edit_data: JSON.stringify(editData),
    created_at: now,
    updated_at: now,
  };
}

export async function getClipEditByClipId(clipId: string): Promise<ClipEditRecord | null> {
  const db = await getDatabase();
  const result = await db.select<ClipEditRecord[]>(
    `SELECT * FROM clip_edits WHERE clip_id = ? ORDER BY updated_at DESC LIMIT 1`,
    [clipId]
  );
  return result.length > 0 ? result[0] : null;
}

export async function updateClipEdit(
  id: string,
  editData: Record<string, any>
): Promise<ClipEditRecord | null> {
  const db = await getDatabase();
  const now = timestamp();

  await db.execute(`UPDATE clip_edits SET edit_data = ?, updated_at = ? WHERE id = ?`, [
    JSON.stringify(editData),
    now,
    id,
  ]);

  const result = await db.select<ClipEditRecord[]>(`SELECT * FROM clip_edits WHERE id = ?`, [id]);
  return result.length > 0 ? result[0] : null;
}

export async function deleteClipEdit(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(`DELETE FROM clip_edits WHERE id = ?`, [id]);
}

// ==========================================
// Audio Track Operations
// ==========================================

export async function createAudioTrack(
  clipEditId: string,
  data: Partial<ClipAudioTrackRecord>
): Promise<ClipAudioTrackRecord> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  await db.execute(
    `INSERT INTO clip_audio_tracks 
     (id, clip_edit_id, file_path, name, start_time, end_time, volume, fade_in, fade_out, track_order, is_muted, is_solo, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      clipEditId,
      data.file_path || '',
      data.name || 'Audio Track',
      data.start_time || 0,
      data.end_time || 0,
      data.volume ?? 1.0,
      data.fade_in || 0,
      data.fade_out || 0,
      data.track_order || 0,
      data.is_muted || 0,
      data.is_solo || 0,
      now,
    ]
  );

  return {
    id,
    clip_edit_id: clipEditId,
    file_path: data.file_path || '',
    name: data.name || 'Audio Track',
    start_time: data.start_time || 0,
    end_time: data.end_time || 0,
    volume: data.volume ?? 1.0,
    fade_in: data.fade_in || 0,
    fade_out: data.fade_out || 0,
    track_order: data.track_order || 0,
    is_muted: data.is_muted || 0,
    is_solo: data.is_solo || 0,
    created_at: now,
  };
}

export async function getAudioTracksByEditId(clipEditId: string): Promise<ClipAudioTrackRecord[]> {
  const db = await getDatabase();
  return await db.select<ClipAudioTrackRecord[]>(
    `SELECT * FROM clip_audio_tracks WHERE clip_edit_id = ? ORDER BY track_order`,
    [clipEditId]
  );
}

export async function updateAudioTrack(
  id: string,
  data: Partial<ClipAudioTrackRecord>
): Promise<void> {
  const db = await getDatabase();
  const updates: string[] = [];
  const values: any[] = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    values.push(data.name);
  }
  if (data.start_time !== undefined) {
    updates.push('start_time = ?');
    values.push(data.start_time);
  }
  if (data.end_time !== undefined) {
    updates.push('end_time = ?');
    values.push(data.end_time);
  }
  if (data.volume !== undefined) {
    updates.push('volume = ?');
    values.push(data.volume);
  }
  if (data.fade_in !== undefined) {
    updates.push('fade_in = ?');
    values.push(data.fade_in);
  }
  if (data.fade_out !== undefined) {
    updates.push('fade_out = ?');
    values.push(data.fade_out);
  }
  if (data.track_order !== undefined) {
    updates.push('track_order = ?');
    values.push(data.track_order);
  }
  if (data.is_muted !== undefined) {
    updates.push('is_muted = ?');
    values.push(data.is_muted);
  }
  if (data.is_solo !== undefined) {
    updates.push('is_solo = ?');
    values.push(data.is_solo);
  }

  if (updates.length > 0) {
    values.push(id);
    await db.execute(`UPDATE clip_audio_tracks SET ${updates.join(', ')} WHERE id = ?`, values);
  }
}

export async function deleteAudioTrack(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(`DELETE FROM clip_audio_tracks WHERE id = ?`, [id]);
}

// ==========================================
// Text Overlay Operations
// ==========================================

export async function createTextOverlay(
  clipEditId: string,
  data: Partial<ClipTextOverlayRecord>
): Promise<ClipTextOverlayRecord> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  await db.execute(
    `INSERT INTO clip_text_overlays 
     (id, clip_edit_id, text, start_time, end_time, position_x, position_y, style_data, animation, preview_height, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      clipEditId,
      data.text || '',
      data.start_time || 0,
      data.end_time || 0,
      data.position_x ?? 50,
      data.position_y ?? 50,
      data.style_data || '{}',
      data.animation || 'none',
      data.preview_height ?? null,
      now,
    ]
  );

  return {
    id,
    clip_edit_id: clipEditId,
    text: data.text || '',
    start_time: data.start_time || 0,
    end_time: data.end_time || 0,
    position_x: data.position_x ?? 50,
    position_y: data.position_y ?? 50,
    style_data: data.style_data || '{}',
    animation: data.animation || 'none',
    created_at: now,
  };
}

export async function getTextOverlaysByEditId(
  clipEditId: string
): Promise<ClipTextOverlayRecord[]> {
  const db = await getDatabase();
  return await db.select<ClipTextOverlayRecord[]>(
    `SELECT * FROM clip_text_overlays WHERE clip_edit_id = ? ORDER BY start_time`,
    [clipEditId]
  );
}

export async function updateTextOverlay(
  id: string,
  data: Partial<ClipTextOverlayRecord>
): Promise<void> {
  const db = await getDatabase();
  const updates: string[] = [];
  const values: any[] = [];

  if (data.text !== undefined) {
    updates.push('text = ?');
    values.push(data.text);
  }
  if (data.start_time !== undefined) {
    updates.push('start_time = ?');
    values.push(data.start_time);
  }
  if (data.end_time !== undefined) {
    updates.push('end_time = ?');
    values.push(data.end_time);
  }
  if (data.position_x !== undefined) {
    updates.push('position_x = ?');
    values.push(data.position_x);
  }
  if (data.position_y !== undefined) {
    updates.push('position_y = ?');
    values.push(data.position_y);
  }
  if (data.style_data !== undefined) {
    updates.push('style_data = ?');
    values.push(data.style_data);
  }
  if (data.per_ratio_configs_data !== undefined) {
    updates.push('per_ratio_configs_data = ?');
    values.push(data.per_ratio_configs_data);
  }
  if (data.preview_height !== undefined) {
    updates.push('preview_height = ?');
    values.push(data.preview_height);
  }
  if (data.animation !== undefined) {
    updates.push('animation = ?');
    values.push(data.animation);
  }

  if (updates.length > 0) {
    values.push(id);
    await db.execute(`UPDATE clip_text_overlays SET ${updates.join(', ')} WHERE id = ?`, values);
  }
}

export async function deleteTextOverlay(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(`DELETE FROM clip_text_overlays WHERE id = ?`, [id]);
}

// ==========================================
// Sticker Operations
// ==========================================

export async function createSticker(
  clipEditId: string,
  data: Partial<ClipStickerRecord>
): Promise<ClipStickerRecord> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  await db.execute(
    `INSERT INTO clip_stickers 
     (id, clip_edit_id, sticker_path, sticker_type, start_time, end_time, position_x, position_y, scale, rotation, animation, per_ratio_configs_data, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      clipEditId,
      data.sticker_path || '',
      data.sticker_type || 'emoji',
      data.start_time || 0,
      data.end_time || 0,
      data.position_x ?? 50,
      data.position_y ?? 50,
      data.scale ?? 1.0,
      data.rotation || 0,
      data.animation || 'none',
      data.per_ratio_configs_data || null,
      now,
    ]
  );

  return {
    id,
    clip_edit_id: clipEditId,
    sticker_path: data.sticker_path || '',
    sticker_type: data.sticker_type || 'emoji',
    start_time: data.start_time || 0,
    end_time: data.end_time || 0,
    position_x: data.position_x ?? 50,
    position_y: data.position_y ?? 50,
    scale: data.scale ?? 1.0,
    rotation: data.rotation || 0,
    animation: data.animation || 'none',
    per_ratio_configs_data: data.per_ratio_configs_data,
    created_at: now,
  };
}

export async function getStickersByEditId(clipEditId: string): Promise<ClipStickerRecord[]> {
  const db = await getDatabase();
  return await db.select<ClipStickerRecord[]>(
    `SELECT * FROM clip_stickers WHERE clip_edit_id = ? ORDER BY start_time`,
    [clipEditId]
  );
}

export async function updateSticker(id: string, data: Partial<ClipStickerRecord>): Promise<void> {
  const db = await getDatabase();
  const updates: string[] = [];
  const values: any[] = [];

  if (data.sticker_path !== undefined) {
    updates.push('sticker_path = ?');
    values.push(data.sticker_path);
  }
  if (data.sticker_type !== undefined) {
    updates.push('sticker_type = ?');
    values.push(data.sticker_type);
  }
  if (data.start_time !== undefined) {
    updates.push('start_time = ?');
    values.push(data.start_time);
  }
  if (data.end_time !== undefined) {
    updates.push('end_time = ?');
    values.push(data.end_time);
  }
  if (data.position_x !== undefined) {
    updates.push('position_x = ?');
    values.push(data.position_x);
  }
  if (data.position_y !== undefined) {
    updates.push('position_y = ?');
    values.push(data.position_y);
  }
  if (data.scale !== undefined) {
    updates.push('scale = ?');
    values.push(data.scale);
  }
  if (data.rotation !== undefined) {
    updates.push('rotation = ?');
    values.push(data.rotation);
  }
  if (data.animation !== undefined) {
    updates.push('animation = ?');
    values.push(data.animation);
  }
  if (data.per_ratio_configs_data !== undefined) {
    updates.push('per_ratio_configs_data = ?');
    values.push(data.per_ratio_configs_data);
  }

  if (updates.length > 0) {
    values.push(id);
    await db.execute(`UPDATE clip_stickers SET ${updates.join(', ')} WHERE id = ?`, values);
  }
}

export async function deleteSticker(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(`DELETE FROM clip_stickers WHERE id = ?`, [id]);
}

// ==========================================
// Effect Operations
// ==========================================

export async function createEffect(
  clipEditId: string,
  data: Partial<ClipEffectRecord>
): Promise<ClipEffectRecord> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  await db.execute(
    `INSERT INTO clip_effects 
     (id, clip_edit_id, effect_type, start_time, end_time, settings, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      clipEditId,
      data.effect_type || 'filter',
      data.start_time || 0,
      data.end_time || 0,
      data.settings || '{}',
      now,
    ]
  );

  return {
    id,
    clip_edit_id: clipEditId,
    effect_type: data.effect_type || 'filter',
    start_time: data.start_time || 0,
    end_time: data.end_time || 0,
    settings: data.settings || '{}',
    created_at: now,
  };
}

export async function getEffectsByEditId(clipEditId: string): Promise<ClipEffectRecord[]> {
  const db = await getDatabase();
  return await db.select<ClipEffectRecord[]>(
    `SELECT * FROM clip_effects WHERE clip_edit_id = ? ORDER BY start_time`,
    [clipEditId]
  );
}

export async function updateEffect(id: string, data: Partial<ClipEffectRecord>): Promise<void> {
  const db = await getDatabase();
  const updates: string[] = [];
  const values: any[] = [];

  if (data.effect_type !== undefined) {
    updates.push('effect_type = ?');
    values.push(data.effect_type);
  }
  if (data.start_time !== undefined) {
    updates.push('start_time = ?');
    values.push(data.start_time);
  }
  if (data.end_time !== undefined) {
    updates.push('end_time = ?');
    values.push(data.end_time);
  }
  if (data.settings !== undefined) {
    updates.push('settings = ?');
    values.push(data.settings);
  }

  if (updates.length > 0) {
    values.push(id);
    await db.execute(`UPDATE clip_effects SET ${updates.join(', ')} WHERE id = ?`, values);
  }
}

export async function deleteEffect(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(`DELETE FROM clip_effects WHERE id = ?`, [id]);
}

// ==========================================
// Watermark Operations
// ==========================================

export async function createWatermark(
  clipEditId: string,
  data: Partial<ClipWatermarkRecord>
): Promise<ClipWatermarkRecord> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  await db.execute(
    `INSERT INTO clip_watermarks 
     (id, clip_edit_id, watermark_id, watermark_path, preview_url, start_time, end_time, position_x, position_y, scale, opacity, per_ratio_configs_data, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      clipEditId,
      data.watermark_id || '',
      data.watermark_path || '',
      data.preview_url || null,
      data.start_time || 0,
      data.end_time || 0,
      data.position_x ?? 8,
      data.position_y ?? 92,
      data.scale ?? 15,
      data.opacity ?? 80,
      data.per_ratio_configs_data || null,
      now,
    ]
  );

  return {
    id,
    clip_edit_id: clipEditId,
    watermark_id: data.watermark_id || '',
    watermark_path: data.watermark_path || '',
    preview_url: data.preview_url,
    start_time: data.start_time || 0,
    end_time: data.end_time || 0,
    position_x: data.position_x ?? 8,
    position_y: data.position_y ?? 92,
    scale: data.scale ?? 15,
    opacity: data.opacity ?? 80,
    per_ratio_configs_data: data.per_ratio_configs_data,
    created_at: now,
  };
}

export async function getWatermarksByEditId(clipEditId: string): Promise<ClipWatermarkRecord[]> {
  const db = await getDatabase();
  return await db.select<ClipWatermarkRecord[]>(
    `SELECT * FROM clip_watermarks WHERE clip_edit_id = ? ORDER BY start_time`,
    [clipEditId]
  );
}

export async function updateWatermarkRecord(
  id: string,
  data: Partial<ClipWatermarkRecord>
): Promise<void> {
  const db = await getDatabase();
  const updates: string[] = [];
  const values: any[] = [];

  if (data.watermark_id !== undefined) {
    updates.push('watermark_id = ?');
    values.push(data.watermark_id);
  }
  if (data.watermark_path !== undefined) {
    updates.push('watermark_path = ?');
    values.push(data.watermark_path);
  }
  if (data.preview_url !== undefined) {
    updates.push('preview_url = ?');
    values.push(data.preview_url);
  }
  if (data.start_time !== undefined) {
    updates.push('start_time = ?');
    values.push(data.start_time);
  }
  if (data.end_time !== undefined) {
    updates.push('end_time = ?');
    values.push(data.end_time);
  }
  if (data.position_x !== undefined) {
    updates.push('position_x = ?');
    values.push(data.position_x);
  }
  if (data.position_y !== undefined) {
    updates.push('position_y = ?');
    values.push(data.position_y);
  }
  if (data.scale !== undefined) {
    updates.push('scale = ?');
    values.push(data.scale);
  }
  if (data.opacity !== undefined) {
    updates.push('opacity = ?');
    values.push(data.opacity);
  }
  if (data.per_ratio_configs_data !== undefined) {
    updates.push('per_ratio_configs_data = ?');
    values.push(data.per_ratio_configs_data);
  }

  if (updates.length > 0) {
    values.push(id);
    await db.execute(`UPDATE clip_watermarks SET ${updates.join(', ')} WHERE id = ?`, values);
  }
}

export async function deleteWatermarkRecord(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(`DELETE FROM clip_watermarks WHERE id = ?`, [id]);
}

// ==========================================
// Full Clip Edit with All Data
// ==========================================

export interface FullClipEdit {
  edit: ClipEditRecord;
  audioTracks: ClipAudioTrackRecord[];
  textOverlays: ClipTextOverlayRecord[];
  stickers: ClipStickerRecord[];
  effects: ClipEffectRecord[];
  watermarks: ClipWatermarkRecord[];
}

export async function getFullClipEdit(clipId: string): Promise<FullClipEdit | null> {
  const edit = await getClipEditByClipId(clipId);
  if (!edit) return null;

  const [audioTracks, textOverlays, stickers, effects, watermarks] = await Promise.all([
    getAudioTracksByEditId(edit.id),
    getTextOverlaysByEditId(edit.id),
    getStickersByEditId(edit.id),
    getEffectsByEditId(edit.id),
    getWatermarksByEditId(edit.id),
  ]);

  return {
    edit,
    audioTracks,
    textOverlays,
    stickers,
    effects,
    watermarks,
  };
}

export async function getOrCreateClipEdit(clipId: string): Promise<ClipEditRecord> {
  let edit = await getClipEditByClipId(clipId);
  if (!edit) {
    edit = await createClipEdit(clipId, {
      trim: { startTime: 0, endTime: 0 },
      filter: null,
      speed: 1,
    });
  }
  return edit;
}
