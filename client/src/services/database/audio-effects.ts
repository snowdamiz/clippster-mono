import { getDatabase } from './core';
import type {
  AudioEffectPreset,
  AudioTrackEffect,
  AudioEffectKeyframe,
  AudioEffectCategory,
  WebAudioConfig,
  AudioEffectParameterSchema,
} from '@/types';

// ============================================
// Database Record Types
// ============================================

interface AudioEffectPresetRecord {
  id: string;
  name: string;
  effect_type: string;
  category: string;
  description: string | null;
  icon: string | null;
  ffmpeg_filter: string;
  web_audio_config: string | null;
  default_parameters: string | null;
  parameter_schema: string | null;
  is_built_in: number;
  created_at: number;
}

interface AudioTrackEffectRecord {
  id: string;
  track_id: string;
  clip_edit_id: string | null;
  video_editor_project_id: string | null;
  effect_type: string;
  preset_id: string | null;
  start_time: number;
  end_time: number;
  intensity: number;
  parameters: string | null;
  is_enabled: number;
  order_index: number;
  created_at: number;
}

interface AudioEffectKeyframeRecord {
  id: string;
  effect_id: string;
  parameter_name: string;
  time: number;
  value: number;
  easing: string;
  created_at: number;
}

// ============================================
// Conversion Functions
// ============================================

function presetRecordToInterface(record: AudioEffectPresetRecord): AudioEffectPreset {
  return {
    id: record.id,
    name: record.name,
    effectType: record.effect_type,
    category: record.category as AudioEffectCategory,
    description: record.description ?? undefined,
    icon: record.icon ?? undefined,
    ffmpegFilter: record.ffmpeg_filter,
    webAudioConfig: record.web_audio_config
      ? (JSON.parse(record.web_audio_config) as WebAudioConfig)
      : undefined,
    defaultParameters: record.default_parameters
      ? JSON.parse(record.default_parameters)
      : undefined,
    parameterSchema: record.parameter_schema
      ? (JSON.parse(record.parameter_schema) as AudioEffectParameterSchema[])
      : undefined,
    isBuiltIn: record.is_built_in === 1,
    createdAt: record.created_at,
  };
}

function effectRecordToInterface(record: AudioTrackEffectRecord): AudioTrackEffect {
  return {
    id: record.id,
    trackId: record.track_id,
    clipEditId: record.clip_edit_id ?? undefined,
    videoEditorProjectId: record.video_editor_project_id ?? undefined,
    effectType: record.effect_type,
    presetId: record.preset_id ?? undefined,
    startTime: record.start_time,
    endTime: record.end_time,
    intensity: record.intensity,
    parameters: record.parameters ? JSON.parse(record.parameters) : undefined,
    isEnabled: record.is_enabled === 1,
    orderIndex: record.order_index,
    createdAt: record.created_at,
  };
}

function keyframeRecordToInterface(record: AudioEffectKeyframeRecord): AudioEffectKeyframe {
  return {
    id: record.id,
    effectId: record.effect_id,
    parameterName: record.parameter_name,
    time: record.time,
    value: record.value,
    easing: record.easing as AudioEffectKeyframe['easing'],
    createdAt: record.created_at,
  };
}

// ============================================
// Audio Effect Presets CRUD
// ============================================

export async function getAllAudioEffectPresets(): Promise<AudioEffectPreset[]> {
  const db = await getDatabase();
  const records = await db.select<AudioEffectPresetRecord[]>(
    'SELECT * FROM audio_effect_presets ORDER BY category, name'
  );
  return records.map(presetRecordToInterface);
}

export async function getAudioEffectPresetsByCategory(
  category: AudioEffectCategory
): Promise<AudioEffectPreset[]> {
  const db = await getDatabase();
  const records = await db.select<AudioEffectPresetRecord[]>(
    'SELECT * FROM audio_effect_presets WHERE category = ? ORDER BY name',
    [category]
  );
  return records.map(presetRecordToInterface);
}

export async function getAudioEffectPresetById(id: string): Promise<AudioEffectPreset | null> {
  const db = await getDatabase();
  const records = await db.select<AudioEffectPresetRecord[]>(
    'SELECT * FROM audio_effect_presets WHERE id = ?',
    [id]
  );
  return records.length > 0 ? presetRecordToInterface(records[0]) : null;
}

