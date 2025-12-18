/**
 * Organization Asset Sync Service
 * Handles syncing organization assets from the server to local storage.
 */

import { invoke } from '@tauri-apps/api/core';
import { ref, computed } from 'vue';
import {
  getUserOrganizationAssets,
  downloadAssetFile,
  type ServerOrganizationAsset,
} from './organizationAssetsApi';
import {
  ensureOrganizationAssetColumns,
  createOrganizationIntroOutro,
  createOrganizationWatermark,
  createOrganizationAudioAsset,
  createOrganizationImageAsset,
  getLocalOrgAssetServerIds,
  deleteAssetsForRemovedOrganizations,
  deleteOrgAssetByServerId,
  updateAssetSyncStatus,
  getIntroOutroByServerId,
  getWatermarkByServerId,
  getAudioAssetByServerId,
  getImageAssetByServerId,
} from '@/services/database';
import { useAuthStore } from '@/stores/auth';

// ============================================
// Types
// ============================================

export interface SyncResult {
  success: boolean;
  downloaded: number;
  deleted: number;
  failed: number;
  errors: string[];
}

export interface SyncProgress {
  total: number;
  completed: number;
  current: string | null;
  status: 'idle' | 'syncing' | 'completed' | 'error';
}

// ============================================
// Reactive State
// ============================================

const syncProgress = ref<SyncProgress>({
  total: 0,
  completed: 0,
  current: null,
  status: 'idle',
});

const downloadingAssetIds = ref<Set<number>>(new Set());

// ============================================
// Public API
// ============================================

/**
 * Get the current sync progress.
 */
export function useSyncProgress() {
  return {
    progress: computed(() => syncProgress.value),
    isDownloading: (serverId: number) => downloadingAssetIds.value.has(serverId),
    downloadingAssetIds: computed(() => downloadingAssetIds.value),
  };
}

/**
 * Sync organization assets for the current user.
 * Downloads new assets and removes assets from orgs the user is no longer in.
 */
