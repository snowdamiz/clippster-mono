import type { ServerUserAsset, ServerUserCreatorProfile } from '@clippster/api-client';
import * as FileSystem from 'expo-file-system/legacy';
import { getDatabase } from './database';
import { userBrandingApi } from './api';

const CACHE_DIR = `${FileSystem.documentDirectory}user-assets/`;

export interface CachedUserAsset {
  server_id: number;
  asset_type: string;
  name: string;
  local_path: string;
  url: string;
  content_hash: string | null;
  updated_at: string;
}

export interface CachedUserCreatorProfile {
  server_id: number;
  client_id: string | null;
  name: string;
  description: string | null;
  profile_image_url: string | null;
  intro_id: number | null;
  outro_id: number | null;
  watermark_id: number | null;
  watermark_settings: string | null;
  intro_outro_settings: string | null;
  intro_ratio_settings: string | null;
  outro_ratio_settings: string | null;
  layout_overlays: string | null;
  scope: string;
  disabled: number;
  clip_build_defaults: string | null;
  updated_at: string;
}

async function ensureCacheDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
}

function assetFileName(asset: ServerUserAsset): string {
  const ext = asset.mime_type?.includes('png')
    ? 'png'
    : asset.mime_type?.includes('webm')
      ? 'webm'
      : asset.mime_type?.includes('mov')
        ? 'mov'
        : asset.mime_type?.includes('jpeg') || asset.mime_type?.includes('jpg')
          ? 'jpg'
          : 'mp4';
  return `${asset.id}_${asset.asset_type}.${ext}`;
}

export async function getCachedUserAsset(serverId: number): Promise<CachedUserAsset | null> {
  const db = getDatabase();
  return db.getFirstAsync<CachedUserAsset>(
    `SELECT server_id, asset_type, name, local_path, url, content_hash, updated_at
     FROM user_assets_cache WHERE server_id = ?`,
    [serverId],
  );
}

export async function listCachedUserProfiles(): Promise<CachedUserCreatorProfile[]> {
  const db = getDatabase();
  return db.getAllAsync<CachedUserCreatorProfile>(
    `SELECT * FROM user_creator_profiles_cache ORDER BY name ASC`,
  );
}

export async function ensureUserAssetDownloaded(
  asset: ServerUserAsset,
): Promise<{ success: boolean; localPath?: string; error?: string }> {
  try {
    const cached = await getCachedUserAsset(asset.id);
    if (cached && cached.updated_at === asset.updated_at) {
      const info = await FileSystem.getInfoAsync(cached.local_path);
      if (info.exists) return { success: true, localPath: cached.local_path };
    }

    await ensureCacheDir();
    const localPath = `${CACHE_DIR}${assetFileName(asset)}`;
    const result = await FileSystem.downloadAsync(asset.url, localPath);
    if (result.status !== 200) {
      return { success: false, error: `Download failed (${result.status})` };
    }

    const db = getDatabase();
    await db.runAsync(
      `INSERT INTO user_assets_cache (server_id, asset_type, name, local_path, url, content_hash, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(server_id) DO UPDATE SET
         asset_type = excluded.asset_type,
         name = excluded.name,
         local_path = excluded.local_path,
         url = excluded.url,
         content_hash = excluded.content_hash,
         updated_at = excluded.updated_at`,
      [
        asset.id,
        asset.asset_type,
        asset.name,
        localPath,
        asset.url,
        asset.content_hash,
        asset.updated_at,
      ],
    );

    return { success: true, localPath };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function upsertCachedProfile(profile: ServerUserCreatorProfile): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `INSERT INTO user_creator_profiles_cache (
      server_id, client_id, name, description, profile_image_url,
      intro_id, outro_id, watermark_id, watermark_settings, intro_outro_settings,
      intro_ratio_settings, outro_ratio_settings, layout_overlays, scope, disabled,
      clip_build_defaults, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(server_id) DO UPDATE SET
      client_id = excluded.client_id,
      name = excluded.name,
      description = excluded.description,
      profile_image_url = excluded.profile_image_url,
      intro_id = excluded.intro_id,
      outro_id = excluded.outro_id,
      watermark_id = excluded.watermark_id,
      watermark_settings = excluded.watermark_settings,
      intro_outro_settings = excluded.intro_outro_settings,
      intro_ratio_settings = excluded.intro_ratio_settings,
      outro_ratio_settings = excluded.outro_ratio_settings,
      layout_overlays = excluded.layout_overlays,
      scope = excluded.scope,
      disabled = excluded.disabled,
      clip_build_defaults = excluded.clip_build_defaults,
      updated_at = excluded.updated_at`,
    [
      profile.id,
      profile.client_id,
      profile.name,
      profile.description,
      profile.profile_image_url,
      profile.intro_id,
      profile.outro_id,
      profile.watermark_id,
      profile.watermark_settings ? JSON.stringify(profile.watermark_settings) : null,
      profile.intro_outro_settings ? JSON.stringify(profile.intro_outro_settings) : null,
      profile.intro_ratio_settings,
      profile.outro_ratio_settings,
      JSON.stringify(profile.layout_overlays ?? []),
      profile.scope,
      profile.disabled ? 1 : 0,
      profile.clip_build_defaults ? JSON.stringify(profile.clip_build_defaults) : null,
      profile.updated_at,
    ],
  );
}

/** Pull cloud personal branding (assets + profiles) onto the device. */
export async function syncPersonalBrandingFromCloud(): Promise<{
  assets: number;
  profiles: number;
  failed: number;
}> {
  const bundle = await userBrandingApi.getBundle();
  if (!bundle.success) {
    return { assets: 0, profiles: 0, failed: 0 };
  }

  let assets = 0;
  let failed = 0;
  for (const asset of bundle.assets) {
    const result = await ensureUserAssetDownloaded(asset);
    if (result.success) assets += 1;
    else failed += 1;
  }

  for (const profile of bundle.profiles) {
    await upsertCachedProfile(profile);
  }

  return { assets, profiles: bundle.profiles.length, failed };
}

export async function resolvePersonalBrandingPaths(profile: CachedUserCreatorProfile): Promise<{
  watermarkPath: string | null;
  introPath: string | null;
  outroPath: string | null;
}> {
  const watermark = profile.watermark_id ? await getCachedUserAsset(profile.watermark_id) : null;
  const intro = profile.intro_id ? await getCachedUserAsset(profile.intro_id) : null;
  const outro = profile.outro_id ? await getCachedUserAsset(profile.outro_id) : null;
  return {
    watermarkPath: watermark?.local_path ?? null,
    introPath: intro?.local_path ?? null,
    outroPath: outro?.local_path ?? null,
  };
}
