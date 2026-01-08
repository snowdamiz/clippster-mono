/**
 * Database service for effects and transitions
 * Handles CRUD operations for transition presets, effect presets,
 * and applied effects/transitions in both clip and video editor modes.
 */

import { getDatabase, generateId, timestamp } from './core';
import type {
  TransitionPreset,
  EffectPreset,
  ClipTransition,
  ClipEffect,
  VideoEditorTransitionEffect,
  VideoEditorEffect,
  TransitionCategory,
  EffectCategory,
} from '@/types';

// ==========================================
// Database Record Types
// ==========================================

interface TransitionPresetRecord {
  id: string;
  name: string;
  type: string;
  category: string;
  description: string | null;
  parameters_schema: string | null;
  default_parameters: string | null;
  preview_url: string | null;
  ffmpeg_filter: string | null;
  css_animation: string | null;
  is_builtin: number;
  sort_order: number;
  created_at: number;
}

interface EffectPresetRecord {
  id: string;
  name: string;
  type: string;
  category: string;
  description: string | null;
  parameters_schema: string | null;
  default_parameters: string | null;
  preview_url: string | null;
  ffmpeg_filter: string | null;
  css_filter: string | null;
  is_builtin: number;
  sort_order: number;
  created_at: number;
}

interface ClipTransitionRecord {
  id: string;
  clip_edit_id: string;
  preset_id: string | null;
  transition_type: string;
  position_index: number;
  duration: number;
  parameters_data: string | null;
  easing: string;
  created_at: number;
}

interface ClipEffectRecord {
  id: string;
  clip_edit_id: string;
  preset_id: string | null;
  effect_type: string;
  start_time: number;
  end_time: number;
  intensity: number;
  parameters_data: string | null;
  keyframes_data: string | null;
  blend_mode: string;
  layer: number;
  is_enabled: number;
  created_at: number;
}

interface VideoEditorTransitionRecord {
  id: string;
  edit_id: string;
  preset_id: string | null;
  transition_type: string;
  from_source_id: string | null;
  to_source_id: string | null;
  duration: number;
  parameters_data: string | null;
  easing: string;
  created_at: number;
}

interface VideoEditorEffectRecord {
  id: string;
  edit_id: string;
  preset_id: string | null;
  effect_type: string;
  target_source_id: string | null;
  start_time: number;
  end_time: number;
  intensity: number;
  parameters_data: string | null;
  keyframes_data: string | null;
  blend_mode: string;
  layer: number;
  is_enabled: number;
  created_at: number;
}

// ==========================================
// Conversion Functions
// ==========================================

function recordToTransitionPreset(record: TransitionPresetRecord): TransitionPreset {
  return {
    id: record.id,
    name: record.name,
    type: record.type,
    category: record.category as TransitionCategory,
    description: record.description || undefined,
    parametersSchema: record.parameters_schema ? JSON.parse(record.parameters_schema) : undefined,
    defaultParameters: record.default_parameters ? JSON.parse(record.default_parameters) : undefined,
    previewUrl: record.preview_url || undefined,
    ffmpegFilter: record.ffmpeg_filter || undefined,
    cssAnimation: record.css_animation || undefined,
    isBuiltin: record.is_builtin === 1,
    sortOrder: record.sort_order,
  };
}

function recordToEffectPreset(record: EffectPresetRecord): EffectPreset {
  return {
    id: record.id,
    name: record.name,
    type: record.type,
    category: record.category as EffectCategory,
    description: record.description || undefined,
    parametersSchema: record.parameters_schema ? JSON.parse(record.parameters_schema) : undefined,
    defaultParameters: record.default_parameters ? JSON.parse(record.default_parameters) : undefined,
    previewUrl: record.preview_url || undefined,
    ffmpegFilter: record.ffmpeg_filter || undefined,
    cssFilter: record.css_filter || undefined,
    isBuiltin: record.is_builtin === 1,
    sortOrder: record.sort_order,
  };
}

function recordToClipTransition(record: ClipTransitionRecord): ClipTransition {
  return {
    id: record.id,
    clipEditId: record.clip_edit_id,
    presetId: record.preset_id || undefined,
    transitionType: record.transition_type,
    positionIndex: record.position_index,
    duration: record.duration,
    parameters: record.parameters_data ? JSON.parse(record.parameters_data) : undefined,
    easing: record.easing,
    createdAt: record.created_at,
  };
}

