import type { CloudProjectSnapshot } from '@clippster/cloud-sync-schema';
import type { ApiClient } from './createApiClient';

export interface CloudProjectSummary {
  id: string;
  name: string;
  schema_version: number;
  server_updated_at: number;
  client_updated_at: number | null;
  deleted_at: string | null;
  last_writer_device_id: string | null;
}

export interface CloudMediaManifestItem {
  id: string;
  asset_type: string;
  filename: string;
  size_bytes: number;
  checksum: string | null;
  optional: boolean;
}

export interface StorageQuotaResponse {
  success: boolean;
  bytes_used: number;
  bytes_limit: number;
  tier: string;
  error?: string;
}

export interface BulkSyncResponse {
  success: boolean;
  sync_token: string;
  pull_ids: string[];
  push_ids: string[];
  deleted_ids: string[];
}

export interface CloudProjectDetailResponse {
  success: boolean;
  project: CloudProjectSummary;
  snapshot: CloudProjectSnapshot | null;
  media_manifest: CloudMediaManifestItem[];
  error?: string;
}

export interface PushSnapshotResponse {
  success: boolean;
  project?: CloudProjectSummary;
  error?: string;
  server_updated_at?: number;
  last_writer_device_id?: string | null;
  snapshot?: CloudProjectSnapshot;
}

export interface PresignedUploadResponse {
  success: boolean;
  asset_id?: string;
  upload_url?: string;
  media_url?: string;
  error?: string;
  message?: string;
}

export function createCloudProjectsApi(client: ApiClient) {
  return {
    getQuota() {
      return client.get<StorageQuotaResponse>('/cloud/storage/quota');
    },

    listProjects(since?: string) {
      const query = since ? `?since=${encodeURIComponent(since)}` : '';
      return client.get<{ success: boolean; projects: CloudProjectSummary[] }>(
        `/cloud/projects${query}`,
      );
    },

    getProject(id: string) {
      return client.get<CloudProjectDetailResponse>(`/cloud/projects/${id}`);
    },

    createProject(snapshot: CloudProjectSnapshot, deviceId: string, clientUpdatedAt: number) {
      return client.post<{ success: boolean; project: CloudProjectSummary }>('/cloud/projects', {
        snapshot,
        device_id: deviceId,
        client_updated_at: clientUpdatedAt,
      });
    },

    async pushSnapshot(
      id: string,
      snapshot: CloudProjectSnapshot,
      deviceId: string,
      clientUpdatedAt: number,
      force = false,
    ) {
      return client.requestWithStatus<PushSnapshotResponse>(`/cloud/projects/${id}`, {
        method: 'PUT',
        body: { snapshot, device_id: deviceId, client_updated_at: clientUpdatedAt },
        headers: force ? { 'X-Cloud-Sync-Force': 'true' } : undefined,
      });
    },

    deleteProject(id: string) {
      return client.delete<{ success: boolean }>(`/cloud/projects/${id}`);
    },

    registerDevice(deviceId: string, platform: string, deviceName?: string) {
      return client.post<{ success: boolean }>('/cloud/devices/register', {
        device_id: deviceId,
        platform,
        device_name: deviceName,
      });
    },

    bulkSync(
      deviceId: string,
      projects: Array<{ id: string; client_updated_at: number }>,
      platform: string,
      deviceName?: string,
    ) {
      return client.post<BulkSyncResponse>('/cloud/projects/sync', {
        device_id: deviceId,
        projects,
        platform,
        device_name: deviceName,
      });
    },

    presignedUpload(
      projectId: string,
      body: {
        asset_type: 'raw_vod' | 'built_clip' | 'thumbnail';
        filename: string;
        size_bytes: number;
        content_type?: string;
      },
    ) {
      return client.post<PresignedUploadResponse>(
        `/cloud/projects/${projectId}/media/presigned-upload`,
        body,
      );
    },

    completeUpload(projectId: string, assetId: string, sizeBytes: number, checksum?: string) {
      return client.post<{ success: boolean }>(
        `/cloud/projects/${projectId}/media/${assetId}/complete`,
        { size_bytes: sizeBytes, checksum },
      );
    },

    presignedDownload(projectId: string, assetId: string) {
      return client.get<{ success: boolean; download_url: string }>(
        `/cloud/projects/${projectId}/media/${assetId}/presigned-download`,
      );
    },

    deleteMedia(projectId: string, assetId: string) {
      return client.delete<{ success: boolean }>(
        `/cloud/projects/${projectId}/media/${assetId}`,
      );
    },

    checkoutStorageTier(tier: 'cloud_50' | 'cloud_200') {
      return client.post<{
        success: boolean;
        tier: string;
        bytes_limit?: number;
        checkout_url?: string;
        message?: string;
        error?: string;
      }>('/cloud/subscription/checkout', { tier });
    },
  };
}

export type CloudProjectsApi = ReturnType<typeof createCloudProjectsApi>;
