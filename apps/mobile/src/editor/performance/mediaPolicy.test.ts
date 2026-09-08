import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { decideEditorProxy } from './mediaPolicy';

describe('editor media performance policy', () => {
  it('keeps warm 1080p30 H.264 source playback on capable devices', () => {
    assert.equal(
      decideEditorProxy(
        { width: 1920, height: 1080, fps: 30, codec: 'h264', bitrate: 12_000_000 },
        { memoryClass: 'mid', hardwareDecode: true },
      ).required,
      false,
    );
  });

  it('requests bounded edit proxies for expensive sources and low-memory devices', () => {
    const fourK = decideEditorProxy(
      { width: 3840, height: 2160, fps: 60, codec: 'hevc', keyframeIntervalSeconds: 4 },
      { memoryClass: 'high', hardwareDecode: true },
    );
    assert.equal(fourK.required, true);
    assert.equal(fourK.height, 720);

    const lowMemory = decideEditorProxy(
      { width: 1920, height: 1080, fps: 30, codec: 'h264' },
      { memoryClass: 'low', hardwareDecode: true },
    );
    assert.equal(lowMemory.required, true);
    assert.equal(lowMemory.height, 540);
  });
});
