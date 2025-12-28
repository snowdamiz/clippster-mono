import { getDatabase, timestamp, generateId, getCurrentUserId } from './core';
import type { WatermarkImage } from './types';
import { getWatermarkByServerId } from './organization-assets';
import { getUserOrganizationAssets } from '../organizationAssetsApi';
import { ensureAssetDownloaded } from '../orgAssetSync';

// Re-export the type for consumers who import directly from this module
export type { WatermarkImage } from './types';

export async function createWatermarkImage(
  name: string,
  filePath: string,
  width?: number,
  height?: number,
  fileSize?: number
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();
  const userId = getCurrentUserId();

  await db.execute(
    'INSERT INTO watermark_images (id, name, file_path, width, height, file_size, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, name, filePath, width || null, height || null, fileSize || null, userId, now, now]
  );

  return id;
}

export async function getAllWatermarkImages(): Promise<WatermarkImage[]> {
  const db = await getDatabase();
  const userId = getCurrentUserId();

  if (userId === null) {
    return await db.select<WatermarkImage[]>(
      'SELECT * FROM watermark_images WHERE user_id IS NULL ORDER BY name'
    );
  }

  return await db.select<WatermarkImage[]>(
    'SELECT * FROM watermark_images WHERE user_id = ? OR user_id IS NULL ORDER BY name',
    [userId]
  );
}

export async function getWatermarkImage(id: string): Promise<WatermarkImage | null> {
  const db = await getDatabase();
  const results = await db.select<WatermarkImage[]>('SELECT * FROM watermark_images WHERE id = ?', [
    id,
  ]);
  return results.length > 0 ? results[0] : null;
}

export async function updateWatermarkImage(
  id: string,
  updates: {
    name?: string;
    width?: number;
    height?: number;
  }
): Promise<void> {
  const db = await getDatabase();
  const now = timestamp();

  const setClause: string[] = ['updated_at = ?'];
  const params: any[] = [now];

  if (updates.name !== undefined) {
    setClause.push('name = ?');
    params.push(updates.name);
  }
  if (updates.width !== undefined) {
    setClause.push('width = ?');
    params.push(updates.width);
  }
  if (updates.height !== undefined) {
    setClause.push('height = ?');
    params.push(updates.height);
  }

  params.push(id);
  await db.execute(`UPDATE watermark_images SET ${setClause.join(', ')} WHERE id = ?`, params);
}

export async function deleteWatermarkImage(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM watermark_images WHERE id = ?', [id]);
}

/**
 * Resolves a watermark by ID, handling both local database IDs and org-asset-{serverId} format.
 * Returns the watermark data including file_path, width, and height.
 * For org watermarks, downloads if not cached locally.
 */
export async function resolveWatermarkById(
  watermarkId: string | number | null | undefined
): Promise<{ filePath: string; width: number | null; height: number | null } | null> {
  if (watermarkId == null) return null;

  const wmIdStr = String(watermarkId);

  // Check if this is an organization asset (ID format: org-asset-{serverId})
  if (wmIdStr.startsWith('org-asset-')) {
    const serverId = parseInt(wmIdStr.replace('org-asset-', ''), 10);
    if (isNaN(serverId)) return null;

    // First try to load from local cache
    const localWatermark = await getWatermarkByServerId(serverId);
    if (localWatermark) {
      return {
        filePath: localWatermark.file_path,
        width: localWatermark.width ?? null,
        height: localWatermark.height ?? null,
      };
    }

    // Not cached locally - download from server
    try {
      const serverResponse = await getUserOrganizationAssets();
      if (serverResponse.success && serverResponse.assets) {
        const serverAsset = serverResponse.assets.find(
          (a) => a.id === serverId && a.asset_type === 'watermark'
        );
        if (serverAsset && serverAsset.url) {
          const downloadResult = await ensureAssetDownloaded(serverAsset);
          if (downloadResult.success && downloadResult.filePath) {
            return {
              filePath: downloadResult.filePath,
              width: serverAsset.width ?? null,
              height: serverAsset.height ?? null,
            };
          }
        }
      }
    } catch (error) {
      console.error('[resolveWatermarkById] Failed to download org watermark:', error);
    }

    return null;
  }

  // Regular watermark lookup by local database ID
  const watermark = await getWatermarkImage(wmIdStr);
  if (watermark) {
    return {
      filePath: watermark.file_path,
      width: watermark.width ?? null,
      height: watermark.height ?? null,
    };
  }

  return null;
}