export async function createAudioEffectPreset(
  preset: Omit<AudioEffectPreset, 'createdAt'>
): Promise<AudioEffectPreset> {
  const db = await getDatabase();
  const now = Date.now();

  await db.execute(
    `INSERT INTO audio_effect_presets 
     (id, name, effect_type, category, description, icon, ffmpeg_filter, 
      web_audio_config, default_parameters, parameter_schema, is_built_in, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      preset.id,
      preset.name,
      preset.effectType,
      preset.category,
      preset.description ?? null,
      preset.icon ?? null,
      preset.ffmpegFilter,
      preset.webAudioConfig ? JSON.stringify(preset.webAudioConfig) : null,
      preset.defaultParameters ? JSON.stringify(preset.defaultParameters) : null,
      preset.parameterSchema ? JSON.stringify(preset.parameterSchema) : null,
      preset.isBuiltIn ? 1 : 0,
      now,
    ]
  );

  return { ...preset, createdAt: now };
}

export async function deleteAudioEffectPreset(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM audio_effect_presets WHERE id = ?', [id]);
}

// ============================================
// Audio Track Effects CRUD
// ============================================

export async function getAudioTrackEffects(trackId: string): Promise<AudioTrackEffect[]> {
  const db = await getDatabase();
  const records = await db.select<AudioTrackEffectRecord[]>(
    'SELECT * FROM audio_track_effects WHERE track_id = ? ORDER BY order_index',
    [trackId]
  );
  return records.map(effectRecordToInterface);
}

export async function getAudioTrackEffectsByClip(clipEditId: string): Promise<AudioTrackEffect[]> {
  const db = await getDatabase();
  const records = await db.select<AudioTrackEffectRecord[]>(
    'SELECT * FROM audio_track_effects WHERE clip_edit_id = ? ORDER BY track_id, order_index',
    [clipEditId]
  );
  return records.map(effectRecordToInterface);
}

export async function getAudioTrackEffectsByProject(
  projectId: string
): Promise<AudioTrackEffect[]> {
  const db = await getDatabase();
  const records = await db.select<AudioTrackEffectRecord[]>(
    'SELECT * FROM audio_track_effects WHERE video_editor_project_id = ? ORDER BY track_id, order_index',
    [projectId]
  );
  return records.map(effectRecordToInterface);
}

export async function getAudioTrackEffectById(id: string): Promise<AudioTrackEffect | null> {
  const db = await getDatabase();
  const records = await db.select<AudioTrackEffectRecord[]>(
    'SELECT * FROM audio_track_effects WHERE id = ?',
    [id]
  );
  return records.length > 0 ? effectRecordToInterface(records[0]) : null;
}

export async function createAudioTrackEffect(
  effect: Omit<AudioTrackEffect, 'createdAt'>
): Promise<AudioTrackEffect> {
  const db = await getDatabase();
  const now = Date.now();

  await db.execute(
    `INSERT INTO audio_track_effects 
     (id, track_id, clip_edit_id, video_editor_project_id, effect_type, preset_id,
      start_time, end_time, intensity, parameters, is_enabled, order_index, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      effect.id,
      effect.trackId,
      effect.clipEditId ?? null,
      effect.videoEditorProjectId ?? null,
      effect.effectType,
      effect.presetId ?? null,
      effect.startTime,
      effect.endTime,
      effect.intensity,
      effect.parameters ? JSON.stringify(effect.parameters) : null,
      effect.isEnabled ? 1 : 0,
      effect.orderIndex,
      now,
    ]
  );

  return { ...effect, createdAt: now };
}

export async function updateAudioTrackEffect(
  id: string,
  updates: Partial<Omit<AudioTrackEffect, 'id' | 'createdAt'>>
): Promise<void> {
  const db = await getDatabase();
  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (updates.trackId !== undefined) {
    setClauses.push('track_id = ?');
    values.push(updates.trackId);
  }
  if (updates.effectType !== undefined) {
    setClauses.push('effect_type = ?');
    values.push(updates.effectType);
  }
  if (updates.presetId !== undefined) {
    setClauses.push('preset_id = ?');
    values.push(updates.presetId);
  }
  if (updates.startTime !== undefined) {
    setClauses.push('start_time = ?');
    values.push(updates.startTime);
  }
  if (updates.endTime !== undefined) {
    setClauses.push('end_time = ?');
    values.push(updates.endTime);
  }
  if (updates.intensity !== undefined) {
    setClauses.push('intensity = ?');
    values.push(updates.intensity);
  }
  if (updates.parameters !== undefined) {
    setClauses.push('parameters = ?');
    values.push(JSON.stringify(updates.parameters));
  }
  if (updates.isEnabled !== undefined) {
    setClauses.push('is_enabled = ?');
    values.push(updates.isEnabled ? 1 : 0);
  }
  if (updates.orderIndex !== undefined) {
    setClauses.push('order_index = ?');
    values.push(updates.orderIndex);
  }

  if (setClauses.length === 0) return;

  values.push(id);
  await db.execute(
    `UPDATE audio_track_effects SET ${setClauses.join(', ')} WHERE id = ?`,
    values
  );
}

