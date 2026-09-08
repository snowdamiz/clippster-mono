import type { BrandingConfig, ServerOrganizationAsset } from '@clippster/api-client';
import * as FileSystem from 'expo-file-system/legacy';
import { getDatabase } from './database';
import { organizationAssetsApi } from './api';

const CACHE_DIR = `${FileSystem.documentDirectory}org-assets/`;

export interface CachedOrgAsset {
  server_id: number;
  org_id: number;
  asset_type: string;
  local_path: string;
  url: string;
  updated_at: string;
}

async function ensureCacheDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
}

function assetFileName(asset: ServerOrganizationAsset): string {
  const ext = asset.mime_type?.includes('png')
    ? 'png'
    : asset.mime_type?.includes('webm')
      ? 'webm'
      : asset.mime_type?.includes('mov')
        ? 'mov'
        : 'mp4';
  return `${asset.organization_id}_${asset.id}_${asset.asset_type}.${ext}`;
}

export async function getCachedAsset(serverId: number): Promise<CachedOrgAsset | null> {
  const db = getDatabase();
  return db.getFirstAsync<CachedOrgAsset>(
    'SELECT server_id, org_id, asset_type, local_path, url, updated_at FROM organization_assets_cache WHERE server_id = ?',
    [serverId],
  );
}

export async function ensureOrgAssetDownloaded(
  asset: ServerOrganizationAsset,
): Promise<{ success: boolean; localPath?: string; error?: string }> {
  try {
    const cached = await getCachedAsset(asset.id);
    if (cached && cached.updated_at === asset.updated_at) {
      const info = await FileSystem.getInfoAsync(cached.local_path);
      if (info.exists) {
        return { success: true, localPath: cached.local_path };
      }
    }

    await ensureCacheDir();
    const localPath = `${CACHE_DIR}${assetFileName(asset)}`;
    const result = await FileSystem.downloadAsync(asset.url, localPath);
    if (result.status !== 200) {
      return { success: false, error: `Download failed (${result.status})` };
    }

    const db = getDatabase();
    await db.runAsync(
      `INSERT INTO organization_assets_cache (server_id, org_id, asset_type, local_path, url, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(server_id) DO UPDATE SET
         org_id = excluded.org_id,
         asset_type = excluded.asset_type,
         local_path = excluded.local_path,
         url = excluded.url,
         updated_at = excluded.updated_at`,
      [asset.id, asset.organization_id, asset.asset_type, localPath, asset.url, asset.updated_at],
    );

    return { success: true, localPath };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

export async function syncUserOrganizationAssets(): Promise<{
  downloaded: number;
  failed: number;
}> {
  const response = await organizationAssetsApi.getUserOrganizationAssets();
  if (!response.success) {
    return { downloaded: 0, failed: 0 };
  }

  let downloaded = 0;
  let failed = 0;

  for (const asset of response.assets) {
    const cached = await getCachedAsset(asset.id);
    if (cached?.updated_at === asset.updated_at) {
      const info = await FileSystem.getInfoAsync(cached.local_path);
      if (info.exists) continue;
    }

    const result = await ensureOrgAssetDownloaded(asset);
    if (result.success) downloaded++;
    else failed++;
  }

  return { downloaded, failed };
}

export interface ResolvedBrandingPaths {
  watermarkPath?: string;
  introPath?: string;
  outroPath?: string;
  watermarkSettings?: BrandingConfig[string]['watermark_settings'];
}

export async function resolveBrandingForAspect(
  brandingConfig: BrandingConfig | null | undefined,
  aspectRatio: string,
  assets: ServerOrganizationAsset[],
): Promise<ResolvedBrandingPaths> {
  if (!brandingConfig) return {};

  const ratioConfig = brandingConfig[aspectRatio] ?? brandingConfig['9:16'];
  if (!ratioConfig) return {};

  const resolved: ResolvedBrandingPaths = {
    watermarkSettings: ratioConfig.watermark_settings,
  };

  const assetMap = new Map(assets.map((a) => [String(a.id), a]));

  const watermarkId = ratioConfig.watermark_id ? Number(ratioConfig.watermark_id) : null;
  const introId = ratioConfig.intro_id ? Number(ratioConfig.intro_id) : null;
  const outroId = ratioConfig.outro_id ? Number(ratioConfig.outro_id) : null;

  if (watermarkId) {
    const asset = assetMap.get(String(watermarkId));
    if (asset) {
      const dl = await ensureOrgAssetDownloaded(asset);
      if (dl.localPath) resolved.watermarkPath = dl.localPath;
    }
  }
  if (introId) {
    const asset = assetMap.get(String(introId));
    if (asset) {
      const dl = await ensureOrgAssetDownloaded(asset);
      if (dl.localPath) resolved.introPath = dl.localPath;
    }
  }
  if (outroId) {
    const asset = assetMap.get(String(outroId));
    if (asset) {
      const dl = await ensureOrgAssetDownloaded(asset);
      if (dl.localPath) resolved.outroPath = dl.localPath;
    }
  }

  return resolved;
}

export async function getAllCachedAssets(): Promise<ServerOrganizationAsset[]> {
  const response = await organizationAssetsApi.getUserOrganizationAssets();
  return response.success ? response.assets : [];
}
