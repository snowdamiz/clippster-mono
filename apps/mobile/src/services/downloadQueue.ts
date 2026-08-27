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
  updateRawVideoFilePath,
} from '@/services/database';
import {
  extractThumbnail,
  isFfmpegAvailable,
  probeDuration,
  remuxToMp4,
  type SegmentRange,
} from '@/services/ffmpeg';
import { downloadHlsToTs } from '@/services/hlsDownload';
import { buildSegmentJobs } from '@/lib/timeRange';
import { getHlsRequestHeaders, shouldUseFfmpegDownload } from '@/lib/streamDownload';

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
  streamUrl?: string;
  channelSlug?: string;
  thumbnailUrl?: string;
  platform: MediaPlatform | 'manual';
  segmentRange?: SegmentRange;
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

async function saveProjectThumbnail(
  thumbPath: string,
  options: { remoteUrl?: string; videoPath?: string; pageUrl?: string },
): Promise<string | null> {
  if (options.remoteUrl) {
    try {
      const result = await FileSystem.downloadAsync(options.remoteUrl, thumbPath, {
        headers: getHlsRequestHeaders(options.remoteUrl, options.pageUrl),
      });
      if (result.status === 200 && (await FileSystem.getInfoAsync(thumbPath)).exists) {
        return thumbPath;
      }
    } catch {
      // Kick CDN often blocks anonymous file downloads; the remote URL still loads in Image.
    }
    return options.remoteUrl;
  }

  if (options.videoPath && (await isFfmpegAvailable())) {
    try {
      await extractThumbnail(options.videoPath, thumbPath);
      if ((await FileSystem.getInfoAsync(thumbPath)).exists) {
        return thumbPath;
      }
    } catch {
      return null;
    }
  }

  return null;
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
  streamUrl?: string;
  channelSlug?: string;
  thumbnailUrl?: string;
  platform: MediaPlatform;
  title?: string;
  segmentRange?: SegmentRange;
}): Promise<string> {
  await initDownloadQueue();
  const id = generateId();
  const job: DownloadJob = {
    id,
    title: input.title ?? 'Downloading…',
    sourceUrl: input.sourceUrl,
    streamUrl: input.streamUrl,
    channelSlug: input.channelSlug,
    thumbnailUrl: input.thumbnailUrl,
    platform: input.platform,
    segmentRange: input.segmentRange,
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

export async function enqueueDownloadPlan(input: {
  sourceUrl: string;
  streamUrl?: string;
  channelSlug?: string;
  thumbnailUrl?: string;
  platform: MediaPlatform;
  title?: string;
  totalDurationSeconds?: number;
  segmentRange?: SegmentRange;
  autoSegment?: boolean;
  autoSegmentDurationMinutes?: number;
}): Promise<string[]> {
  const total = Math.max(0, Math.floor(input.totalDurationSeconds ?? 0));
  const range: SegmentRange = input.segmentRange ?? { startTime: 0, endTime: total };
  const selectedDuration = Math.max(0, range.endTime - range.startTime);
  const partMinutes = input.autoSegmentDurationMinutes ?? 30;
  const shouldAutoSegment = input.autoSegment && selectedDuration > 900;

  if (shouldAutoSegment) {
    const segments = buildSegmentJobs(range, partMinutes * 60);
    const ids: string[] = [];
    for (let i = 0; i < segments.length; i++) {
      const partTitle =
        segments.length > 1
          ? `${input.title ?? 'Download'} Part ${i + 1}`
          : input.title ?? 'Downloading…';
      const id = await enqueueDownload({
        sourceUrl: input.sourceUrl,
        streamUrl: input.streamUrl,
        channelSlug: input.channelSlug,
        thumbnailUrl: input.thumbnailUrl,
        platform: input.platform,
        title: partTitle,
        segmentRange: segments[i],
      });
      ids.push(id);
    }
    return ids;
  }

  const id = await enqueueDownload({
    sourceUrl: input.sourceUrl,
    streamUrl: input.streamUrl,
    channelSlug: input.channelSlug,
    thumbnailUrl: input.thumbnailUrl,
    platform: input.platform,
    title: input.title,
    segmentRange: input.segmentRange,
  });
  return [id];
}

export async function cancelDownload(jobId: string): Promise<void> {
  updateJob(jobId, { status: 'cancelled', message: 'Cancelled' });
  if (activeJobId === jobId) {
    activeJobId = null;
  }
  void processQueue();
}

export async function removeDownload(jobId: string): Promise<void> {
  if (activeJobId === jobId) {
    activeJobId = null;
  }
  jobs = jobs.filter((job) => job.id !== jobId);
  emit();
  void processQueue();
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
  let useFfmpegDownload = false;

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
    const preResolved = job.streamUrl?.trim();
    const resolveTarget = preResolved || job.sourceUrl;

    // Kick/Twitch HLS: download segments in JS with browser headers.
    // ffmpeg-expo is a remux stub and ignores -headers, so native HLS open always fails.
    if (shouldUseFfmpegDownload(resolveTarget)) {
      streamUrl = resolveTarget;
      useFfmpegDownload = true;
    } else {
      const resolved = await mediaApi.resolveUrl(resolveTarget, { platform: job.platform });
      if (!resolved.success || !resolved.streams?.length) {
        throw new Error(resolved.error ?? 'Could not resolve download URL');
      }

      const url = resolved.streams[0]?.url;
      if (!url) {
        throw new Error('No stream URL returned');
      }
      streamUrl = url;
      if (job.title === 'Downloading…' || !job.title) {
        title = resolved.title ?? job.title;
      }
      durationSeconds = resolved.duration_seconds ?? null;
      useFfmpegDownload = shouldUseFfmpegDownload(streamUrl);
    }
  }

  updateJob(job.id, { title, status: 'downloading', progress: 5, message: 'Downloading…' });

  const downloadId = generateId();
  const channelPart = job.channelSlug ? sanitizeFilename(job.channelSlug).slice(0, 8) : '';
  const segmentSuffix =
    job.segmentRange
      ? `_s${Math.floor(job.segmentRange.startTime)}_${Math.floor(job.segmentRange.endTime)}`
      : '';
  let outputPath = `${VIDEO_DIR}${sanitizeFilename(job.platform)}${channelPart ? `_${channelPart}` : ''}_${sanitizeFilename(title)}${segmentSuffix}_${timestamp()}.mp4`;
  const thumbPath = `${THUMB_DIR}${downloadId}.jpg`;
  const segment = job.segmentRange;

  if (useFfmpegDownload) {
    const rawTsPath = `${VIDEO_DIR}${downloadId}.ts`;
    await downloadHlsToTs(streamUrl, rawTsPath, {
      pageUrl: job.sourceUrl,
      segment,
      onProgress: (ratio) => {
        updateJob(job.id, {
          progress: 5 + ratio * 70,
          message: `Downloading… ${Math.round(ratio * 100)}%`,
        });
      },
    });

    if (await isFfmpegAvailable()) {
      updateJob(job.id, { status: 'remuxing', progress: 78, message: 'Remuxing to MP4…' });
      try {
        await remuxToMp4(rawTsPath, outputPath, (ratio) => {
          updateJob(job.id, {
            progress: 78 + ratio * 17,
            message: `Remuxing… ${Math.round(ratio * 100)}%`,
          });
        });
        await FileSystem.deleteAsync(rawTsPath, { idempotent: true });
      } catch {
        outputPath = rawTsPath;
      }
    } else {
      outputPath = rawTsPath;
    }
  } else {
    const rawPath = `${VIDEO_DIR}${downloadId}_raw`;

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

    if (segment) {
      if (!(await isFfmpegAvailable())) {
        throw new Error(
          'FFmpeg is required to trim this download segment. Rebuild the dev client: npx expo run:android.',
        );
      }
      updateJob(job.id, { status: 'remuxing', progress: 80, message: 'Trimming segment…' });
      await remuxToMp4(
        result.uri,
        outputPath,
        (ratio) => {
          updateJob(job.id, {
            progress: 80 + ratio * 15,
            message: `Trimming… ${Math.round(ratio * 100)}%`,
          });
        },
        segment,
      );
    } else {
      updateJob(job.id, { status: 'remuxing', progress: 80, message: 'Remuxing to MP4…' });
      await remuxToMp4(result.uri, outputPath, (ratio) => {
        updateJob(job.id, {
          progress: 80 + ratio * 15,
          message: `Remuxing… ${Math.round(ratio * 100)}%`,
        });
      });
    }

    try {
      await FileSystem.deleteAsync(result.uri, { idempotent: true });
    } catch {
      // ignore cleanup errors
    }
  }

  let duration = durationSeconds;
  if (job.segmentRange) {
    duration = job.segmentRange.endTime - job.segmentRange.startTime;
  }
  if (duration == null) {
    duration = await probeDuration(outputPath);
  }

  const savedThumb = await saveProjectThumbnail(thumbPath, {
    remoteUrl: job.thumbnailUrl,
    videoPath: outputPath,
    pageUrl: job.sourceUrl,
  });

  const fileInfo = await FileSystem.getInfoAsync(outputPath);
  const project = await createProject(title);
  await createRawVideo({
    projectId: project.id,
    filePath: outputPath,
    originalFilename: outputPath.split('/').pop() ?? null,
    thumbnailPath: savedThumb,
    duration,
    fileSize: fileInfo.exists && 'size' in fileInfo ? fileInfo.size : null,
    platform: job.platform,
    sourceUrl: job.sourceUrl,
  });

  if (savedThumb) {
    await updateProjectThumbnail(project.id, savedThumb);
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
  const savedThumb = await saveProjectThumbnail(thumbPath, { videoPath: outputPath });

  const fileInfo = await FileSystem.getInfoAsync(outputPath);
  const project = await createProject(input.title ?? input.filename);
  await createRawVideo({
    projectId: project.id,
    filePath: outputPath,
    originalFilename: input.filename,
    thumbnailPath: savedThumb,
    duration,
    fileSize: fileInfo.exists && 'size' in fileInfo ? fileInfo.size : null,
    platform: 'manual',
    sourceUrl: null,
  });

  if (savedThumb) {
    await updateProjectThumbnail(project.id, savedThumb);
  }

  const { queueProjectSync } = await import('./cloudSync');
  void queueProjectSync(project.id);

  return project.id;
}

export async function backfillProjectThumbnail(
  projectId: string,
  videoPath: string,
  remoteUrl?: string,
): Promise<string | null> {
  await ensureDirs();
  const thumbPath = `${THUMB_DIR}project_${projectId}.jpg`;
  const existing = await FileSystem.getInfoAsync(thumbPath);
  if (existing.exists) {
    await updateProjectThumbnail(projectId, thumbPath);
    await updateRawVideoFilePath(projectId, videoPath, { thumbnailPath: thumbPath });
    return thumbPath;
  }

  const saved = await saveProjectThumbnail(thumbPath, { videoPath, remoteUrl });
  if (!saved) return null;

  await updateProjectThumbnail(projectId, saved);
  await updateRawVideoFilePath(projectId, videoPath, { thumbnailPath: saved });
  return saved;
}