function recordToClipEffect(record: ClipEffectRecord): ClipEffect {
  return {
    id: record.id,
    clipEditId: record.clip_edit_id,
    presetId: record.preset_id || undefined,
    effectType: record.effect_type,
    startTime: record.start_time,
    endTime: record.end_time,
    intensity: record.intensity,
    parameters: record.parameters_data ? JSON.parse(record.parameters_data) : undefined,
    keyframes: record.keyframes_data ? JSON.parse(record.keyframes_data) : undefined,
    blendMode: record.blend_mode,
    layer: record.layer,
    isEnabled: record.is_enabled === 1,
    createdAt: record.created_at,
  };
}

function recordToVideoEditorTransition(record: VideoEditorTransitionRecord): VideoEditorTransitionEffect {
  return {
    id: record.id,
    editId: record.edit_id,
    presetId: record.preset_id || undefined,
    transitionType: record.transition_type,
    fromSourceId: record.from_source_id || undefined,
    toSourceId: record.to_source_id || undefined,
    duration: record.duration,
    parameters: record.parameters_data ? JSON.parse(record.parameters_data) : undefined,
    easing: record.easing,
    createdAt: record.created_at,
  };
}

function recordToVideoEditorEffect(record: VideoEditorEffectRecord): VideoEditorEffect {
  return {
    id: record.id,
    editId: record.edit_id,
    presetId: record.preset_id || undefined,
    effectType: record.effect_type,
    targetSourceId: record.target_source_id || undefined,
    startTime: record.start_time,
    endTime: record.end_time,
    intensity: record.intensity,
    parameters: record.parameters_data ? JSON.parse(record.parameters_data) : undefined,
    keyframes: record.keyframes_data ? JSON.parse(record.keyframes_data) : undefined,
    blendMode: record.blend_mode,
    layer: record.layer,
    isEnabled: record.is_enabled === 1,
    createdAt: record.created_at,
  };
}

// ==========================================
// Transition Preset Operations
// ==========================================

export async function getAllTransitionPresets(): Promise<TransitionPreset[]> {
  const db = await getDatabase();
  const records = await db.select<TransitionPresetRecord[]>(
    `SELECT * FROM transition_presets ORDER BY category, sort_order, name`
  );
  return records.map(recordToTransitionPreset);
}

export async function getTransitionPresetsByCategory(category: TransitionCategory): Promise<TransitionPreset[]> {
  const db = await getDatabase();
  const records = await db.select<TransitionPresetRecord[]>(
    `SELECT * FROM transition_presets WHERE category = ? ORDER BY sort_order, name`,
    [category]
  );
  return records.map(recordToTransitionPreset);
}

export async function getTransitionPresetById(id: string): Promise<TransitionPreset | null> {
  const db = await getDatabase();
  const records = await db.select<TransitionPresetRecord[]>(
    `SELECT * FROM transition_presets WHERE id = ?`,
    [id]
  );
  return records.length > 0 ? recordToTransitionPreset(records[0]) : null;
}

