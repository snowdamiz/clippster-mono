import { getDatabase, timestamp, generateId, getCurrentUserId } from './core';
import type { IntroOutro } from './types';

export async function createIntroOutro(
  type: 'intro' | 'outro',
  name: string,
  filePath: string,
  duration?: number,
  thumbnailPath?: string | null,
  thumbnailGenerationStatus?: 'pending' | 'processing' | 'completed' | 'failed'
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();
  const userId = getCurrentUserId();

  await db.execute(
    'INSERT INTO intro_outros (id, type, name, file_path, duration, thumbnail_path, thumbnail_generation_status, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      id,
      type,
      name,
      filePath,
      duration || null,
      thumbnailPath || null,
      thumbnailGenerationStatus || 'pending',
      userId,
      now,
      now,
    ]
  );

  return id;
}

export async function getAllIntroOutros(type?: 'intro' | 'outro'): Promise<IntroOutro[]> {
  const db = await getDatabase();
  const userId = getCurrentUserId();

  if (type) {
    if (userId === null) {
      return await db.select<IntroOutro[]>(
        'SELECT * FROM intro_outros WHERE type = ? AND user_id IS NULL ORDER BY name',
        [type]
      );
    }
    return await db.select<IntroOutro[]>(
      'SELECT * FROM intro_outros WHERE type = ? AND (user_id = ? OR user_id IS NULL) ORDER BY name',
      [type, userId]
    );
  }

  if (userId === null) {
    return await db.select<IntroOutro[]>(
      'SELECT * FROM intro_outros WHERE user_id IS NULL ORDER BY type, name'
    );
  }
  return await db.select<IntroOutro[]>(
    'SELECT * FROM intro_outros WHERE user_id = ? OR user_id IS NULL ORDER BY type, name',
    [userId]
  );
}

export async function updateIntroOutroCompletion(
  id: string,
  filePath: string,
  thumbnailPath: string | null,
  duration: number | undefined,
  status: 'completed' | 'failed'
): Promise<void> {
  const db = await getDatabase();

  if (status === 'completed') {
    await db.execute(
      'UPDATE intro_outros SET file_path = ?, thumbnail_path = ?, duration = ?, thumbnail_generation_status = ?, updated_at = ? WHERE id = ?',
      [filePath, thumbnailPath, duration || null, status, timestamp(), id]
    );
  } else {
    await db.execute(
      'UPDATE intro_outros SET thumbnail_generation_status = ?, updated_at = ? WHERE id = ?',
      [status, timestamp(), id]
    );
  }
}

export async function updateIntroOutroThumbnailStatus(
  id: string,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  thumbnailPath?: string | null
): Promise<void> {
  const db = await getDatabase();
  const now = timestamp();

  if (thumbnailPath) {
    await db.execute(
      'UPDATE intro_outros SET thumbnail_generation_status = ?, thumbnail_path = ?, updated_at = ? WHERE id = ?',
      [status, thumbnailPath, now, id]
    );
  } else {
    await db.execute(
      'UPDATE intro_outros SET thumbnail_generation_status = ?, updated_at = ? WHERE id = ?',
      [status, now, id]
    );
  }
}

export async function getIntroOutroById(id: string): Promise<IntroOutro | null> {
  const db = await getDatabase();
  const results = await db.select<IntroOutro[]>('SELECT * FROM intro_outros WHERE id = ?', [id]);
  return results[0] || null;
}

/**
 * Resolves an intro/outro by ID, handling both local database IDs and org-asset-{serverId} format.
 * Returns the intro/outro data including file_path and duration.
 * For org intro/outros, downloads if not cached locally.
 */
export async function resolveIntroOutroById(
  assetId: string | null | undefined
): Promise<{ filePath: string; duration: number | null } | null> {
  if (!assetId) return null;

  // Check if this is an organization asset (ID format: org-asset-{serverId})
  if (assetId.startsWith('org-asset-')) {
    const serverId = parseInt(assetId.replace('org-asset-', ''), 10);
    if (isNaN(serverId)) return null;

    // First try to load from local cache
    const { getIntroOutroByServerId } = await import('./organization-assets');
    const localAsset = await getIntroOutroByServerId(serverId);
    if (localAsset) {
      return {
        filePath: localAsset.file_path,
        duration: localAsset.duration ?? null,
      };
    }

    // Not cached locally - download from server
    try {
      const { getUserOrganizationAssets } = await import('../organizationAssetsApi');
      const { ensureAssetDownloaded } = await import('../orgAssetSync');
      const serverResponse = await getUserOrganizationAssets();
      if (serverResponse.success && serverResponse.assets) {
        const serverAsset = serverResponse.assets.find(
          (a) => a.id === serverId && (a.asset_type === 'intro' || a.asset_type === 'outro')
        );
        if (serverAsset && serverAsset.url) {
          const downloadResult = await ensureAssetDownloaded(serverAsset);
          if (downloadResult.success && downloadResult.filePath) {
            return {
              filePath: downloadResult.filePath,
              duration: serverAsset.duration ?? null,
            };
          }
        }
      }
    } catch (error) {
      console.error('[resolveIntroOutroById] Failed to download org intro/outro:', error);
    }

    return null;
  }

  // Regular intro/outro lookup by local database ID
  const asset = await getIntroOutroById(assetId);
  if (asset) {
    return {
      filePath: asset.file_path,
      duration: asset.duration ?? null,
    };
  }

  return null;
}

export async function deleteIntroOutro(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM intro_outros WHERE id = ?', [id]);
}
