import { createVideoPlayer, type VideoThumbnail } from 'expo-video';
import * as FileSystem from 'expo-file-system/legacy';

import { EDITOR_CACHE_POLICY } from '@/editor/performance/mediaPolicy';
import { getNativeEditorModule, isNativeEditorAvailable } from '@clippster/editor-native';

/** Image-like source accepted by ExpoImage / RN Image. */
export type ThumbnailSource = VideoThumbnail | { uri: string };

const frames = new Map<string, ThumbnailSource>();
const frameMetadata = new Map<string, { path: string; time: number }>();
const framesByPath = new Map<string, Map<number, ThumbnailSource>>();
const queues = new Map<string, Promise<void>>();
const MAX_CACHED_FRAMES = EDITOR_CACHE_POLICY.maxThumbnailFramesInMemory;

function frameKey(sourceKey: string, time: number, maxHeight: number): string {
  return `${sourceKey}@${(Math.round(time * 10) / 10).toFixed(1)}@${maxHeight}`;
}

function storeFrame(
  path: string,
  sourceKey: string,
  time: number,
  maxHeight: number,
  frame: ThumbnailSource,
) {
  const normalizedTime = Math.round(time * 10) / 10;
  const key = frameKey(sourceKey, normalizedTime, maxHeight);
  frames.delete(key);
  frames.set(key, frame);
  const pathFrames = framesByPath.get(path) ?? new Map<number, ThumbnailSource>();
  pathFrames.set(normalizedTime, frame);
  framesByPath.set(path, pathFrames);
  frameMetadata.set(key, { path, time: normalizedTime });
  while (frames.size > MAX_CACHED_FRAMES) {
    const oldestKey = frames.keys().next().value as string | undefined;
    if (!oldestKey) break;
    frames.delete(oldestKey);
    const metadata = frameMetadata.get(oldestKey);
    frameMetadata.delete(oldestKey);
    if (metadata) {
      const cachedFrames = framesByPath.get(metadata.path);
      cachedFrames?.delete(metadata.time);
      if (cachedFrames?.size === 0) framesByPath.delete(metadata.path);
    }
  }
}

function cachedFrame(
  sourceKey: string,
  time: number,
  maxHeight: number,
): ThumbnailSource | null {
  const key = frameKey(sourceKey, time, maxHeight);
  const frame = frames.get(key);
  if (!frame) return null;
  frames.delete(key);
  frames.set(key, frame);
  return frame;
}

async function generateNativeFrames(
  path: string,
  times: number[],
  sourceKey: string,
  maxHeight: number,
): Promise<void> {
  const native = getNativeEditorModule();
  if (!native) return;
  const cacheDir = `${FileSystem.cacheDirectory}editor-thumbs/`;
  await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
  for (const time of times) {
    const dest = `${cacheDir}${encodeURIComponent(sourceKey)}_${time.toFixed(1)}_${maxHeight}.jpg`;
    const existing = await FileSystem.getInfoAsync(dest);
    if (!existing.exists) {
      await native.generateThumbnail(path, time, dest);
    }
    storeFrame(path, sourceKey, time, maxHeight, { uri: dest });
  }
}

async function generateExpoFrames(
  path: string,
  times: number[],
  sourceKey: string,
  maxHeight: number,
): Promise<void> {
  const player = createVideoPlayer(path);
  try {
    player.muted = true;
    player.volume = 0;
    if (typeof player.generateThumbnailsAsync !== 'function') return;
    const thumbs = await player.generateThumbnailsAsync(times, { maxHeight });
    thumbs.forEach((thumb, index) => {
      const time = times[index];
      if (thumb && time != null) storeFrame(path, sourceKey, time, maxHeight, thumb);
    });
  } finally {
    player.release();
  }
}

/**
 * Filmstrip/thumbnail derivatives. Prefer native engine MediaMetadataRetriever /
 * AVAssetImageGenerator; fall back to expo-video createVideoPlayer (no hidden views).
 */
export async function getVideoFrames(
  path: string,
  times: number[],
  options?: { maxHeight?: number; sourceFingerprint?: string },
): Promise<Array<ThumbnailSource | null>> {
  const maxHeight = options?.maxHeight ?? 72;
  const sourceKey = options?.sourceFingerprint ?? path;
  const needed = times.map((time) => Math.max(0, time));
  const missing = needed.filter((time) => !frames.has(frameKey(sourceKey, time, maxHeight)));
  if (missing.length > 0) {
    const previous = queues.get(path) ?? Promise.resolve();
    const job = previous
      .catch(() => undefined)
      .then(async () => {
        const stillMissing = missing.filter(
          (time) => !frames.has(frameKey(sourceKey, time, maxHeight)),
        );
        if (stillMissing.length === 0) return;
        if (isNativeEditorAvailable()) {
          await generateNativeFrames(path, stillMissing, sourceKey, maxHeight);
        } else {
          await generateExpoFrames(path, stillMissing, sourceKey, maxHeight);
        }
      })
      .catch((error) => {
        console.warn('[Thumbnails] generate failed', error);
      });
    queues.set(path, job);
    await job;
  }
  return needed.map((time) => cachedFrame(sourceKey, time, maxHeight));
}

export function getClosestVideoFrame(path: string, time: number): ThumbnailSource | null {
  const pathFrames = framesByPath.get(path);
  if (!pathFrames?.size) return null;
  let closest: ThumbnailSource | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  pathFrames.forEach((frame, frameTime) => {
    const distance = Math.abs(frameTime - time);
    if (distance < closestDistance) {
      closest = frame;
      closestDistance = distance;
    }
  });
  return closest;
}
