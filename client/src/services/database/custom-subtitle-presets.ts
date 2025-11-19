import { getDatabase, timestamp, generateId } from './core';
import type { CustomSubtitlePreset, SubtitleSettings } from './types';

/**
 * Create a new custom subtitle preset
 */
export async function createCustomSubtitlePreset(
  name: string,
  description: string,
  settings: SubtitleSettings
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  await db.execute(
    `INSERT INTO custom_subtitle_presets (
      id, name, description,
      font_family, font_size, font_weight,
      text_color, background_color, background_enabled,
      border1_width, border1_color, border2_width, border2_color,
      shadow_offset_x, shadow_offset_y, shadow_blur, shadow_color,
      position, position_percentage, max_width,
      animation_style,
      line_height, letter_spacing, text_align,
      text_offset_x, text_offset_y, padding, border_radius, word_spacing,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      name,
      description,
      settings.fontFamily,
      settings.fontSize,
      settings.fontWeight,
      settings.textColor,
      settings.backgroundColor,
      settings.backgroundEnabled ? 1 : 0,
      settings.border1Width,
      settings.border1Color,
      settings.border2Width,
      settings.border2Color,
      settings.shadowOffsetX,
      settings.shadowOffsetY,
      settings.shadowBlur,
      settings.shadowColor,
      settings.position,
      settings.positionPercentage,
      settings.maxWidth,
      settings.animationStyle,
      settings.lineHeight,
      settings.letterSpacing,
      settings.textAlign,
      settings.textOffsetX,
      settings.textOffsetY,
      settings.padding,
      settings.borderRadius,
      settings.wordSpacing,
      now,
      now,
    ]
  );

  return id;
}

/**
 * Get a custom subtitle preset by ID
 */
export async function getCustomSubtitlePreset(id: string): Promise<CustomSubtitlePreset | null> {
  const db = await getDatabase();
  const result = await db.select<CustomSubtitlePreset[]>(
    'SELECT * FROM custom_subtitle_presets WHERE id = ?',
    [id]
  );

  if (result.length === 0) return null;

  // Convert SQLite boolean (0/1) to JavaScript boolean
  const preset = result[0];
  preset.background_enabled = preset.background_enabled === 1;

  return preset;
}

/**
 * Get all custom subtitle presets
 */
export async function getAllCustomSubtitlePresets(): Promise<CustomSubtitlePreset[]> {
  const db = await getDatabase();
  const presets = await db.select<CustomSubtitlePreset[]>(
    'SELECT * FROM custom_subtitle_presets ORDER BY created_at DESC'
  );

  // Convert SQLite booleans to JavaScript booleans
  return presets.map((preset) => ({
    ...preset,
    background_enabled: preset.background_enabled === 1,
  }));
}

/**
 * Update a custom subtitle preset
 */
export async function updateCustomSubtitlePreset(
  id: string,
  name?: string,
  description?: string,
  settings?: SubtitleSettings
): Promise<void> {
  const db = await getDatabase();
  const now = timestamp();

  const updates: string[] = [];
  const values: any[] = [];

  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }

  if (description !== undefined) {
    updates.push('description = ?');
    values.push(description);
  }

  if (settings) {
    updates.push('font_family = ?', 'font_size = ?', 'font_weight = ?');
    values.push(settings.fontFamily, settings.fontSize, settings.fontWeight);

    updates.push('text_color = ?', 'background_color = ?', 'background_enabled = ?');
    values.push(settings.textColor, settings.backgroundColor, settings.backgroundEnabled ? 1 : 0);

    updates.push(
      'border1_width = ?',
      'border1_color = ?',
      'border2_width = ?',
      'border2_color = ?'
    );
    values.push(
      settings.border1Width,
      settings.border1Color,
      settings.border2Width,
      settings.border2Color
    );

    updates.push(
      'shadow_offset_x = ?',
      'shadow_offset_y = ?',
      'shadow_blur = ?',
      'shadow_color = ?'
    );
    values.push(
      settings.shadowOffsetX,
      settings.shadowOffsetY,
      settings.shadowBlur,
      settings.shadowColor
    );

    updates.push('position = ?', 'position_percentage = ?', 'max_width = ?');
    values.push(settings.position, settings.positionPercentage, settings.maxWidth);

    updates.push('animation_style = ?');
    values.push(settings.animationStyle);

    updates.push(
      'line_height = ?',
      'letter_spacing = ?',
      'text_align = ?',
      'text_offset_x = ?',
      'text_offset_y = ?',
      'padding = ?',
      'border_radius = ?',
      'word_spacing = ?'
    );
    values.push(
      settings.lineHeight,
      settings.letterSpacing,
      settings.textAlign,
      settings.textOffsetX,
      settings.textOffsetY,
      settings.padding,
      settings.borderRadius,
      settings.wordSpacing
    );
  }

  updates.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await db.execute(`UPDATE custom_subtitle_presets SET ${updates.join(', ')} WHERE id = ?`, values);
}

/**
 * Delete a custom subtitle preset
 */
export async function deleteCustomSubtitlePreset(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM custom_subtitle_presets WHERE id = ?', [id]);
}

/**
 * Convert a CustomSubtitlePreset to SubtitleSettings
 */
export function customPresetToSettings(preset: CustomSubtitlePreset): SubtitleSettings {
  return {
    enabled: false,
    fontFamily: preset.font_family,
    fontSize: preset.font_size,
    fontWeight: preset.font_weight,
    textColor: preset.text_color,
    backgroundColor: preset.background_color,
    backgroundEnabled: preset.background_enabled,
    border1Width: preset.border1_width,
    border1Color: preset.border1_color,
    border2Width: preset.border2_width,
    border2Color: preset.border2_color,
    shadowOffsetX: preset.shadow_offset_x,
    shadowOffsetY: preset.shadow_offset_y,
    shadowBlur: preset.shadow_blur,
    shadowColor: preset.shadow_color,
    position: preset.position as 'top' | 'middle' | 'bottom',
    positionPercentage: preset.position_percentage,
    maxWidth: preset.max_width,
    animationStyle: (preset.animation_style as 'none' | 'fade' | 'word-by-word') || 'none',
    lineHeight: preset.line_height,
    letterSpacing: preset.letter_spacing,
    textAlign: preset.text_align as 'left' | 'center' | 'right',
    textOffsetX: preset.text_offset_x,
    textOffsetY: preset.text_offset_y,
    padding: preset.padding,
    borderRadius: preset.border_radius,
    wordSpacing: preset.word_spacing,
  };
}