export async function deleteAudioTrackEffect(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM audio_track_effects WHERE id = ?', [id]);
}

export async function deleteAudioTrackEffectsByTrack(trackId: string): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM audio_track_effects WHERE track_id = ?', [trackId]);
}

// ============================================
// Audio Effect Keyframes CRUD
// ============================================

export async function getAudioEffectKeyframes(effectId: string): Promise<AudioEffectKeyframe[]> {
  const db = await getDatabase();
  const records = await db.select<AudioEffectKeyframeRecord[]>(
    'SELECT * FROM audio_effect_keyframes WHERE effect_id = ? ORDER BY time',
    [effectId]
  );
  return records.map(keyframeRecordToInterface);
}

export async function createAudioEffectKeyframe(
  keyframe: Omit<AudioEffectKeyframe, 'createdAt'>
): Promise<AudioEffectKeyframe> {
  const db = await getDatabase();
  const now = Date.now();

  await db.execute(
    `INSERT INTO audio_effect_keyframes 
     (id, effect_id, parameter_name, time, value, easing, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      keyframe.id,
      keyframe.effectId,
      keyframe.parameterName,
      keyframe.time,
      keyframe.value,
      keyframe.easing,
      now,
    ]
  );

  return { ...keyframe, createdAt: now };
}

export async function updateAudioEffectKeyframe(
  id: string,
  updates: Partial<Omit<AudioEffectKeyframe, 'id' | 'effectId' | 'createdAt'>>
): Promise<void> {
  const db = await getDatabase();
  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (updates.parameterName !== undefined) {
    setClauses.push('parameter_name = ?');
    values.push(updates.parameterName);
  }
  if (updates.time !== undefined) {
    setClauses.push('time = ?');
    values.push(updates.time);
  }
  if (updates.value !== undefined) {
    setClauses.push('value = ?');
    values.push(updates.value);
  }
  if (updates.easing !== undefined) {
    setClauses.push('easing = ?');
    values.push(updates.easing);
  }

  if (setClauses.length === 0) return;

  values.push(id);
  await db.execute(
    `UPDATE audio_effect_keyframes SET ${setClauses.join(', ')} WHERE id = ?`,
    values
  );
}

export async function deleteAudioEffectKeyframe(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM audio_effect_keyframes WHERE id = ?', [id]);
}

// ============================================
// Bulk Operations
// ============================================

export async function seedAudioEffectPresets(
  presets: Omit<AudioEffectPreset, 'createdAt'>[]
): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();

  for (const preset of presets) {
    // Check if preset already exists
    const existing = await db.select<{ id: string }[]>(
      'SELECT id FROM audio_effect_presets WHERE id = ?',
      [preset.id]
    );

    if (existing.length === 0) {
      await db.execute(
        `INSERT INTO audio_effect_presets 
         (id, name, effect_type, category, description, icon, ffmpeg_filter, 
          web_audio_config, default_parameters, parameter_schema, is_built_in, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          preset.id,
          preset.name,
          preset.effectType,
          preset.category,
          preset.description ?? null,
          preset.icon ?? null,
          preset.ffmpegFilter,
          preset.webAudioConfig ? JSON.stringify(preset.webAudioConfig) : null,
          preset.defaultParameters ? JSON.stringify(preset.defaultParameters) : null,
          preset.parameterSchema ? JSON.stringify(preset.parameterSchema) : null,
          preset.isBuiltIn ? 1 : 0,
          now,
        ]
      );
    }
  }
}

export async function getAudioEffectCategories(): Promise<
  { category: AudioEffectCategory; count: number }[]
> {
  const db = await getDatabase();
  const records = await db.select<{ category: string; count: number }[]>(
    'SELECT category, COUNT(*) as count FROM audio_effect_presets GROUP BY category ORDER BY category'
  );
  return records.map((r) => ({
    category: r.category as AudioEffectCategory,
    count: r.count,
  }));
}
