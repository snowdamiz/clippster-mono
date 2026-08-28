import type { VideoPlayer, VideoThumbnail } from 'expo-video';

const players = new Map<string, VideoPlayer>();
const ready = new Map<string, boolean>();
const waiters = new Map<string, Array<(player: VideoPlayer) => void>>();
const frames = new Map<string, VideoThumbnail>();
const queues = new Map<string, Promise<void>>();

function frameKey(path: string, time: number): string {
  return `${path}@${(Math.round(time * 10) / 10).toFixed(1)}`;
}

function flushWaiters(path: string, player: VideoPlayer) {
  const pending = waiters.get(path);
  if (!pending) return;
  waiters.delete(path);
  pending.forEach((resolve) => resolve(player));
}

export function registerThumbnailPlayer(path: string, player: VideoPlayer) {
  players.set(path, player);
  if (player.status === 'readyToPlay') {
    ready.set(path, true);
    flushWaiters(path, player);
  } else {
    ready.set(path, false);
  }
}

export function markThumbnailPlayerReady(path: string, player: VideoPlayer) {
  players.set(path, player);
  ready.set(path, true);
  flushWaiters(path, player);
}

export function unregisterThumbnailPlayer(path: string, player: VideoPlayer) {
  if (players.get(path) !== player) return;
  players.delete(path);
  ready.delete(path);
}

function waitForPlayer(path: string, timeoutMs = 20000): Promise<VideoPlayer> {
  const existing = players.get(path);
  if (existing && ready.get(path)) return Promise.resolve(existing);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Thumbnail player timed out')), timeoutMs);
    const list = waiters.get(path) ?? [];
    list.push((player) => {
      clearTimeout(timer);
      resolve(player);
    });
    waiters.set(path, list);
    if (existing?.status === 'readyToPlay') {
      clearTimeout(timer);
      ready.set(path, true);
      flushWaiters(path, existing);
    }
  });
}

export async function getVideoFrames(
  path: string,
  times: number[],
  options?: { maxHeight?: number },
): Promise<(VideoThumbnail | null)[]> {
  const needed = times.map((time) => Math.max(0, time));
  const missing = needed.filter((time) => !frames.has(frameKey(path, time)));
  if (missing.length > 0) {
    const previous = queues.get(path) ?? Promise.resolve();
    const job = previous
      .catch(() => undefined)
      .then(async () => {
        const player = await waitForPlayer(path);
        if (typeof player.generateThumbnailsAsync !== 'function') return;
        const stillMissing = missing.filter((time) => !frames.has(frameKey(path, time)));
        if (stillMissing.length === 0) return;
        const thumbs = await player.generateThumbnailsAsync(stillMissing, {
          maxHeight: options?.maxHeight ?? 72,
        });
        thumbs.forEach((thumb, index) => {
          const time = stillMissing[index];
          if (thumb && time != null) frames.set(frameKey(path, time), thumb);
        });
      })
      .catch((error) => {
        console.warn('[Thumbnails] generate failed', error);
      });
    queues.set(path, job);
    await job;
  }
  return needed.map((time) => frames.get(frameKey(path, time)) ?? null);
}