export async function createTransitionPreset(preset: Omit<TransitionPreset, 'id' | 'sortOrder'> & { sortOrder?: number }): Promise<TransitionPreset> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  await db.execute(
    `INSERT INTO transition_presets 
     (id, name, type, category, description, parameters_schema, default_parameters, preview_url, ffmpeg_filter, css_animation, is_builtin, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      preset.name,
      preset.type,
      preset.category,
      preset.description || null,
      preset.parametersSchema ? JSON.stringify(preset.parametersSchema) : null,
      preset.defaultParameters ? JSON.stringify(preset.defaultParameters) : null,
      preset.previewUrl || null,
      preset.ffmpegFilter || null,
      preset.cssAnimation || null,
      preset.isBuiltin ? 1 : 0,
      preset.sortOrder || 0,
      now,
    ]
  );

  return {
    ...preset,
    id,
    sortOrder: preset.sortOrder || 0,
  };
}

// ==========================================
// Effect Preset Operations
// ==========================================

export async function getAllEffectPresets(): Promise<EffectPreset[]> {
  const db = await getDatabase();
  const records = await db.select<EffectPresetRecord[]>(
    `SELECT * FROM effect_presets ORDER BY category, sort_order, name`
  );
  return records.map(recordToEffectPreset);
}

export async function getEffectPresetsByCategory(category: EffectCategory): Promise<EffectPreset[]> {
  const db = await getDatabase();
  const records = await db.select<EffectPresetRecord[]>(
    `SELECT * FROM effect_presets WHERE category = ? ORDER BY sort_order, name`,
    [category]
  );
  return records.map(recordToEffectPreset);
}

export async function getEffectPresetById(id: string): Promise<EffectPreset | null> {
  const db = await getDatabase();
  const records = await db.select<EffectPresetRecord[]>(
    `SELECT * FROM effect_presets WHERE id = ?`,
    [id]
  );
  return records.length > 0 ? recordToEffectPreset(records[0]) : null;
}

export async function createEffectPreset(preset: Omit<EffectPreset, 'id' | 'sortOrder'> & { sortOrder?: number }): Promise<EffectPreset> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  await db.execute(
    `INSERT INTO effect_presets 
     (id, name, type, category, description, parameters_schema, default_parameters, preview_url, ffmpeg_filter, css_filter, is_builtin, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      preset.name,
      preset.type,
      preset.category,
      preset.description || null,
      preset.parametersSchema ? JSON.stringify(preset.parametersSchema) : null,
      preset.defaultParameters ? JSON.stringify(preset.defaultParameters) : null,
      preset.previewUrl || null,
      preset.ffmpegFilter || null,
      preset.cssFilter || null,
      preset.isBuiltin ? 1 : 0,
      preset.sortOrder || 0,
      now,
    ]
  );

  return {
    ...preset,
    id,
    sortOrder: preset.sortOrder || 0,
  };
}

// ==========================================
// Clip Transition Operations
// ==========================================

export async function getClipTransitions(clipEditId: string): Promise<ClipTransition[]> {
  const db = await getDatabase();
  const records = await db.select<ClipTransitionRecord[]>(
    `SELECT * FROM clip_transitions WHERE clip_edit_id = ? ORDER BY position_index`,
    [clipEditId]
  );
  return records.map(recordToClipTransition);
}

export async function createClipTransition(
  clipEditId: string,
  data: Omit<ClipTransition, 'id' | 'clipEditId' | 'createdAt'>
): Promise<ClipTransition> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  await db.execute(
    `INSERT INTO clip_transitions 
     (id, clip_edit_id, preset_id, transition_type, position_index, duration, parameters_data, easing, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      clipEditId,
      data.presetId || null,
      data.transitionType,
      data.positionIndex,
      data.duration,
      data.parameters ? JSON.stringify(data.parameters) : null,
      data.easing,
      now,
    ]
  );

  return {
    id,
    clipEditId,
    ...data,
    createdAt: now,
  };
}

export async function updateClipTransition(
  id: string,
  data: Partial<Omit<ClipTransition, 'id' | 'clipEditId' | 'createdAt'>>
): Promise<void> {
  const db = await getDatabase();
  const updates: string[] = [];
  const values: unknown[] = [];

  if (data.presetId !== undefined) {
    updates.push('preset_id = ?');
    values.push(data.presetId || null);
  }
  if (data.transitionType !== undefined) {
    updates.push('transition_type = ?');
    values.push(data.transitionType);
  }
  if (data.positionIndex !== undefined) {
    updates.push('position_index = ?');
    values.push(data.positionIndex);
  }
  if (data.duration !== undefined) {
    updates.push('duration = ?');
    values.push(data.duration);
  }
  if (data.parameters !== undefined) {
    updates.push('parameters_data = ?');
    values.push(data.parameters ? JSON.stringify(data.parameters) : null);
  }
  if (data.easing !== undefined) {
    updates.push('easing = ?');
    values.push(data.easing);
  }

  if (updates.length > 0) {
    values.push(id);
    await db.execute(
      `UPDATE clip_transitions SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  }
}

export async function deleteClipTransition(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(`DELETE FROM clip_transitions WHERE id = ?`, [id]);
}

export async function deleteClipTransitionsByEditId(clipEditId: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(`DELETE FROM clip_transitions WHERE clip_edit_id = ?`, [clipEditId]);
}

