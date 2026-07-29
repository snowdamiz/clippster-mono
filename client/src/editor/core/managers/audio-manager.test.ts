import { describe, expect, it, vi } from 'vitest';
import { AudioManager } from './audio-manager';
import type { AudioClipSource } from '../../lib/media/audio';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function createNativeDecodeHarness() {
  const bytes = deferred<ArrayBuffer>();
  const decoded = {} as AudioBuffer;
  const arrayBuffer = vi.fn(() => bytes.promise);
  const decodeAudioData = vi.fn(async () => decoded);
  const manager = Object.create(AudioManager.prototype) as {
    audioContext: Pick<AudioContext, 'decodeAudioData'>;
    disposed: boolean;
    nativeFailedKeys: Set<string>;
    nativeBuffers: Map<string, AudioBuffer>;
    nativeBufferLoads: Map<string, Promise<AudioBuffer | null>>;
    resourceGeneration: number;
    getNativeAudioBuffer(clip: AudioClipSource): Promise<AudioBuffer | null>;
  };
  Object.assign(manager, {
    audioContext: { decodeAudioData },
    disposed: false,
    nativeFailedKeys: new Set<string>(),
    nativeBuffers: new Map<string, AudioBuffer>(),
    nativeBufferLoads: new Map<string, Promise<AudioBuffer | null>>(),
    resourceGeneration: 0,
  });
  const clip = {
    sourceKey: 'shared-source',
    file: { arrayBuffer, name: 'source.mp4' } as unknown as File,
  } as AudioClipSource;
  return { manager, clip, bytes, decoded, arrayBuffer, decodeAudioData };
}

describe('AudioManager native compatibility fallback', () => {
  it('tries the streaming sink before native whole-file decode', async () => {
    const getAudioSink = vi.fn(async () => null);
    const runNativeFallback = vi.fn(async () => true);
    const manager = Object.create(AudioManager.prototype) as {
      audioContext: AudioContext;
      editor: { playback: { getIsPlaying(): boolean } };
      playbackSessionId: number;
      activeClipIds: Set<string>;
      clipIterators: Map<string, unknown>;
      clipLastBufferTime: Map<string, number>;
      getAudioSink: typeof getAudioSink;
      runNativeFallback: typeof runNativeFallback;
      runClipIterator(args: {
        clip: AudioClipSource;
        startTime: number;
        sessionId: number;
      }): Promise<void>;
    };
    Object.assign(manager, {
      audioContext: {},
      editor: { playback: { getIsPlaying: () => true } },
      playbackSessionId: 1,
      activeClipIds: new Set(['clip']),
      clipIterators: new Map(),
      clipLastBufferTime: new Map(),
      getAudioSink,
      runNativeFallback,
    });
    const clip = {
      id: 'clip',
      sourceKey: 'source',
      file: { name: 'source.mp4' } as File,
    } as AudioClipSource;

    await manager.runClipIterator({ clip, startTime: 0, sessionId: 1 });

    expect(getAudioSink).toHaveBeenCalledOnce();
    expect(runNativeFallback).toHaveBeenCalledOnce();
    expect(getAudioSink.mock.invocationCallOrder[0]).toBeLessThan(
      runNativeFallback.mock.invocationCallOrder[0]
    );
  });

  it('deduplicates concurrent whole-file loads by sourceKey', async () => {
    const harness = createNativeDecodeHarness();

    const first = harness.manager.getNativeAudioBuffer(harness.clip);
    const second = harness.manager.getNativeAudioBuffer(harness.clip);
    expect(harness.arrayBuffer).toHaveBeenCalledTimes(1);

    harness.bytes.resolve(new ArrayBuffer(8));
    await expect(first).resolves.toBe(harness.decoded);
    await expect(second).resolves.toBe(harness.decoded);
    expect(harness.decodeAudioData).toHaveBeenCalledTimes(1);
  });

  it('ignores a decode that completes after resources are invalidated', async () => {
    const harness = createNativeDecodeHarness();
    const load = harness.manager.getNativeAudioBuffer(harness.clip);

    harness.manager.resourceGeneration++;
    harness.bytes.resolve(new ArrayBuffer(8));

    await expect(load).resolves.toBeNull();
    expect(harness.manager.nativeBuffers.size).toBe(0);
  });
});
