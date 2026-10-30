import { Channel, invoke } from '@tauri-apps/api/core';
import { dirname, join } from '@tauri-apps/api/path';
import * as videoApi from '../api';
import { detectBeats, type BeatGrid } from '../runtime/workspace';
import type { Blueprint, ProgressEvent, ReferenceInfo, VideoMeasurement } from '../types';
import {
  extractChunkBase64,
  groupIntoChunks,
  mapLimit,
  measureVideo,
  readJson,
  throwIfAborted,
  writeJson,
} from './shared';

const MIN_CHUNK_SECONDS = 30;
const CHUNK_CONCURRENCY = 3;

export type ExampleInput = { kind: 'url' | 'upload'; value: string };

const LINK_PATTERN = /^https?:\/\/[^\s/]+\.[^\s]+$/i;

/** A full web link the example can be downloaded from. */
export function isExampleLink(value: string): boolean {
  return LINK_PATTERN.test(value.trim());
}

export interface ExampleProgress {
  stage: 'downloading' | 'measuring' | 'watching' | 'summarizing';
  progress: number;
  message: string;
}

interface ImportedReference {
  path: string;
  metadata: {
    duration: number;
    width: number;
    height: number;
    fps: number;
    sourceType: string;
    displayName: string;
    sourceUrl: string | null;
  };
}

/** The measurement (with keyframe paths) lives next to the stored example for snapshots and compare mode. */
export async function measurementPath(examplePath: string): Promise<string> {
  return join(await dirname(examplePath), 'measurement.json');
}

export async function loadExampleMeasurement(
  examplePath: string
): Promise<VideoMeasurement | null> {
  return readJson<VideoMeasurement>(await measurementPath(examplePath));
}

/**
 * Bring the example into the session, measure every shot, label them in chunks and build the
 * blueprint. Charged (reference credits) only when the blueprint is saved.
 */
export async function analyzeExample(
  sessionId: number,
  input: ExampleInput,
  maxChunks: number,
  onProgress: (progress: ExampleProgress) => void,
  signal?: AbortSignal
): Promise<{ reference: ReferenceInfo; blueprint: Blueprint; measurement: VideoMeasurement }> {
  const imported = await importExample(sessionId, input, onProgress, signal);
  const reference: ReferenceInfo = {
    path: imported.path,
    displayName: imported.metadata.displayName,
    sourceUrl: imported.metadata.sourceUrl,
    sourceType: imported.metadata.sourceType,
    duration: imported.metadata.duration,
    width: imported.metadata.width,
    height: imported.metadata.height,
    fps: imported.metadata.fps,
  };
  throwIfAborted(signal);
  await videoApi.updateSession(sessionId, { reference });

  const measurement = await measureVideo(imported.path, {
    maxShotSeconds: null,
    keyframes: true,
    signal,
    onProgress: (event) =>
      onProgress({ stage: 'measuring', progress: event.progress, message: 'Measuring every cut' }),
  });
  await writeJson(await measurementPath(imported.path), measurement);
  const beats = await detectBeats(imported.path).catch((): BeatGrid | null => null);
  throwIfAborted(signal);

  const runId = await videoApi.startReference(sessionId);
  try {
    // Full chunks plus one remainder must stay within the server's chunk cap.
    const target = Math.max(MIN_CHUNK_SECONDS, measurement.duration / (maxChunks - 1));
    const chunks = groupIntoChunks(measurement.shots, target);
    let done = 0;
    onProgress({ stage: 'watching', progress: 0, message: 'Watching the example' });
    await mapLimit(chunks, CHUNK_CONCURRENCY, async (shots, chunkIndex) => {
      throwIfAborted(signal);
      const start = shots[0].start;
      const end = shots[shots.length - 1].end;
      const video = await extractChunkBase64(imported.path, start, end);
      throwIfAborted(signal);
      await videoApi.labelReferenceChunk(
        sessionId,
        runId,
        chunkIndex,
        video,
        shots.map((shot) => ({
          index: shot.index,
          start: round3(shot.start - start),
          end: round3(shot.end - start),
        }))
      );
      done += 1;
      onProgress({
        stage: 'watching',
        progress: Math.round((done / chunks.length) * 100),
        message: 'Watching the example',
      });
    });

    onProgress({ stage: 'summarizing', progress: 100, message: 'Writing down the style' });
    const shots = measurement.shots.map(({ keyframePath: _keyframe, ...shot }) => shot);
    const blueprint = await videoApi.finishReference(
      sessionId,
      runId,
      { ...measurement, shots },
      beats
    );
    return { reference, blueprint, measurement };
  } catch (error) {
    await videoApi
      .failRun(runId, videoApi.apiErrorMessage(error, 'Example analysis failed'))
      .catch(() => {});
    throw error;
  }
}

async function importExample(
  sessionId: number,
  input: ExampleInput,
  onProgress: (progress: ExampleProgress) => void,
  signal?: AbortSignal
): Promise<ImportedReference> {
  throwIfAborted(signal);
  const jobId = crypto.randomUUID();
  const onEvent = new Channel<ProgressEvent>();
  onEvent.onmessage = (event) =>
    onProgress({ stage: 'downloading', progress: event.progress, message: event.message });
  const cancel = () => void invoke('cancel_reference_analysis', { jobId });
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    return await invoke<ImportedReference>('import_reference_video', {
      input: { jobId, kind: input.kind, value: input.value },
      sessionId,
      onEvent,
    });
  } catch (error) {
    throwIfAborted(signal);
    throw error;
  } finally {
    signal?.removeEventListener('abort', cancel);
  }
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}