export async function syncOrganizationAssets(): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    downloaded: 0,
    deleted: 0,
    failed: 0,
    errors: [],
  };

  try {
    // Ensure database schema is up to date
    await ensureOrganizationAssetColumns();

    const authStore = useAuthStore();
    const user = authStore.user;

    if (!user) {
      console.log('[OrgSync] No user logged in, skipping sync');
      return result;
    }

    // Get current user's organization memberships
    const orgMemberships = authStore.organizationMemberships || [];
    const currentOrgIds = orgMemberships.map((m: any) =>
      String(m.organization?.id || m.organization_id)
    );

    console.log('[OrgSync] User org memberships:', currentOrgIds);

    // Clean up assets from organizations user is no longer in
    const deletedFromRemovedOrgs = await deleteAssetsForRemovedOrganizations(currentOrgIds);
    result.deleted += deletedFromRemovedOrgs;

    // If user has no orgs, we're done
    if (currentOrgIds.length === 0) {
      console.log('[OrgSync] User is not in any organizations');
      syncProgress.value = { total: 0, completed: 0, current: null, status: 'completed' };
      return result;
    }

    // Fetch all organization assets from server
    syncProgress.value.status = 'syncing';
    const serverResponse = await getUserOrganizationAssets();

    if (!serverResponse.success) {
      result.success = false;
      result.errors.push(serverResponse.error || 'Failed to fetch organization assets');
      syncProgress.value.status = 'error';
      return result;
    }

    const serverAssets = serverResponse.assets;
    console.log('[OrgSync] Server assets:', serverAssets.length);

    // Group server assets by organization
    const assetsByOrg = new Map<string, ServerOrganizationAsset[]>();
    for (const asset of serverAssets) {
      const orgId = String(asset.organization_id);
      if (!assetsByOrg.has(orgId)) {
        assetsByOrg.set(orgId, []);
      }
      assetsByOrg.get(orgId)!.push(asset);
    }

    // For each org, compare server assets with local assets
    for (const orgId of currentOrgIds) {
      const serverOrgAssets = assetsByOrg.get(orgId) || [];
      const localServerIds = await getLocalOrgAssetServerIds(orgId);

      // Find assets to download (on server but not local)
      const serverAssetIds = serverOrgAssets.map((a) => a.id);
      const allLocalServerIds = [
        ...localServerIds.introOutros,
        ...localServerIds.watermarks,
        ...localServerIds.audioAssets,
        ...localServerIds.imageAssets,
      ];

      const assetsToDownload = serverOrgAssets.filter((a) => !allLocalServerIds.includes(a.id));

      // Find assets to delete (local but not on server)
      const assetsToDelete: { type: string; serverId: number }[] = [];

      for (const serverId of localServerIds.introOutros) {
        if (!serverAssetIds.includes(serverId)) {
          assetsToDelete.push({ type: 'intro', serverId }); // Could be intro or outro, will check
        }
      }
      for (const serverId of localServerIds.watermarks) {
        if (!serverAssetIds.includes(serverId)) {
          assetsToDelete.push({ type: 'watermark', serverId });
        }
      }
      for (const serverId of localServerIds.audioAssets) {
        if (!serverAssetIds.includes(serverId)) {
          assetsToDelete.push({ type: 'audio', serverId });
        }
      }
      for (const serverId of localServerIds.imageAssets) {
        if (!serverAssetIds.includes(serverId)) {
          assetsToDelete.push({ type: 'image', serverId });
        }
      }

      console.log(
        `[OrgSync] Org ${orgId}: ${assetsToDownload.length} to download, ${assetsToDelete.length} to delete`
      );

      // Update progress tracking
      syncProgress.value.total = assetsToDownload.length;
      syncProgress.value.completed = 0;

      // Download new assets
      for (const asset of assetsToDownload) {
        syncProgress.value.current = asset.name;
        downloadingAssetIds.value.add(asset.id);

        try {
          await downloadAndSaveAsset(asset);
          result.downloaded++;
          syncProgress.value.completed++;
        } catch (error: any) {
          console.error(`[OrgSync] Failed to download asset ${asset.id}:`, error);
          result.failed++;
          result.errors.push(`Failed to download ${asset.name}: ${error.message}`);
        } finally {
          downloadingAssetIds.value.delete(asset.id);
        }
      }

      // Delete removed assets
      for (const { type, serverId } of assetsToDelete) {
        try {
          // Need to determine exact asset type for intro/outro
          const deleted = await deleteOrgAssetByServerId(type as any, serverId);
          if (deleted) {
            result.deleted++;
          }
        } catch (error: any) {
          console.error(`[OrgSync] Failed to delete asset ${serverId}:`, error);
          result.errors.push(`Failed to delete asset: ${error.message}`);
        }
      }
    }

    syncProgress.value.status = 'completed';
    syncProgress.value.current = null;
    console.log('[OrgSync] Sync complete:', result);
    return result;
  } catch (error: any) {
    console.error('[OrgSync] Sync failed:', error);
    result.success = false;
    result.errors.push(error.message || 'Unknown sync error');
    syncProgress.value.status = 'error';
    return result;
  }
}

/**
 * Downloads a single asset from the server and saves it locally.
 */