// ==========================================
// Clip Effect Operations
// ==========================================

export async function getClipEffects(clipEditId: string): Promise<ClipEffect[]> {
  const db = await getDatabase();
  const records = await db.select<ClipEffectRecord[]>(
    `SELECT * FROM clip_effects WHERE clip_edit_id = ? ORDER BY layer, start_time`,
    [clipEditId]
  );
  return records.map(recordToClipEffect);
}

export async function getClipEffectsAtTime(clipEditId: string, time: number): Promise<ClipEffect[]> {
  const db = await getDatabase();
  const records = await db.select<ClipEffectRecord[]>(
    `SELECT * FROM clip_effects 
     WHERE clip_edit_id = ? AND start_time <= ? AND end_time >= ? AND is_enabled = 1
     ORDER BY layer`,
    [clipEditId, time, time]
  );
  return records.map(recordToClipEffect);
}

export async function createClipEffect(
  clipEditId: string,
  data: Omit<ClipEffect, 'id' | 'clipEditId' | 'createdAt'>
): Promise<ClipEffect> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  await db.execute(
    `INSERT INTO clip_effects 
     (id, clip_edit_id, preset_id, effect_type, start_time, end_time, intensity, parameters_data, keyframes_data, blend_mode, layer, is_enabled, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      clipEditId,
      data.presetId || null,
      data.effectType,
      data.startTime,
      data.endTime,
      data.intensity,
      data.parameters ? JSON.stringify(data.parameters) : null,
      data.keyframes ? JSON.stringify(data.keyframes) : null,
      data.blendMode,
      data.layer,
      data.isEnabled ? 1 : 0,
      now,
    ]
  );

  return {
    id,
    clipEditId,
    ...data,
    createdAt: now,
  };
}

export async function updateClipEffect(
  id: string,
  data: Partial<Omit<ClipEffect, 'id' | 'clipEditId' | 'createdAt'>>
): Promise<void> {
  const db = await getDatabase();
  const updates: string[] = [];
  const values: unknown[] = [];

  if (data.presetId !== undefined) {
    updates.push('preset_id = ?');
    values.push(data.presetId || null);
  }
  if (data.effectType !== undefined) {
    updates.push('effect_type = ?');
    values.push(data.effectType);
  }
  if (data.startTime !== undefined) {
    updates.push('start_time = ?');
    values.push(data.startTime);
  }
  if (data.endTime !== undefined) {
    updates.push('end_time = ?');
    values.push(data.endTime);
  }
  if (data.intensity !== undefined) {
    updates.push('intensity = ?');
    values.push(data.intensity);
  }
  if (data.parameters !== undefined) {
    updates.push('parameters_data = ?');
    values.push(data.parameters ? JSON.stringify(data.parameters) : null);
  }
  if (data.keyframes !== undefined) {
    updates.push('keyframes_data = ?');
    values.push(data.keyframes ? JSON.stringify(data.keyframes) : null);
  }
  if (data.blendMode !== undefined) {
    updates.push('blend_mode = ?');
    values.push(data.blendMode);
  }
  if (data.layer !== undefined) {
    updates.push('layer = ?');
    values.push(data.layer);
  }
  if (data.isEnabled !== undefined) {
    updates.push('is_enabled = ?');
    values.push(data.isEnabled ? 1 : 0);
  }

  if (updates.length > 0) {
    values.push(id);
    await db.execute(
      `UPDATE clip_effects SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  }
}

export async function deleteClipEffect(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(`DELETE FROM clip_effects WHERE id = ?`, [id]);
}

export async function deleteClipEffectsByEditId(clipEditId: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(`DELETE FROM clip_effects WHERE clip_edit_id = ?`, [clipEditId]);
}

// ==========================================
// Video Editor Transition Operations
// ==========================================

export async function getVideoEditorTransitions(editId: string): Promise<VideoEditorTransitionEffect[]> {
  const db = await getDatabase();
  const records = await db.select<VideoEditorTransitionRecord[]>(
    `SELECT * FROM video_editor_transitions WHERE edit_id = ? ORDER BY created_at`,
    [editId]
  );
  return records.map(recordToVideoEditorTransition);
}

