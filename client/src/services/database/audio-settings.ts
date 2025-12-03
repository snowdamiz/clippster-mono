import { getDatabase, timestamp } from './core';
import type { AudioSettings } from './types';

/**
 * Get default audio settings
 */
export function getDefaultAudioSettings(): AudioSettings {
  return {
    volume: 0, // 0 dB (no change)
    normalize: false, // normalization disabled
  };
}

/**
 * Get audio settings for a project
 * Returns default settings if project has no audio settings stored
 */
export async function getProjectAudioSettings(projectId: string): Promise<AudioSettings> {
  const db = await getDatabase();
  const result = await db.select<{ audio_settings: string | null }[]>(
    'SELECT audio_settings FROM projects WHERE id = ?',
    [projectId]
  );

  if (!result[0]?.audio_settings) {
    return getDefaultAudioSettings();
  }

  try {
    const parsed = JSON.parse(result[0].audio_settings) as Partial<AudioSettings>;
    // Merge with defaults to ensure all fields exist
    return {
      ...getDefaultAudioSettings(),
      ...parsed,
    };
  } catch (error) {
    console.error('[AudioSettings] Failed to parse audio settings:', error);
    return getDefaultAudioSettings();
  }
}

/**
 * Update audio settings for a project
 */
export async function updateProjectAudioSettings(
  projectId: string,
  settings: AudioSettings
): Promise<void> {
  const db = await getDatabase();
  const now = timestamp();

  // Validate and clamp values
  const validatedSettings: AudioSettings = {
    volume: Math.max(-20, Math.min(20, settings.volume)),
    normalize: Boolean(settings.normalize),
  };

  const settingsJson = JSON.stringify(validatedSettings);

  await db.execute('UPDATE projects SET audio_settings = ?, updated_at = ? WHERE id = ?', [
    settingsJson,
    now,
    projectId,
  ]);
}
