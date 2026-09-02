import * as FileSystem from 'expo-file-system/legacy';
import type { CloudProjectSnapshot } from '@clippster/cloud-sync-schema';
import { buildProjectSnapshot } from './database/snapshot';
import { getRawVideoByProjectId } from './database';
import { upsertCloudSyncMeta, getCloudSyncMeta } from './database/cloud-sync-meta';
import { CLOUD_SYNC_ENABLED, cloudApi, pushProject } from './cloudSync';

export interface VodUploadProgress {
  projectId: string;
  bytesSent: number;
  totalBytes: number;
  status: 'idle' | 'uploading' | 'completed' | 'failed';
  error?: string;
}

const uploadState = new Map<string, VodUploadProgress>();
const listeners = new Set<(state: VodUploadProgress | null) => void>();

function notify(projectId: string) {
  const state = uploadState.get(projectId) ?? null;
  for (const listener of listeners) {
    listener(state);
  }
}

export function subscribeVodUpload(listener: (state: VodUploadProgress | null) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getVodUploadProgress(projectId: string): VodUploadProgress | undefined {
  return uploadState.get(projectId);
}

export async function setStoreVodInCloud(projectId: string, enabled: boolean): Promise<void> {
  if (!CLOUD_SYNC_ENABLED) return;
  if (enabled) {
    await upsertCloudSyncMeta(projectId, { store_vod_in_cloud: 1 });
    void uploadRawVod(projectId);
    return;
  }

  const meta = await getCloudSyncMeta(projectId);
  if (meta?.cloud_media_asset_id) {
    await cloudApi.deleteMedia(projectId, meta.cloud_media_asset_id);
  }

  await upsertCloudSyncMeta(projectId, {
    store_vod_in_cloud: 0,
    cloud_media_asset_id: null,
  });

  const snapshot = await buildProjectSnapshot(projectId);
  if (snapshot) {
    snapshot.raw_videos = snapshot.raw_videos.map((rv) => ({
      ...rv,
      cloud_media_asset_id: null,
    }));
    await pushProjectWithSnapshot(projectId, snapshot);
  }
}

async function pushProjectWithSnapshot(projectId: string, snapshot: CloudProjectSnapshot) {
  const { getDeviceId } = await import('./cloudSync');
  const deviceId = await getDeviceId();
  await cloudApi.pushSnapshot(projectId, snapshot, deviceId, snapshot.project.updated_at);
}

export async function uploadRawVod(projectId: string): Promise<void> {
  if (!CLOUD_SYNC_ENABLED) return;
  const raw = await getRawVideoByProjectId(projectId);
  if (!raw?.file_path || raw.file_path.startsWith('pending://')) return;

  const info = await FileSystem.getInfoAsync(raw.file_path);
  if (!info.exists || !('size' in info) || !info.size) return;

  const filename = raw.original_filename ?? 'raw-vod.mp4';
  const totalBytes = info.size;

  uploadState.set(projectId, {
    projectId,
    bytesSent: 0,
    totalBytes,
    status: 'uploading',
  });
  notify(projectId);

  const presign = await cloudApi.presignedUpload(projectId, {
    asset_type: 'raw_vod',
    filename,
    size_bytes: totalBytes,
    content_type: 'video/mp4',
  });

  if (!presign.success || !presign.upload_url || !presign.asset_id) {
    uploadState.set(projectId, {
      projectId,
      bytesSent: 0,
      totalBytes,
      status: 'failed',
      error: presign.message ?? presign.error ?? 'Presign failed',
    });
    notify(projectId);
    return;
  }

  const uploadResult = await FileSystem.uploadAsync(presign.upload_url, raw.file_path, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { 'Content-Type': 'video/mp4' },
  });

  if (uploadResult.status < 200 || uploadResult.status >= 300) {
    uploadState.set(projectId, {
      projectId,
      bytesSent: 0,
      totalBytes,
      status: 'failed',
      error: `Upload failed (${uploadResult.status})`,
    });
    notify(projectId);
    return;
  }

  await cloudApi.completeUpload(projectId, presign.asset_id, totalBytes);
  await upsertCloudSyncMeta(projectId, {
    cloud_media_asset_id: presign.asset_id,
    store_vod_in_cloud: 1,
  });

  const snapshot = await buildProjectSnapshot(projectId);
  if (snapshot) {
    snapshot.raw_videos = snapshot.raw_videos.map((rv) => ({
      ...rv,
      cloud_media_asset_id: presign.asset_id!,
    }));
    await pushProjectWithSnapshot(projectId, snapshot);
  }

  uploadState.set(projectId, {
    projectId,
    bytesSent: totalBytes,
    totalBytes,
    status: 'completed',
  });
  notify(projectId);
}

export async function downloadCloudVod(
  projectId: string,
  assetId: string,
  destPath: string,
): Promise<string> {
  const response = await cloudApi.presignedDownload(projectId, assetId);
  if (!response.success || !response.download_url) {
    throw new Error('Failed to get download URL');
  }

  const result = await FileSystem.downloadAsync(response.download_url, destPath);
  return result.uri;
}
