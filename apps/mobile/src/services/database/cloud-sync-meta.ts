import type { CloudSyncStatus } from '@clippster/cloud-sync-schema';
import { getDatabase, timestamp } from './index';

export interface CloudSyncMeta {
  project_id: string;
  sync_status: CloudSyncStatus;
  cloud_media_asset_id: string | null;
  store_vod_in_cloud: number;
  last_synced_at: number | null;
  cloud_updated_at: number | null;
}

export async function getCloudSyncMeta(projectId: string): Promise<CloudSyncMeta | null> {
  const db = getDatabase();
  return db.getFirstAsync<CloudSyncMeta>('SELECT * FROM cloud_sync_meta WHERE project_id = ?', [
    projectId,
  ]);
}

export async function getAllCloudSyncMeta(): Promise<CloudSyncMeta[]> {
  const db = getDatabase();
  return db.getAllAsync<CloudSyncMeta>('SELECT * FROM cloud_sync_meta');
}

export async function upsertCloudSyncMeta(
  projectId: string,
  patch: Partial<Omit<CloudSyncMeta, 'project_id'>>,
): Promise<void> {
  const db = getDatabase();
  const existing = await getCloudSyncMeta(projectId);
  const now = timestamp();

  if (!existing) {
    await db.runAsync(
      `INSERT INTO cloud_sync_meta (
        project_id, sync_status, cloud_media_asset_id, store_vod_in_cloud,
        last_synced_at, cloud_updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        projectId,
        patch.sync_status ?? 'local-only',
        patch.cloud_media_asset_id ?? null,
        patch.store_vod_in_cloud ?? 0,
        patch.last_synced_at ?? null,
        patch.cloud_updated_at ?? null,
      ],
    );
    return;
  }

  await db.runAsync(
    `UPDATE cloud_sync_meta SET
      sync_status = ?,
      cloud_media_asset_id = ?,
      store_vod_in_cloud = ?,
      last_synced_at = ?,
      cloud_updated_at = ?
     WHERE project_id = ?`,
    [
      patch.sync_status ?? existing.sync_status,
      patch.cloud_media_asset_id ?? existing.cloud_media_asset_id,
      patch.store_vod_in_cloud ?? existing.store_vod_in_cloud,
      patch.last_synced_at ?? existing.last_synced_at,
      patch.cloud_updated_at ?? existing.cloud_updated_at ?? now,
      projectId,
    ],
  );
}

export async function deleteCloudSyncMeta(projectId: string): Promise<void> {
  const db = getDatabase();
  await db.runAsync('DELETE FROM cloud_sync_meta WHERE project_id = ?', [projectId]);
}

export async function markProjectPending(projectId: string): Promise<void> {
  await upsertCloudSyncMeta(projectId, { sync_status: 'pending' });
}

export async function markProjectSynced(projectId: string, cloudUpdatedAt: number): Promise<void> {
  await upsertCloudSyncMeta(projectId, {
    sync_status: 'synced',
    last_synced_at: timestamp(),
    cloud_updated_at: cloudUpdatedAt,
  });
}

export async function markProjectConflict(projectId: string): Promise<void> {
  await upsertCloudSyncMeta(projectId, { sync_status: 'conflict' });
}
