/**
 * Sync personal creator profiles + branding assets between local SQLite and cloud.
 * Uses /user/assets + /user/creator-profiles (same R2 asset model as orgs).
 */
import { invoke } from '@tauri-apps/api/core';
import { readFile } from '@tauri-apps/plugin-fs';
import api from './api';
import {
  ensureOrganizationAssetColumns,
  getAllCreatorProfiles,
  getIntroOutroById,
  getWatermarkImage,
  createOrganizationIntroOutro,
  createOrganizationWatermark,
  getIntroOutroByServerId,
  getWatermarkByServerId,
} from '@/services/database';
import { getDatabase, getCurrentUserId } from '@/services/database/core';

const PERSONAL_ORG_MARKER = 'personal';

interface ServerUserAsset {
  id: number;
  asset_type: string;
  name: string;
  url: string;
  updated_at: string;
  width?: number | null;
  height?: number | null;
  file_size?: number | null;
  duration?: number | null;
}

interface ServerUserCreatorProfile {
  id: number;
  client_id: string | null;
  name: string;
}

async function ensurePersonalServerIdColumn(): Promise<void> {
  const db = await getDatabase();
  await ensureOrganizationAssetColumns();
  const columns = (await db.select(`PRAGMA table_info(creator_profiles)`)) as { name: string }[];
  if (!columns.some((c) => c.name === 'server_id')) {
    await db.execute('ALTER TABLE creator_profiles ADD COLUMN server_id INTEGER');
  }
}

async function uploadLocalFileAsUserAsset(
  filePath: string,
  assetType: string,
  name: string
): Promise<number | null> {
  const bytes = await readFile(filePath);
  const blob = new Blob([bytes]);
  const form = new FormData();
  form.append('asset_type', assetType);
  form.append('name', name);
  form.append('file', blob, name);

  const response = await api.post('/user/assets', form);
  if (!response.data?.success || !response.data.asset?.id) {
    console.warn('[PersonalBranding] upload failed', response.data?.error);
    return null;
  }
  return response.data.asset.id as number;
}

async function markLocalAssetServerId(
  table: 'intro_outros' | 'watermark_images',
  localId: string,
  serverId: number
): Promise<void> {
  const db = await getDatabase();
  await db.execute(`UPDATE ${table} SET server_id = ?, sync_status = 'synced' WHERE id = ?`, [
    serverId,
    localId,
  ]);
}

