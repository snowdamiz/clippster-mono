import { Channel, invoke } from '@tauri-apps/api/core';
import { appLocalDataDir, join } from '@tauri-apps/api/path';
import { exists, mkdir, readFile, remove, writeFile } from '@tauri-apps/plugin-fs';
import { bytesToBase64 } from '@/utils/encoding';
import type { ProgressEvent, VideoMeasurement } from '../types';

export class CancelledError extends Error {
  constructor() {
    super('Cancelled');
    this.name = 'CancelledError';
  }
}

export function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new CancelledError();
}

/** Local cache shared by all sessions: source measurements and beat grids, keyed by content hash. */
export async function sourcesCacheDir(): Promise<string> {
  const dir = await join(await appLocalDataDir(), 'ai-video', 'sources');
  if (!(await exists(dir))) await mkdir(dir, { recursive: true });
  return dir;
}

export async function readJson<T>(path: string): Promise<T | null> {
  if (!(await exists(path))) return null;
  try {
    return JSON.parse(new TextDecoder().decode(await readFile(path))) as T;
  } catch {
    return null;
  }
}

export async function writeJson(path: string, data: unknown): Promise<void> {
  await writeFile(path, new TextEncoder().encode(JSON.stringify(data)));
}

/** Group consecutive ranges into chunks of at least `targetSeconds`, split only at range boundaries. */
export function groupIntoChunks<T extends { start: number; end: number }>(
  ranges: T[],
  targetSeconds: number
): T[][] {
  const chunks: T[][] = [];
  let current: T[] = [];
  for (const range of ranges) {
    current.push(range);
    if (range.end - current[0].start >= targetSeconds) {
      chunks.push(current);
      current = [];
    }
  }
  if (current.length) chunks.push(current);
  return chunks;
}

/** Extract `[start, end)` of a video as a small 480p MP4 and return it as base64. */
export async function extractChunkBase64(
  videoPath: string,
  start: number,
  end: number
): Promise<string> {
  const tempPath = await invoke<string>('extract_video_chunk_for_analysis', {
    videoPath,
    startTimeSecs: start,
    endTimeSecs: end,
  });
  try {
    return bytesToBase64(await readFile(tempPath));
  } finally {
    await remove(tempPath).catch(() => {});
  }
}

/** Run `measure_video` with progress; aborting the signal cancels the ffmpeg pass. */
export async function measureVideo(
  path: string,
  options: {
    maxShotSeconds: number | null;
    keyframes: boolean;
    onProgress?: (event: ProgressEvent) => void;
    signal?: AbortSignal;
  }
): Promise<VideoMeasurement> {
  throwIfAborted(options.signal);
  const jobId = crypto.randomUUID();
  const onEvent = new Channel<ProgressEvent>();
  onEvent.onmessage = (event) => options.onProgress?.(event);
  const cancel = () => void invoke('cancel_reference_analysis', { jobId });
  options.signal?.addEventListener('abort', cancel, { once: true });
  try {
    return await invoke<VideoMeasurement>('measure_video', {
      input: { jobId, path, maxShotSeconds: options.maxShotSeconds, keyframes: options.keyframes },
      onEvent,
    });
  } catch (error) {
    throwIfAborted(options.signal);
    throw error;
  } finally {
    options.signal?.removeEventListener('abort', cancel);
  }
}

/** Run `tasks` with at most `limit` in flight, preserving result order. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}
