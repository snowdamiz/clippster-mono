import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  GOLDEN_LAYER_KINDS_AT_15K,
  GOLDEN_SCENE_16x9,
  GOLDEN_SCENE_9x16,
} from '../fixtures/goldenScenes';
import {
  assertCapabilityInvariants,
  toolsForSelection,
} from './toolDefinitions';

describe('parity fixtures', () => {
  it('provides both canvas ratios', () => {
    assert.equal(GOLDEN_SCENE_9x16.canvas.activeRatio, '9:16');
    assert.equal(GOLDEN_SCENE_16x9.canvas.activeRatio, '16:9');
    assert.equal(GOLDEN_SCENE_9x16.canvas.outputByRatio['9:16'].width, 1080);
    assert.equal(GOLDEN_SCENE_16x9.canvas.outputByRatio['16:9'].width, 1920);
  });

  it('expects video+overlay+text at mid golden tick', () => {
    assert.deepEqual([...GOLDEN_LAYER_KINDS_AT_15K], ['video', 'overlay', 'text']);
  });

  it('shows unlocked tools when native capabilities include text/overlay', () => {
    const visible = new Set([
      'split',
      'speed',
      'volume',
      'crop',
      'reframe',
      'rotate',
      'text',
      'overlay',
      'opacity',
      'fade',
      'audio_mix',
    ]);
    const globalTools = toolsForSelection(null, visible).map((tool) => tool.id);
    assert.ok(globalTools.includes('text'));
    assert.ok(globalTools.includes('overlay'));
    assert.ok(globalTools.includes('audio'));
    assert.ok(!globalTools.includes('effects'));

    const overlayTools = toolsForSelection('overlay', visible).map((tool) => tool.id);
    assert.ok(overlayTools.includes('opacity'));
    assert.ok(overlayTools.includes('crop'));
    assert.ok(overlayTools.includes('reframe'));

    const videoTools = toolsForSelection('video', visible).map((tool) => tool.id);
    assert.ok(videoTools.includes('reframe'));
  });

  it('rejects partial capability records', () => {
    const failures = assertCapabilityInvariants([
      {
        id: 'dissolve',
        hasGraphNode: true,
        hasAndroidRenderer: true,
        hasIosRenderer: true,
        hasExport: false,
        hasValidation: true,
        hasGoldenFixture: true,
      },
    ]);
    assert.ok(failures.length > 0);
  });
});
