import type { ActiveVodPresetConfig } from '@clippster/shared-types';
import { createDefaultActiveVodPresetConfig, parseActiveVodPresetConfig } from '@clippster/shared-types';
import { getDatabase, timestamp } from './index';

export async function getProjectVodPresetConfig(
  projectId: string,
): Promise<ActiveVodPresetConfig | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<{ active_vod_preset_config: string | null }>(
    'SELECT active_vod_preset_config FROM projects WHERE id = ?',
    [projectId],
  );
  return parseActiveVodPresetConfig(row?.active_vod_preset_config);
}

export async function setProjectVodPresetConfig(
  projectId: string,
  config: ActiveVodPresetConfig,
  presetId: string | null = null,
): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    'UPDATE projects SET active_vod_preset_id = ?, active_vod_preset_config = ?, updated_at = ? WHERE id = ?',
    [presetId, JSON.stringify(config), timestamp(), projectId],
  );
}

export async function getOrCreateProjectVodPresetConfig(
  projectId: string,
  defaultRatio: '9:16' | '16:9' = '9:16',
): Promise<ActiveVodPresetConfig> {
  const existing = await getProjectVodPresetConfig(projectId);
  if (existing) return existing;
  const config = createDefaultActiveVodPresetConfig(defaultRatio);
  await setProjectVodPresetConfig(projectId, config);
  return config;
}

export async function clearProjectVodPresetConfig(projectId: string): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    'UPDATE projects SET active_vod_preset_id = NULL, active_vod_preset_config = NULL, updated_at = ? WHERE id = ?',
    [timestamp(), projectId],
  );
}
