import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CLIP_EFFECT_PRESETS } from '@clippster/clip-export';

import { GOLDEN_SCENE_9x16, GOLDEN_SCENE_16x9 } from '../fixtures/goldenScenes';
import { assertCapabilityInvariants, toolsForSelection } from '../panels/toolDefinitions';

const FULLY_SHIPPED = [
  'trim',
  'split',
  'speed',
  'volume',
  'crop',
  'reframe',
  'rotate',
  'mirror',
  'overlay',
  'audio_mix',
  'opacity',
  'fade',
  'text',
  'captions',
  'dissolve',
  'fade_transition',
  'wipe',
  'color_matrix',
  'brightness',
  'exposure',
  'contrast',
  'saturation',
  'temperature',
  'tint',
  'blur',
  'sharpen',
  'grain',
  'vignette',
  'glitch',
] as const;

describe('effect parity coverage', () => {
  it('ships style presets that the native engine can render', () => {
    const style = CLIP_EFFECT_PRESETS.filter((preset) => preset.category === 'style').map(
      (preset) => preset.type,
    );
    for (const type of ['blur', 'sharpen', 'glitch', 'vignette', 'grain', 'mirror', 'letterbox']) {
      assert.ok(style.includes(type as (typeof style)[number]), `missing preset ${type}`);
    }
  });

  it('keeps LUT out of the visible capability set', () => {
    assert.ok(!FULLY_SHIPPED.includes('lut' as never));
    assert.ok(!CLIP_EFFECT_PRESETS.some((preset) => (preset.type as string) === 'lut'));
    const tools = toolsForSelection(null, new Set(FULLY_SHIPPED)).map((tool) => tool.id);
    assert.ok(tools.includes('effects'));
    assert.ok(tools.includes('filters'));
    assert.ok(tools.includes('adjust'));
  });

  it('golden fixtures include effects and text animation metadata', () => {
    const video = GOLDEN_SCENE_9x16.tracks.find((track) => track.kind === 'video')?.items[0];
    const text = GOLDEN_SCENE_9x16.tracks.find((track) => track.kind === 'text')?.items[0];
    assert.ok(video && 'effectStack' in video && video.effectStack.some((e) => e.type === 'blur'));
    assert.ok(text && 'animationIn' in text && text.animationIn === 'pop');
  });

  it('golden fixtures cover both ratios with overlay+text layers', () => {
    assert.equal(GOLDEN_SCENE_9x16.canvas.activeRatio, '9:16');
    assert.equal(GOLDEN_SCENE_16x9.canvas.activeRatio, '16:9');
    assert.ok(GOLDEN_SCENE_9x16.tracks.some((track) => track.kind === 'text'));
    assert.ok(GOLDEN_SCENE_9x16.tracks.some((track) => track.kind === 'overlay'));
  });

  it('rejects partially registered LUT capability', () => {
    // all-false is not "partial" — fully gated capabilities are OK
    const gated = assertCapabilityInvariants([
      {
        id: 'lut',
        hasGraphNode: false,
        hasAndroidRenderer: false,
        hasIosRenderer: false,
        hasExport: false,
        hasValidation: false,
        hasGoldenFixture: false,
      },
    ]);
    assert.equal(gated.length, 0);

    // mixed flags must fail (partial registration)
    const mixed = assertCapabilityInvariants([
      {
        id: 'lut',
        hasGraphNode: true,
        hasAndroidRenderer: true,
        hasIosRenderer: false,
        hasExport: true,
        hasValidation: true,
        hasGoldenFixture: true,
      },
    ]);
    assert.ok(mixed.length > 0);
  });
});
