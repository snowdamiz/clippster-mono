import { invoke } from '@tauri-apps/api/core';
import { join } from '@tauri-apps/api/path';
import * as videoApi from '../api';
import { detectBeats, type BeatGrid } from '../runtime/workspace';
import type { MediaItem, SourceIndex, SourceSegment, VideoMeasurement } from '../types';
import { extractChunkBase64, groupIntoChunks, mapLimit, measureVideo, readJson, sourcesCacheDir, throwIfAborted, writeJson } from './shared';

const SEGMENT_SECONDS = 4;
const CHUNK_SECONDS = 60;
const LABEL_CONCURRENCY = 3;
const PHOTO_LABEL_SIZE = 1024;
const PHOTO_KEY = 'photo';

export interface SourceProgress {
  done: number;
  total: number;
  name: string;
}

async function cachedMeasurement(item: MediaItem, signal?: AbortSignal): Promise<VideoMeasurement> {
  const path = await join(await sourcesCacheDir(), `${item.contentHash}.json`);
  const cached = await readJson<VideoMeasurement>(path);
  if (cached) return cached;
  const measurement = await measureVideo(item.path, { maxShotSeconds: SEGMENT_SECONDS, keyframes: false, signal });
  await writeJson(path, measurement);
  return measurement;
}

/** Beat grid of a song, cached by content hash. */
export async function songBeats(item: MediaItem): Promise<BeatGrid | null> {
  const path = await join(await sourcesCacheDir(), `${item.contentHash}.beats.json`);
  const cached = await readJson<BeatGrid>(path);
  if (cached) return cached;
  const beats = await detectBeats(item.path).catch(() => null);
  if (beats) await writeJson(path, beats);
  return beats;
}

function isLabelLimit(error: unknown) {
  return (error as { response?: { status?: number } })?.response?.status === 429;
}

/**
 * Segment every clip and photo and label what isn't in the session's index yet. Labels are cached
 * on the server by content hash and chunk, so re-runs only pay for new footage. When the run's
 * label budget runs out, the remaining segments keep their measurements without labels.
 */
export async function indexSources(
  runId: number,
  media: MediaItem[],
  index: SourceIndex,
  onProgress: (progress: SourceProgress) => void,
  signal?: AbortSignal
): Promise<Record<string, SourceSegment[]>> {
  const visual = media.filter((item) => item.kind !== 'audio');
  const sources: Record<string, SourceSegment[]> = {};
  let labelBudgetLeft = true;

  for (const [position, item] of visual.entries()) {
    throwIfAborted(signal);
    onProgress({ done: position, total: visual.length, name: item.name });
    const cached = index[item.contentHash] ?? {};

    if (item.kind === 'photo') {
      let segments = cached[PHOTO_KEY]?.segments;
      if (!segments && labelBudgetLeft) {
        try {
          const media = await invoke<string>('encode_image_for_ai', { path: item.path, maxDimension: PHOTO_LABEL_SIZE });
          segments = await videoApi.labelSource(runId, {
            content_hash: item.contentHash,
            chunk_key: PHOTO_KEY,
            chunk_start: 0,
            kind: 'photo',
            media,
            segments: [{ index: 0, start: 0, end: 0, motion: 0, brightness: 0.5, saturation: 0.5 }],
          });
        } catch (error) {
          if (!isLabelLimit(error)) throw error;
          labelBudgetLeft = false;
        }
      }
      sources[item.id] = segments ?? [{ index: 0, start: 0, end: 0, motion: 0, brightness: 0.5, saturation: 0.5 }];
      continue;
    }

    const measurement = await cachedMeasurement(item, signal);
    const measured: SourceSegment[] = measurement.shots.map((shot) => ({
      index: shot.index,
      start: shot.start,
      end: shot.end,
      motion: shot.motion,
      brightness: shot.brightness,
      saturation: shot.saturation,
    }));
    const chunks = groupIntoChunks(measured, CHUNK_SECONDS);
    const labelled = await mapLimit(chunks, LABEL_CONCURRENCY, async (segments) => {
      const key = `${segments[0].index}-${segments[segments.length - 1].index}`;
      const hit = cached[key]?.segments;
      if (hit) return hit;
      if (!labelBudgetLeft) return segments;
      throwIfAborted(signal);
      const start = segments[0].start;
      try {
        const media = await extractChunkBase64(item.path, start, segments[segments.length - 1].end);
        return await videoApi.labelSource(runId, { content_hash: item.contentHash, chunk_key: key, chunk_start: start, kind: 'video', media, segments });
      } catch (error) {
        if (!isLabelLimit(error)) throw error;
        labelBudgetLeft = false;
        return segments;
      }
    });
    sources[item.id] = labelled.flat();
  }

  onProgress({ done: visual.length, total: visual.length, name: '' });
  return sources;
}