export async function createVideoEditorTransition(
  editId: string,
  data: Omit<VideoEditorTransitionEffect, 'id' | 'editId' | 'createdAt'>
): Promise<VideoEditorTransitionEffect> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  await db.execute(
    `INSERT INTO video_editor_transitions 
     (id, edit_id, preset_id, transition_type, from_source_id, to_source_id, duration, parameters_data, easing, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      editId,
      data.presetId || null,
      data.transitionType,
      data.fromSourceId || null,
      data.toSourceId || null,
      data.duration,
      data.parameters ? JSON.stringify(data.parameters) : null,
      data.easing,
      now,
    ]
  );

  return {
    id,
    editId,
    ...data,
    createdAt: now,
  };
}

export async function updateVideoEditorTransition(
  id: string,
  data: Partial<Omit<VideoEditorTransitionEffect, 'id' | 'editId' | 'createdAt'>>
): Promise<void> {
  const db = await getDatabase();
  const updates: string[] = [];
  const values: unknown[] = [];

  if (data.presetId !== undefined) {
    updates.push('preset_id = ?');
    values.push(data.presetId || null);
  }
  if (data.transitionType !== undefined) {
    updates.push('transition_type = ?');
    values.push(data.transitionType);
  }
  if (data.fromSourceId !== undefined) {
    updates.push('from_source_id = ?');
    values.push(data.fromSourceId || null);
  }
  if (data.toSourceId !== undefined) {
    updates.push('to_source_id = ?');
    values.push(data.toSourceId || null);
  }
  if (data.duration !== undefined) {
    updates.push('duration = ?');
    values.push(data.duration);
  }
  if (data.parameters !== undefined) {
    updates.push('parameters_data = ?');
    values.push(data.parameters ? JSON.stringify(data.parameters) : null);
  }
  if (data.easing !== undefined) {
    updates.push('easing = ?');
    values.push(data.easing);
  }

  if (updates.length > 0) {
    values.push(id);
    await db.execute(
      `UPDATE video_editor_transitions SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  }
}

export async function deleteVideoEditorTransition(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(`DELETE FROM video_editor_transitions WHERE id = ?`, [id]);
}

export async function deleteVideoEditorTransitionsByEditId(editId: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(`DELETE FROM video_editor_transitions WHERE edit_id = ?`, [editId]);
}

// ==========================================
// Video Editor Effect Operations
// ==========================================

export async function getVideoEditorEffects(editId: string): Promise<VideoEditorEffect[]> {
  const db = await getDatabase();
  const records = await db.select<VideoEditorEffectRecord[]>(
    `SELECT * FROM video_editor_effects WHERE edit_id = ? ORDER BY layer, start_time`,
    [editId]
  );
  return records.map(recordToVideoEditorEffect);
}

export async function getVideoEditorEffectsAtTime(editId: string, time: number): Promise<VideoEditorEffect[]> {
  const db = await getDatabase();
  const records = await db.select<VideoEditorEffectRecord[]>(
    `SELECT * FROM video_editor_effects 
     WHERE edit_id = ? AND start_time <= ? AND end_time >= ? AND is_enabled = 1
     ORDER BY layer`,
    [editId, time, time]
  );
  return records.map(recordToVideoEditorEffect);
}