async function downloadAndSaveAsset(asset: ServerOrganizationAsset): Promise<void> {
  const orgId = String(asset.organization_id);
  const orgName = asset.organization_name || 'Organization';

  // Check if asset already exists locally
  let existing = null;
  if (asset.asset_type === 'intro' || asset.asset_type === 'outro') {
    existing = await getIntroOutroByServerId(asset.id);
  } else if (asset.asset_type === 'watermark') {
    existing = await getWatermarkByServerId(asset.id);
  } else if (asset.asset_type === 'audio') {
    existing = await getAudioAssetByServerId(asset.id);
  } else if (asset.asset_type === 'image') {
    existing = await getImageAssetByServerId(asset.id);
  }

  if (existing) {
    console.log(`[OrgSync] Asset ${asset.id} already exists locally, skipping`);
    return;
  }

  // Download the file
  console.log(`[OrgSync] Downloading asset: ${asset.name} from ${asset.url}`);
  const downloadResult = await downloadAssetFile(asset.url);

  if (!downloadResult.success || !downloadResult.blob) {
    throw new Error(downloadResult.error || 'Failed to download asset file');
  }

  // Convert blob to array buffer for Tauri
  const arrayBuffer = await downloadResult.blob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  // Determine the target folder based on asset type
  let targetFolder: string;
  switch (asset.asset_type) {
    case 'intro':
      targetFolder = 'intros';
      break;
    case 'outro':
      targetFolder = 'outros';
      break;
    case 'watermark':
      targetFolder = 'watermarks';
      break;
    case 'audio':
      targetFolder = 'audio';
      break;
    case 'image':
      targetFolder = 'images';
      break;
    default:
      targetFolder = 'other';
  }

  // Save the file using Tauri
  const localFilePath = await invoke<string>('save_org_asset_file', {
    data: Array.from(uint8Array),
    filename: asset.name,
    assetType: targetFolder,
    organizationId: orgId,
  });

  // Download thumbnail if present
  let thumbnailPath: string | null = null;
  if (asset.thumbnail_url) {
    try {
      const thumbResult = await downloadAssetFile(asset.thumbnail_url);
      if (thumbResult.success && thumbResult.blob) {
        const thumbBuffer = await thumbResult.blob.arrayBuffer();
        const thumbArray = new Uint8Array(thumbBuffer);
        thumbnailPath = await invoke<string>('save_org_asset_file', {
          data: Array.from(thumbArray),
          filename: `thumb_${asset.name}.jpg`,
          assetType: 'thumbnails',
          organizationId: orgId,
        });
      }
    } catch (thumbError) {
      console.warn(`[OrgSync] Failed to download thumbnail for ${asset.name}:`, thumbError);
    }
  }

  // Create local database record
  if (asset.asset_type === 'intro' || asset.asset_type === 'outro') {
    await createOrganizationIntroOutro(
      asset.asset_type,
      asset.name,
      localFilePath,
      orgId,
      orgName,
      asset.id,
      {
        duration: asset.duration || undefined,
        thumbnailPath,
      }
    );
  } else if (asset.asset_type === 'watermark') {
    await createOrganizationWatermark(asset.name, localFilePath, orgId, orgName, asset.id, {
      width: asset.width || undefined,
      height: asset.height || undefined,
      fileSize: asset.file_size || undefined,
    });
  } else if (asset.asset_type === 'audio') {
    await createOrganizationAudioAsset(asset.name, localFilePath, orgId, orgName, asset.id, {
      duration: asset.duration || undefined,
      fileSize: asset.file_size || undefined,
    });
  } else if (asset.asset_type === 'image') {
    await createOrganizationImageAsset(asset.name, localFilePath, orgId, orgName, asset.id, {
      width: asset.width || undefined,
      height: asset.height || undefined,
      fileSize: asset.file_size || undefined,
      mimeType: asset.mime_type || undefined,
    });
  }

  console.log(`[OrgSync] Successfully saved asset: ${asset.name} -> ${localFilePath}`);
}

/**
 * Force re-sync a single asset by server ID.
 * Useful for retry after errors.
 */
export async function resyncAsset(
  organizationId: string,
  serverId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const serverResponse = await getUserOrganizationAssets();
    if (!serverResponse.success) {
      return { success: false, error: serverResponse.error };
    }

    const asset = serverResponse.assets.find((a) => a.id === serverId);
    if (!asset) {
      return { success: false, error: 'Asset not found on server' };
    }

    // Delete existing local copy if any
    await deleteOrgAssetByServerId(asset.asset_type as any, serverId);

    // Download and save
    downloadingAssetIds.value.add(serverId);
    try {
      await downloadAndSaveAsset(asset);
      return { success: true };
    } finally {
      downloadingAssetIds.value.delete(serverId);
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Check if sync is currently in progress.
 */
export function isSyncing(): boolean {
  return syncProgress.value.status === 'syncing';
}

/**
 * Reset sync state.
 */
export function resetSyncState(): void {
  syncProgress.value = {
    total: 0,
    completed: 0,
    current: null,
    status: 'idle',
  };
  downloadingAssetIds.value.clear();
}