export async function syncPersonalBranding(): Promise<{
  uploadedAssets: number;
  upsertedProfiles: number;
  downloadedAssets: number;
}> {
  await ensurePersonalServerIdColumn();
  if (!getCurrentUserId()) {
    throw new Error('Not signed in');
  }

  let uploadedAssets = 0;
  let upsertedProfiles = 0;
  let downloadedAssets = 0;

  const profiles = await getAllCreatorProfiles();
  const personal = profiles.filter((p) => !String(p.id).startsWith('org-'));
  const localToServerAsset = new Map<string, number>();

  for (const profile of personal) {
    for (const [field, assetType] of [
      ['intro_id', 'intro'],
      ['outro_id', 'outro'],
    ] as const) {
      const localId = profile[field];
      if (!localId || localId.startsWith('org-asset-')) continue;
      const row = await getIntroOutroById(localId);
      if (!row?.file_path) continue;
      if (row.server_id) {
        localToServerAsset.set(localId, row.server_id);
        continue;
      }
      const serverId = await uploadLocalFileAsUserAsset(row.file_path, assetType, row.name || assetType);
      if (serverId) {
        await markLocalAssetServerId('intro_outros', row.id, serverId);
        localToServerAsset.set(localId, serverId);
        uploadedAssets += 1;
      }
    }

    if (profile.watermark_id && !profile.watermark_id.startsWith('org-asset-')) {
      const watermark = await getWatermarkImage(profile.watermark_id);
      if (watermark?.file_path) {
        const existingServerId = (watermark as { server_id?: number | null }).server_id;
        if (existingServerId) {
          localToServerAsset.set(watermark.id, existingServerId);
        } else {
          const serverId = await uploadLocalFileAsUserAsset(
            watermark.file_path,
            'watermark',
            watermark.name || 'watermark'
          );
          if (serverId) {
            await markLocalAssetServerId('watermark_images', watermark.id, serverId);
            localToServerAsset.set(watermark.id, serverId);
            uploadedAssets += 1;
          }
        }
      }
    }

    const body = {
      client_id: profile.id,
      name: profile.name,
      description: profile.description,
      scope:
        profile.scope === 'global'
          ? 'global'
          : profile.scope === 'streamer'
            ? 'streamer'
            : 'personal_studio',
      disabled: Boolean(profile.disabled),
      intro_id: profile.intro_id ? localToServerAsset.get(profile.intro_id) ?? null : null,
      outro_id: profile.outro_id ? localToServerAsset.get(profile.outro_id) ?? null : null,
      watermark_id: profile.watermark_id
        ? localToServerAsset.get(profile.watermark_id) ?? null
        : null,
      watermark_settings: profile.watermark_settings
        ? JSON.parse(profile.watermark_settings)
        : null,
      intro_outro_settings: profile.intro_outro_settings
        ? JSON.parse(profile.intro_outro_settings)
        : null,
      intro_ratio_settings: profile.intro_ratio_settings,
      outro_ratio_settings: profile.outro_ratio_settings,
      layout_overlays: profile.layout_overlays ? JSON.parse(profile.layout_overlays) : [],
    };

    const response = await api.post('/user/creator-profiles', body);
    if (response.data?.success && response.data.profile?.id) {
      const db = await getDatabase();
      await db.execute('UPDATE creator_profiles SET server_id = ? WHERE id = ?', [
        response.data.profile.id,
        profile.id,
      ]);
      upsertedProfiles += 1;
    }
  }

  const bundle = await api.get('/user/branding');
  if (bundle.data?.success) {
    const assets = (bundle.data.assets ?? []) as ServerUserAsset[];
    for (const asset of assets) {
      try {
        if (asset.asset_type === 'intro' || asset.asset_type === 'outro') {
          if (await getIntroOutroByServerId(asset.id)) continue;
          const localFilePath = await invoke<string>('download_org_asset_from_url', {
            url: asset.url,
            filename: `user_${asset.id}_${asset.asset_type}`,
            assetType: asset.asset_type,
            organizationId: PERSONAL_ORG_MARKER,
          });
          await createOrganizationIntroOutro(
            asset.asset_type,
            asset.name,
            localFilePath,
            PERSONAL_ORG_MARKER,
            'Personal',
            asset.id,
            { duration: asset.duration || undefined }
          );
          downloadedAssets += 1;
        } else if (asset.asset_type === 'watermark') {
          if (await getWatermarkByServerId(asset.id)) continue;
          const localFilePath = await invoke<string>('download_org_asset_from_url', {
            url: asset.url,
            filename: `user_${asset.id}_watermark`,
            assetType: 'watermark',
            organizationId: PERSONAL_ORG_MARKER,
          });
          await createOrganizationWatermark(
            asset.name,
            localFilePath,
            PERSONAL_ORG_MARKER,
            'Personal',
            asset.id,
            {
              width: asset.width || undefined,
              height: asset.height || undefined,
              fileSize: asset.file_size || undefined,
            }
          );
          downloadedAssets += 1;
        }
      } catch (error) {
        console.warn('[PersonalBranding] download failed', asset.id, error);
      }
    }

    const remoteProfiles = (bundle.data.profiles ?? []) as ServerUserCreatorProfile[];
    for (const remote of remoteProfiles) {
      if (remote.client_id && personal.some((p) => p.id === remote.client_id)) continue;
      console.log('[PersonalBranding] remote-only profile available on mobile sync', remote.id, remote.name);
    }
  }

  return { uploadedAssets, upsertedProfiles, downloadedAssets };
}
