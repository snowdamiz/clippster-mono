/**
 * Desktop cloud sync orchestrator — mirrors mobile hybrid sync flow.
 *
 * Cross-device cloud sync is disabled. Desktop and mobile are independent apps.
 * Flip CLOUD_SYNC_ENABLED when implementing https://github.com/snowdamiz/clippster-mono/issues/667
 */
import type { CloudProjectSnapshot } from '@clippster/cloud-sync-schema';

export const CLOUD_SYNC_ENABLED = false;
import { getAllProjects, deleteProject } from './database/projects';

function normalizeApiOrigin(value: string): string {
  const trimmed = value.endsWith('/') ? value.slice(0, -1) : value;
  return trimmed.toLowerCase().endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
}

const API_BASE = normalizeApiOrigin(
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:4000' : 'https://api.clippster.app'),
);

const DEVICE_ID_KEY = 'clippster_cloud_device_id';
const SYNC_TOKEN_KEY = 'clippster_cloud_sync_token';

type SyncStatus = 'synced' | 'pending' | 'conflict' | 'local-only';

const statusMap = new Map<string, SyncStatus>();

function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Client-Platform': 'desktop',
    ...(options.headers as Record<string, string> | undefined),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}/api${path}`, { ...options, headers });
  const data = (await response.json()) as T;
  return { status: response.status, data };
}

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function getProjectSyncStatus(projectId: string): SyncStatus {
  if (!CLOUD_SYNC_ENABLED) return 'local-only';
  return statusMap.get(projectId) ?? 'local-only';
}

export async function registerDevice(): Promise<void> {
  if (!CLOUD_SYNC_ENABLED) return;
  const deviceId = getDeviceId();
  await apiFetch('/cloud/devices/register', {
    method: 'POST',
    body: JSON.stringify({ device_id: deviceId, platform: 'desktop', device_name: navigator.userAgent }),
  });
}

export async function getStorageQuota() {
  const { data } = await apiFetch<{ success: boolean; bytes_used: number; bytes_limit: number; tier: string }>(
    '/cloud/storage/quota',
  );
  return data;
}

export async function pullProject(projectId: string): Promise<boolean> {
  if (!CLOUD_SYNC_ENABLED) return false;
  const { data } = await apiFetch<{
    success: boolean;
    snapshot: CloudProjectSnapshot | null;
    project: { server_updated_at: number };
  }>(`/cloud/projects/${projectId}`);

  if (!data.success || !data.snapshot) return false;

  const { mergeSnapshotIntoDatabase } = await import('./database/cloudSnapshot');
  await mergeSnapshotIntoDatabase(data.snapshot);
  statusMap.set(projectId, 'synced');
  return true;
}

export async function pushProject(projectId: string, force = false): Promise<boolean> {
  if (!CLOUD_SYNC_ENABLED) return false;
  const { buildProjectSnapshot } = await import('./database/cloudSnapshot');
  const snapshot = await buildProjectSnapshot(projectId);
  if (!snapshot) return false;

  const deviceId = getDeviceId();
  const headers: Record<string, string> = force ? { 'X-Cloud-Sync-Force': 'true' } : {};

  const { status, data } = await apiFetch<{
    success: boolean;
    error?: string;
    snapshot?: CloudProjectSnapshot;
    server_updated_at?: number;
  }>(`/cloud/projects/${projectId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      snapshot,
      device_id: deviceId,
      client_updated_at: snapshot.project.updated_at,
    }),
  });

  if (status === 409 && data.snapshot) {
    statusMap.set(projectId, 'conflict');
    window.dispatchEvent(
      new CustomEvent('cloud-sync-conflict', {
        detail: { projectId, localSnapshot: snapshot, serverSnapshot: data.snapshot },
      }),
    );
    return false;
  }

  if (!data.success) {
    statusMap.set(projectId, 'pending');
    return false;
  }

  statusMap.set(projectId, 'synced');
  return true;
}

/** Queue a project for cloud push (clips, transcript, metadata). Fire-and-forget safe. */
export async function queueProjectSync(projectId: string): Promise<void> {
  if (!CLOUD_SYNC_ENABLED) return;
  try {
    const { updateProject } = await import('./database/projects');
    await updateProject(projectId);
    statusMap.set(projectId, 'pending');
    const uploaded = await uploadRawVodIfPossible(projectId);
    if (uploaded) {
      console.log('[CloudSync] Uploaded raw VOD for', projectId);
    }
    await pushProject(projectId);
  } catch (error) {
    console.warn('[CloudSync] queueProjectSync failed', error);
    statusMap.set(projectId, 'pending');
  }
}

const CLOUD_MEDIA_KEY = 'clippster_cloud_media_assets';

