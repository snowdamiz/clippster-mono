import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import type { MediaPlatform } from '@clippster/shared-types';
import { mediaApi } from '@/services/api';
import {
  createProject,
  createRawVideo,
  generateId,
  timestamp,
  updateProjectThumbnail,
} from '@/services/database';
import { extractThumbnail, probeDuration, remuxToMp4 } from '@/services/ffmpeg';

export type DownloadStatus =
  | 'queued'
  | 'resolving'
  | 'downloading'
  | 'remuxing'
  | 'complete'
  | 'error'
  | 'cancelled';

export interface DownloadJob {
  id: string;
  title: string;
  sourceUrl: string;
  platform: MediaPlatform | 'manual';
  status: DownloadStatus;
  progress: number;
  message: string;
  projectId?: string;
  error?: string;
  createdAt: number;
}

type Listener = (jobs: DownloadJob[]) => void;

const STORAGE_KEY = 'clippster_mobile_download_queue';
const VIDEO_DIR = `${FileSystem.documentDirectory}videos/`;
const THUMB_DIR = `${FileSystem.documentDirectory}thumbnails/`;

let jobs: DownloadJob[] = [];
let activeJobId: string | null = null;
const listeners = new Set<Listener>();
let initialized = false;

function emit() {
  const snapshot = [...jobs];
  listeners.forEach((listener) => listener(snapshot));
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

function sanitizeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 80);
}

async function ensureDirs(): Promise<void> {
  await FileSystem.makeDirectoryAsync(VIDEO_DIR, { intermediates: true });
  await FileSystem.makeDirectoryAsync(THUMB_DIR, { intermediates: true });
}

function updateJob(jobId: string, patch: Partial<DownloadJob>) {
  jobs = jobs.map((job) => (job.id === jobId ? { ...job, ...patch } : job));
  emit();
}

export async function initDownloadQueue(): Promise<void> {
  if (initialized) return;
  initialized = true;
  await ensureDirs();

  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      jobs = JSON.parse(stored) as DownloadJob[];
      jobs = jobs.map((job) =>
        job.status === 'downloading' || job.status === 'resolving' || job.status === 'remuxing'
          ? { ...job, status: 'error', error: 'Interrupted — tap to retry', progress: 0 }
          : job,
      );
      emit();
    } catch {
      jobs = [];
    }
  }
}

export function subscribeDownloadQueue(listener: Listener): () => void {
  listeners.add(listener);
  listener([...jobs]);
  return () => listeners.delete(listener);
}

export function getDownloadJobs(): DownloadJob[] {
  return [...jobs];
}

export async function enqueueDownload(input: {
  sourceUrl: string;
  platform: MediaPlatform;
  title?: string;
}): Promise<string> {
  await initDownloadQueue();
  const id = generateId();
  const job: DownloadJob = {
    id,
    title: input.title ?? 'Downloading…',
    sourceUrl: input.sourceUrl,
    platform: input.platform,
    status: 'queued',
    progress: 0,
    message: 'Queued',
    createdAt: timestamp(),
  };
  jobs = [job, ...jobs];
  emit();
  void processQueue();
  return id;
}

export async function cancelDownload(jobId: string): Promise<void> {
  updateJob(jobId, { status: 'cancelled', message: 'Cancelled' });
  if (activeJobId === jobId) {
    activeJobId = null;
  }
}

export async function retryDownload(jobId: string): Promise<void> {
  updateJob(jobId, {
    status: 'queued',
    progress: 0,
    message: 'Queued',
    error: undefined,
  });
  void processQueue();
}

async function processQueue(): Promise<void> {
  if (activeJobId) return;
  const next = jobs.find((job) => job.status === 'queued');
  if (!next) return;

  activeJobId = next.id;
  try {
    await runDownload(next);
  } catch (error) {
    updateJob(next.id, {
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      message: 'Download failed',
    });
  } finally {
    activeJobId = null;
    void processQueue();
  }
}

