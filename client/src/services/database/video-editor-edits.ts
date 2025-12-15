import { getDatabase, generateId, timestamp } from './core';

// ==========================================
// Video Editor Edit Types (Database Layer)
// ==========================================

export interface VideoEditorEditRecord {
  id: string;
  project_id: string;
  edit_data: string; // JSON string containing all edit settings
  created_at: number;
  updated_at: number;
}

export interface VideoEditorAudioTrackRecord {
  id: string;
  edit_id: string;
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

export interface VideoEditorTextOverlayRecord {
  id: string;
  edit_id: string;
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

export interface VideoEditorStickerRecord {
  id: string;
  edit_id: string;
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

export interface VideoEditorWatermarkRecord {
  id: string;
  edit_id: string;
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

export interface VideoEditorEffectRecord {
  id: string;
  edit_id: string;
  effect_type: string;
  start_time: number;
  end_time: number;
  settings: string; // JSON string
  created_at: number;
}

// ==========================================
// Video Editor Edit CRUD Operations
// ==========================================

export async function createVideoEditorEdit(
  projectId: string,
  editData: Record<string, any>
): Promise<VideoEditorEditRecord> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  await db.execute(
    `INSERT INTO video_editor_edits (id, project_id, edit_data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, projectId, JSON.stringify(editData), now, now]
  );

  return {
    id,
    project_id: projectId,
    edit_data: JSON.stringify(editData),
    created_at: now,
    updated_at: now,
  };
}

export async function getVideoEditorEditByProjectId(
  projectId: string
): Promise<VideoEditorEditRecord | null> {
  const db = await getDatabase();
  const result = await db.select<VideoEditorEditRecord[]>(
    `SELECT * FROM video_editor_edits WHERE project_id = ? ORDER BY updated_at DESC LIMIT 1`,
    [projectId]
  );
  return result.length > 0 ? result[0] : null;
}

export async function updateVideoEditorEdit(
  id: string,
  editData: Record<string, any>
): Promise<VideoEditorEditRecord | null> {
  const db = await getDatabase();
  const now = timestamp();

  await db.execute(`UPDATE video_editor_edits SET edit_data = ?, updated_at = ? WHERE id = ?`, [
    JSON.stringify(editData),
    now,
    id,
  ]);

  const result = await db.select<VideoEditorEditRecord[]>(
    `SELECT * FROM video_editor_edits WHERE id = ?`,
    [id]
  );
  return result.length > 0 ? result[0] : null;
}

export async function deleteVideoEditorEdit(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(`DELETE FROM video_editor_edits WHERE id = ?`, [id]);
}

// ==========================================
// Audio Track Operations
// ==========================================

export async function createVideoEditorAudioTrack(
  editId: string,
  data: Partial<VideoEditorAudioTrackRecord>
): Promise<VideoEditorAudioTrackRecord> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  await db.execute(
    `INSERT INTO video_editor_audio_tracks 
     (id, edit_id, file_path, name, start_time, end_time, volume, fade_in, fade_out, track_order, is_muted, is_solo, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      editId,
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
    edit_id: editId,
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

export async function getVideoEditorAudioTracksByEditId(
  editId: string
): Promise<VideoEditorAudioTrackRecord[]> {
  const db = await getDatabase();
  return await db.select<VideoEditorAudioTrackRecord[]>(
    `SELECT * FROM video_editor_audio_tracks WHERE edit_id = ? ORDER BY track_order`,
    [editId]
  );
}

export async function updateVideoEditorAudioTrack(
  id: string,
  data: Partial<VideoEditorAudioTrackRecord>
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
    await db.execute(
      `UPDATE video_editor_audio_tracks SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  }
}

export async function deleteVideoEditorAudioTrack(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(`DELETE FROM video_editor_audio_tracks WHERE id = ?`, [id]);
}

// ==========================================
// Text Overlay Operations
// ==========================================

export async function createVideoEditorTextOverlay(
  editId: string,
  data: Partial<VideoEditorTextOverlayRecord>
): Promise<VideoEditorTextOverlayRecord> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  await db.execute(
    `INSERT INTO video_editor_text_overlays 
     (id, edit_id, text, start_time, end_time, position_x, position_y, style_data, animation, preview_height, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      editId,
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
    edit_id: editId,
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

export async function getVideoEditorTextOverlaysByEditId(
  editId: string
): Promise<VideoEditorTextOverlayRecord[]> {
  const db = await getDatabase();
  return await db.select<VideoEditorTextOverlayRecord[]>(
    `SELECT * FROM video_editor_text_overlays WHERE edit_id = ? ORDER BY start_time`,
    [editId]
  );
}

export async function updateVideoEditorTextOverlay(
  id: string,
  data: Partial<VideoEditorTextOverlayRecord>
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
    await db.execute(
      `UPDATE video_editor_text_overlays SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  }
}

export async function deleteVideoEditorTextOverlay(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(`DELETE FROM video_editor_text_overlays WHERE id = ?`, [id]);
}

// ==========================================
// Sticker Operations
// ==========================================

export async function createVideoEditorSticker(
  editId: string,
  data: Partial<VideoEditorStickerRecord>
): Promise<VideoEditorStickerRecord> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  await db.execute(
    `INSERT INTO video_editor_stickers 
     (id, edit_id, sticker_path, sticker_type, start_time, end_time, position_x, position_y, scale, rotation, animation, per_ratio_configs_data, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      editId,
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
    edit_id: editId,
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

export async function getVideoEditorStickersByEditId(
  editId: string
): Promise<VideoEditorStickerRecord[]> {
  const db = await getDatabase();
  return await db.select<VideoEditorStickerRecord[]>(
    `SELECT * FROM video_editor_stickers WHERE edit_id = ? ORDER BY start_time`,
    [editId]
  );
}

export async function updateVideoEditorSticker(
  id: string,
  data: Partial<VideoEditorStickerRecord>
): Promise<void> {
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
    await db.execute(`UPDATE video_editor_stickers SET ${updates.join(', ')} WHERE id = ?`, values);
  }
}

export async function deleteVideoEditorSticker(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(`DELETE FROM video_editor_stickers WHERE id = ?`, [id]);
}

// ==========================================
// Watermark Operations
// ==========================================

export async function createVideoEditorWatermark(
  editId: string,
  data: Partial<VideoEditorWatermarkRecord>
): Promise<VideoEditorWatermarkRecord> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  await db.execute(
    `INSERT INTO video_editor_watermarks 
     (id, edit_id, watermark_id, watermark_path, preview_url, start_time, end_time, position_x, position_y, scale, opacity, per_ratio_configs_data, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      editId,
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
    edit_id: editId,
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

export async function getVideoEditorWatermarksByEditId(
  editId: string
): Promise<VideoEditorWatermarkRecord[]> {
  const db = await getDatabase();
  return await db.select<VideoEditorWatermarkRecord[]>(
    `SELECT * FROM video_editor_watermarks WHERE edit_id = ? ORDER BY start_time`,
    [editId]
  );
}

export async function updateVideoEditorWatermark(
  id: string,
  data: Partial<VideoEditorWatermarkRecord>
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
    await db.execute(
      `UPDATE video_editor_watermarks SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  }
}

export async function deleteVideoEditorWatermark(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(`DELETE FROM video_editor_watermarks WHERE id = ?`, [id]);
}

// ==========================================
// Effect Operations
// ==========================================

export async function createVideoEditorEffect(
  editId: string,
  data: Partial<VideoEditorEffectRecord>
): Promise<VideoEditorEffectRecord> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  await db.execute(
    `INSERT INTO video_editor_effects 
     (id, edit_id, effect_type, start_time, end_time, settings, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      editId,
      data.effect_type || 'filter',
      data.start_time || 0,
      data.end_time || 0,
      data.settings || '{}',
      now,
    ]
  );

  return {
    id,
    edit_id: editId,
    effect_type: data.effect_type || 'filter',
    start_time: data.start_time || 0,
    end_time: data.end_time || 0,
    settings: data.settings || '{}',
    created_at: now,
  };
}

export async function getVideoEditorEffectsByEditId(
  editId: string
): Promise<VideoEditorEffectRecord[]> {
  const db = await getDatabase();
  return await db.select<VideoEditorEffectRecord[]>(
    `SELECT * FROM video_editor_effects WHERE edit_id = ? ORDER BY start_time`,
    [editId]
  );
}

export async function updateVideoEditorEffect(
  id: string,
  data: Partial<VideoEditorEffectRecord>
): Promise<void> {
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
    await db.execute(`UPDATE video_editor_effects SET ${updates.join(', ')} WHERE id = ?`, values);
  }
}

export async function deleteVideoEditorEffect(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(`DELETE FROM video_editor_effects WHERE id = ?`, [id]);
}

// ==========================================
// Full Video Editor Edit with All Data
// ==========================================

export interface FullVideoEditorEdit {
  edit: VideoEditorEditRecord;
  audioTracks: VideoEditorAudioTrackRecord[];
  textOverlays: VideoEditorTextOverlayRecord[];
  stickers: VideoEditorStickerRecord[];
  watermarks: VideoEditorWatermarkRecord[];
  effects: VideoEditorEffectRecord[];
}

export async function getFullVideoEditorEdit(
  projectId: string
): Promise<FullVideoEditorEdit | null> {
  const edit = await getVideoEditorEditByProjectId(projectId);
  if (!edit) return null;

  const [audioTracks, textOverlays, stickers, watermarks, effects] = await Promise.all([
    getVideoEditorAudioTracksByEditId(edit.id),
    getVideoEditorTextOverlaysByEditId(edit.id),
    getVideoEditorStickersByEditId(edit.id),
    getVideoEditorWatermarksByEditId(edit.id),
    getVideoEditorEffectsByEditId(edit.id),
  ]);

  return {
    edit,
    audioTracks,
    textOverlays,
    stickers,
    watermarks,
    effects,
  };
}

export async function getOrCreateVideoEditorEdit(
  projectId: string
): Promise<VideoEditorEditRecord> {
  let edit = await getVideoEditorEditByProjectId(projectId);
  if (!edit) {
    edit = await createVideoEditorEdit(projectId, {
      filterSegments: [],
      originalDb: 0,
      trackDbValues: {},
    });
  }
  return edit;
}