function getStoredCloudMediaId(projectId: string): string | null {
  try {
    const raw = localStorage.getItem(CLOUD_MEDIA_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, string>;
    return map[projectId] ?? null;
  } catch {
    return null;
  }
}

function setStoredCloudMediaId(projectId: string, assetId: string): void {
  try {
    const raw = localStorage.getItem(CLOUD_MEDIA_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[projectId] = assetId;
    localStorage.setItem(CLOUD_MEDIA_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function getCloudMediaAssetId(projectId: string): string | null {
  return getStoredCloudMediaId(projectId);
}

/** Upload raw VOD when the account has cloud storage quota. Returns true if uploaded/already stored. */
async function uploadRawVodIfPossible(projectId: string): Promise<boolean> {
  if (!CLOUD_SYNC_ENABLED) return false;
  if (getStoredCloudMediaId(projectId)) return true;

  const quota = await getStorageQuota();
  if (!quota.success || !quota.bytes_limit || quota.bytes_limit <= 0) {
    return false;
  }

  const { getRawVideosByProjectId } = await import('./database/raw-videos');
  const raws = await getRawVideosByProjectId(projectId);
  const raw = raws[0];
  if (!raw?.file_path) return false;

  const sizeBytes = raw.file_size ?? 0;
  if (sizeBytes > 0 && quota.bytes_used + sizeBytes > quota.bytes_limit) {
    console.warn('[CloudSync] Skipping VOD upload — quota exceeded');
    return false;
  }

  const filename = raw.original_filename ?? 'raw-vod.mp4';
  const { status, data: presign } = await apiFetch<{
    success: boolean;
    asset_id?: string;
    upload_url?: string;
    message?: string;
    error?: string;
  }>(`/cloud/projects/${projectId}/media/presigned-upload`, {
    method: 'POST',
    body: JSON.stringify({
      asset_type: 'raw_vod',
      filename,
      size_bytes: sizeBytes || 1,
      content_type: 'video/mp4',
    }),
  });

  if (status === 402 || !presign.success || !presign.upload_url || !presign.asset_id) {
    console.warn('[CloudSync] VOD presign failed', presign.error ?? presign.message);
    return false;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('upload_file_to_url', {
      filePath: raw.file_path,
      uploadUrl: presign.upload_url,
      contentType: 'video/mp4',
    });
  } catch (error) {
    console.warn('[CloudSync] VOD upload failed', error);
    return false;
  }

  await apiFetch(`/cloud/projects/${projectId}/media/${presign.asset_id}/complete`, {
    method: 'POST',
    body: JSON.stringify({ size_bytes: sizeBytes || 1 }),
  });

  setStoredCloudMediaId(projectId, presign.asset_id);
  return true;
}

export async function syncAllProjects(): Promise<void> {
  if (!CLOUD_SYNC_ENABLED) return;
  await registerDevice();

  const projects = await getAllProjects();
  const deviceId = getDeviceId();

  const { data: bulk } = await apiFetch<{
    success: boolean;
    sync_token: string;
    pull_ids: string[];
    push_ids: string[];
    deleted_ids: string[];
  }>('/cloud/projects/sync', {
    method: 'POST',
    body: JSON.stringify({
      device_id: deviceId,
      platform: 'desktop',
      projects: projects.map((p) => ({ id: p.id, client_updated_at: p.updated_at })),
    }),
  });

  if (!bulk.success) return;

  localStorage.setItem(SYNC_TOKEN_KEY, bulk.sync_token);

  for (const id of bulk.deleted_ids) {
    await deleteProject(id);
    statusMap.delete(id);
  }

  for (const id of bulk.pull_ids) {
    await pullProject(id);
  }

  for (const id of bulk.push_ids) {
    statusMap.set(id, 'pending');
    await pushProject(id);
  }
}

export async function resolveConflict(
  projectId: string,
  choice: 'keep_mine' | 'use_cloud' | 'save_copy',
  payloads: { local: CloudProjectSnapshot; server: CloudProjectSnapshot },
): Promise<void> {
  if (choice === 'keep_mine') {
    await pushProject(projectId, true);
    return;
  }

  if (choice === 'use_cloud') {
    const { mergeSnapshotIntoDatabase } = await import('./database/cloudSnapshot');
    await mergeSnapshotIntoDatabase(payloads.server);
    statusMap.set(projectId, 'synced');
    return;
  }

  const { duplicateProjectFromSnapshot } = await import('./database/cloudSnapshot');
  const newId = await duplicateProjectFromSnapshot(payloads.local);
  await pushProject(newId, true);
  const { mergeSnapshotIntoDatabase } = await import('./database/cloudSnapshot');
  await mergeSnapshotIntoDatabase(payloads.server);
  statusMap.set(projectId, 'synced');
}