async function runDownload(job: DownloadJob): Promise<void> {
  updateJob(job.id, { status: 'resolving', progress: 2, message: 'Resolving stream…' });

  let streamUrl: string;
  let title = job.title;
  let durationSeconds: number | null = null;
  let authHeaders: Record<string, string> | undefined;

  if (job.platform === 'tokend') {
    const { parseTokendMediaRef, TOKEND_UNAVAILABLE_MESSAGES, fetchTokendMode, getTokendCapabilities } =
      await import('./tokend');
    const modeInfo = await fetchTokendMode();
    const capabilities = getTokendCapabilities(modeInfo);
    if (!capabilities.download && !capabilities.mockConnect) {
      throw new Error(TOKEND_UNAVAILABLE_MESSAGES.download);
    }

    const ref = parseTokendMediaRef(job.sourceUrl);
    if (!ref) throw new Error('Invalid Tokend media reference');

    const { tokendApi } = await import('./api');
    const { getStoredToken } = await import('./authStorage');
    const { getApiBaseUrl } = await import('@/lib/config');

    const grant = await tokendApi.createMediaGrant(ref.type, ref.id, 'download');
    if (!grant.success || !grant.download_url) {
      throw new Error(grant.error ?? 'Failed to create Tokend download grant');
    }

    const base = getApiBaseUrl().replace(/\/$/, '');
    streamUrl = grant.download_url.startsWith('http')
      ? grant.download_url
      : `${base}${grant.download_url.startsWith('/') ? '' : '/'}${grant.download_url}`;
    const token = await getStoredToken();
    authHeaders = token ? { Authorization: `Bearer ${token}` } : undefined;
    title = job.title !== 'Downloading…' ? job.title : `Tokend ${ref.id}`;
  } else {
    const resolved = await mediaApi.resolveUrl(job.sourceUrl, { platform: job.platform });
    if (!resolved.success || !resolved.streams?.length) {
      throw new Error(resolved.error ?? 'Could not resolve download URL');
    }

    const url = resolved.streams[0]?.url;
    if (!url) {
      throw new Error('No stream URL returned');
    }
    streamUrl = url;
    title = resolved.title ?? job.title;
    durationSeconds = resolved.duration_seconds ?? null;
  }

  updateJob(job.id, { title, status: 'downloading', progress: 5, message: 'Downloading…' });

  const downloadId = generateId();
  const rawPath = `${VIDEO_DIR}${downloadId}_raw`;
  const outputPath = `${VIDEO_DIR}${sanitizeFilename(job.platform)}_${sanitizeFilename(title)}_${timestamp()}.mp4`;
  const thumbPath = `${THUMB_DIR}${downloadId}.jpg`;

  const download = FileSystem.createDownloadResumable(
    streamUrl,
    rawPath,
    authHeaders ? { headers: authHeaders } : {},
    (progressEvent) => {
      if (!progressEvent.totalBytesExpectedToWrite) return;
      const ratio = progressEvent.totalBytesWritten / progressEvent.totalBytesExpectedToWrite;
      updateJob(job.id, {
        progress: 5 + ratio * 70,
        message: `Downloading… ${Math.round(ratio * 100)}%`,
      });
    },
  );

  const result = await download.downloadAsync();
  if (!result?.uri) {
    throw new Error('Download failed');
  }

  updateJob(job.id, { status: 'remuxing', progress: 80, message: 'Remuxing to MP4…' });
  await remuxToMp4(result.uri, outputPath, (ratio) => {
    updateJob(job.id, {
      progress: 80 + ratio * 15,
      message: `Remuxing… ${Math.round(ratio * 100)}%`,
    });
  });

  try {
    await FileSystem.deleteAsync(result.uri, { idempotent: true });
  } catch {
    // ignore cleanup errors
  }

  let duration = durationSeconds;
  if (duration == null) {
    duration = await probeDuration(outputPath);
  }

  try {
    await extractThumbnail(outputPath, thumbPath);
  } catch {
    // thumbnail optional
  }

  const fileInfo = await FileSystem.getInfoAsync(outputPath);
  const thumbExists = (await FileSystem.getInfoAsync(thumbPath)).exists;
  const project = await createProject(title);
  await createRawVideo({
    projectId: project.id,
    filePath: outputPath,
    originalFilename: outputPath.split('/').pop() ?? null,
    thumbnailPath: thumbExists ? thumbPath : null,
    duration,
    fileSize: fileInfo.exists && 'size' in fileInfo ? fileInfo.size : null,
    platform: job.platform,
    sourceUrl: job.sourceUrl,
  });

  if (thumbExists) {
    await updateProjectThumbnail(project.id, thumbPath);
  }

  const { queueProjectSync } = await import('./cloudSync');
  void queueProjectSync(project.id);

  updateJob(job.id, {
    status: 'complete',
    progress: 100,
    message: 'Complete',
    projectId: project.id,
  });
}

export async function importLocalVideo(input: {
  sourceUri: string;
  filename: string;
  title?: string;
}): Promise<string> {
  await initDownloadQueue();
  await ensureDirs();

  const id = generateId();
  const outputPath = `${VIDEO_DIR}manual_${sanitizeFilename(input.filename)}_${timestamp()}.mp4`;
  await FileSystem.copyAsync({ from: input.sourceUri, to: outputPath });

  const duration = await probeDuration(outputPath);
  const thumbPath = `${THUMB_DIR}${id}.jpg`;
  try {
    await extractThumbnail(outputPath, thumbPath);
  } catch {
    // optional
  }

  const fileInfo = await FileSystem.getInfoAsync(outputPath);
  const project = await createProject(input.title ?? input.filename);
  await createRawVideo({
    projectId: project.id,
    filePath: outputPath,
    originalFilename: input.filename,
    thumbnailPath: (await FileSystem.getInfoAsync(thumbPath)).exists ? thumbPath : null,
    duration,
    fileSize: fileInfo.exists && 'size' in fileInfo ? fileInfo.size : null,
    platform: 'manual',
    sourceUrl: null,
  });

  if ((await FileSystem.getInfoAsync(thumbPath)).exists) {
    await updateProjectThumbnail(project.id, thumbPath);
  }

  const { queueProjectSync } = await import('./cloudSync');
  void queueProjectSync(project.id);

  return project.id;
}
