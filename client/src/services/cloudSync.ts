/**
 * Desktop cloud sync orchestrator — mirrors mobile hybrid sync flow.
 */
import type { CloudProjectSnapshot } from '@clippster/cloud-sync-schema';
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
  return statusMap.get(projectId) ?? 'local-only';
}

export async function registerDevice(): Promise<void> {
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

export async function syncAllProjects(): Promise<void> {
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