export async function createVideoEditorEffect(
  editId: string,
  data: Omit<VideoEditorEffect, 'id' | 'editId' | 'createdAt'>
): Promise<VideoEditorEffect> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  await db.execute(
    `INSERT INTO video_editor_effects 
     (id, edit_id, preset_id, effect_type, target_source_id, start_time, end_time, intensity, parameters_data, keyframes_data, blend_mode, layer, is_enabled, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      editId,
      data.presetId || null,
      data.effectType,
      data.targetSourceId || null,
      data.startTime,
      data.endTime,
      data.intensity,
      data.parameters ? JSON.stringify(data.parameters) : null,
      data.keyframes ? JSON.stringify(data.keyframes) : null,
      data.blendMode,
      data.layer,
      data.isEnabled ? 1 : 0,
      now,
    ]
  );

  return {
    id,
    editId,
    ...data,
    createdAt: now,
  };
}

export async function updateVideoEditorEffect(
  id: string,
  data: Partial<Omit<VideoEditorEffect, 'id' | 'editId' | 'createdAt'>>
): Promise<void> {
  const db = await getDatabase();
  const updates: string[] = [];
  const values: unknown[] = [];

  if (data.presetId !== undefined) {
    updates.push('preset_id = ?');
    values.push(data.presetId || null);
  }
  if (data.effectType !== undefined) {
    updates.push('effect_type = ?');
    values.push(data.effectType);
  }
  if (data.targetSourceId !== undefined) {
    updates.push('target_source_id = ?');
    values.push(data.targetSourceId || null);
  }
  if (data.startTime !== undefined) {
    updates.push('start_time = ?');
    values.push(data.startTime);
  }
  if (data.endTime !== undefined) {
    updates.push('end_time = ?');
    values.push(data.endTime);
  }
  if (data.intensity !== undefined) {
    updates.push('intensity = ?');
    values.push(data.intensity);
  }
  if (data.parameters !== undefined) {
    updates.push('parameters_data = ?');
    values.push(data.parameters ? JSON.stringify(data.parameters) : null);
  }
  if (data.keyframes !== undefined) {
    updates.push('keyframes_data = ?');
    values.push(data.keyframes ? JSON.stringify(data.keyframes) : null);
  }
  if (data.blendMode !== undefined) {
    updates.push('blend_mode = ?');
    values.push(data.blendMode);
  }
  if (data.layer !== undefined) {
    updates.push('layer = ?');
    values.push(data.layer);
  }
  if (data.isEnabled !== undefined) {
    updates.push('is_enabled = ?');
    values.push(data.isEnabled ? 1 : 0);
  }

  if (updates.length > 0) {
    values.push(id);
    await db.execute(
      `UPDATE video_editor_effects SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
  }
}

export async function deleteVideoEditorEffect(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(`DELETE FROM video_editor_effects WHERE id = ?`, [id]);
}

export async function deleteVideoEditorEffectsByEditId(editId: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(`DELETE FROM video_editor_effects WHERE edit_id = ?`, [editId]);
}

// ==========================================
// Bulk Preset Seeding (for built-in presets)
// ==========================================

export async function seedTransitionPresets(presets: Omit<TransitionPreset, 'id'>[]): Promise<void> {
  const db = await getDatabase();
  const now = timestamp();

  for (const preset of presets) {
    const id = `builtin-transition-${preset.type}`;
    
    // Check if already exists
    const existing = await db.select<{ id: string }[]>(
      `SELECT id FROM transition_presets WHERE id = ?`,
      [id]
    );
    
    if (existing.length === 0) {
      await db.execute(
        `INSERT INTO transition_presets 
         (id, name, type, category, description, parameters_schema, default_parameters, preview_url, ffmpeg_filter, css_animation, is_builtin, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          preset.name,
          preset.type,
          preset.category,
          preset.description || null,
          preset.parametersSchema ? JSON.stringify(preset.parametersSchema) : null,
          preset.defaultParameters ? JSON.stringify(preset.defaultParameters) : null,
          preset.previewUrl || null,
          preset.ffmpegFilter || null,
          preset.cssAnimation || null,
          1,
          preset.sortOrder,
          now,
        ]
      );
    }
  }
}

export async function seedEffectPresets(presets: Omit<EffectPreset, 'id'>[]): Promise<void> {
  const db = await getDatabase();
  const now = timestamp();

  for (const preset of presets) {
    const id = `builtin-effect-${preset.type}`;
    
    // Check if already exists
    const existing = await db.select<{ id: string }[]>(
      `SELECT id FROM effect_presets WHERE id = ?`,
      [id]
    );
    
    if (existing.length === 0) {
      await db.execute(
        `INSERT INTO effect_presets 
         (id, name, type, category, description, parameters_schema, default_parameters, preview_url, ffmpeg_filter, css_filter, is_builtin, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          preset.name,
          preset.type,
          preset.category,
          preset.description || null,
          preset.parametersSchema ? JSON.stringify(preset.parametersSchema) : null,
          preset.defaultParameters ? JSON.stringify(preset.defaultParameters) : null,
          preset.previewUrl || null,
          preset.ffmpegFilter || null,
          preset.cssFilter || null,
          1,
          preset.sortOrder,
          now,
        ]
      );
    }
  }
}
