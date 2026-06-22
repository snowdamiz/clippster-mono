import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import type { CloudProjectSnapshot } from '@clippster/cloud-sync-schema';
import { Platform } from 'react-native';
import { createCloudProjectsApi } from '@clippster/api-client';
import { apiClient } from './api';
import { getAllProjects, deleteProject } from './database';
import {
  getAllCloudSyncMeta,
  markProjectConflict,
  markProjectPending,
  markProjectSynced,
  type CloudSyncMeta,
} from './database/cloud-sync-meta';
import {
  buildProjectSnapshot,
  duplicateProjectFromSnapshot,
  mergeSnapshotIntoDatabase,
} from './database/snapshot';

const DEVICE_ID_KEY = 'cloud_sync_device_id';
const SYNC_TOKEN_KEY = 'cloud_sync_token';
const PENDING_PUSH_KEY = 'cloud_sync_pending_push';
const WIFI_ONLY_KEY = 'cloud_sync_wifi_only';

const cloudApi = createCloudProjectsApi(apiClient);

type ConflictHandler = (payload: {
  projectId: string;
  localSnapshot: CloudProjectSnapshot;
  serverSnapshot: CloudProjectSnapshot;
}) => Promise<'keep_mine' | 'use_cloud' | 'save_copy'>;

let conflictHandler: ConflictHandler | null = null;
let syncInProgress = false;

export function setCloudSyncConflictHandler(handler: ConflictHandler | null) {
  conflictHandler = handler;
}

export async function getDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;
  const id = Crypto.randomUUID();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  return id;
}

export async function isWifiOnlySync(): Promise<boolean> {
  const value = await AsyncStorage.getItem(WIFI_ONLY_KEY);
  return value !== 'false';
}

export async function setWifiOnlySync(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(WIFI_ONLY_KEY, enabled ? 'true' : 'false');
}

async function getPendingPushIds(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(PENDING_PUSH_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

async function addPendingPush(projectId: string): Promise<void> {
  const ids = new Set(await getPendingPushIds());
  ids.add(projectId);
  await AsyncStorage.setItem(PENDING_PUSH_KEY, JSON.stringify([...ids]));
}

async function clearPendingPush(projectId: string): Promise<void> {
  const ids = (await getPendingPushIds()).filter((id) => id !== projectId);
  await AsyncStorage.setItem(PENDING_PUSH_KEY, JSON.stringify(ids));
}

export async function getProjectSyncStatuses(): Promise<Record<string, CloudSyncMeta['sync_status']>> {
  const rows = await getAllCloudSyncMeta();
  const map: Record<string, CloudSyncMeta['sync_status']> = {};
  for (const row of rows) {
    map[row.project_id] = row.sync_status;
  }
  return map;
}

export async function registerDevice(): Promise<void> {
  const deviceId = await getDeviceId();
  await cloudApi.registerDevice(deviceId, Platform.OS, `${Platform.OS} device`);
}

export async function pushProject(projectId: string, force = false): Promise<boolean> {
  const snapshot = await buildProjectSnapshot(projectId);
  if (!snapshot) return false;

  const deviceId = await getDeviceId();
  const clientUpdatedAt = snapshot.project.updated_at;

  const { status, data } = await cloudApi.pushSnapshot(
    projectId,
    snapshot,
    deviceId,
    clientUpdatedAt,
    force,
  );

  if (status === 409 && data.snapshot && conflictHandler) {
    await markProjectConflict(projectId);
    const choice = await conflictHandler({
      projectId,
      localSnapshot: snapshot,
      serverSnapshot: data.snapshot as CloudProjectSnapshot,
    });

    if (choice === 'keep_mine') {
      return pushProject(projectId, true);
    }
    if (choice === 'use_cloud') {
      await mergeSnapshotIntoDatabase(data.snapshot as CloudProjectSnapshot);
      await markProjectSynced(projectId, data.server_updated_at ?? clientUpdatedAt);
      return true;
    }
    if (choice === 'save_copy') {
      const newId = await duplicateProjectFromSnapshot(snapshot);
      await pushProject(newId, true);
      await mergeSnapshotIntoDatabase(data.snapshot as CloudProjectSnapshot);
      await markProjectSynced(projectId, data.server_updated_at ?? clientUpdatedAt);
      return true;
    }
    return false;
  }

  if (!data.success) {
    await addPendingPush(projectId);
    await markProjectPending(projectId);
    return false;
  }

  await clearPendingPush(projectId);
  await markProjectSynced(projectId, data.project?.server_updated_at ?? clientUpdatedAt);
  return true;
}

export async function pullProject(projectId: string): Promise<boolean> {
  const response = await cloudApi.getProject(projectId);
  if (!response.success || !response.snapshot) return false;
  await mergeSnapshotIntoDatabase(response.snapshot);
  await markProjectSynced(projectId, response.project.server_updated_at);
  return true;
}

export async function syncAllProjects(): Promise<void> {
  if (syncInProgress) return;
  syncInProgress = true;

  try {
    await registerDevice();

    const projects = await getAllProjects();
    const deviceId = await getDeviceId();
    const localProjects = projects.map((p) => ({
      id: p.id,
      client_updated_at: p.updated_at,
    }));

    const bulk = await cloudApi.bulkSync(deviceId, localProjects, Platform.OS);
    if (!bulk.success) return;

    await AsyncStorage.setItem(SYNC_TOKEN_KEY, bulk.sync_token);

    for (const deletedId of bulk.deleted_ids) {
      await deleteProject(deletedId);
    }

    for (const pullId of bulk.pull_ids) {
      await pullProject(pullId);
    }

    const pending = await getPendingPushIds();
    const pushIds = [...new Set([...bulk.push_ids, ...pending])];

    for (const pushId of pushIds) {
      await markProjectPending(pushId);
      await pushProject(pushId);
    }
  } finally {
    syncInProgress = false;
  }
}

export async function queueProjectSync(projectId: string): Promise<void> {
  await addPendingPush(projectId);
  await markProjectPending(projectId);
  void syncAllProjects();
}

export async function getStorageQuota() {
  return cloudApi.getQuota();
}

export { cloudApi };
