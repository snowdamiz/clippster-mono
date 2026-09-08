import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assertCapabilityInvariants,
  isCapabilityFullySupported,
  toolsForSelection,
  type CapabilitySpecLike,
} from './toolDefinitions';

describe('capability gating', () => {
  it('hides gated tools until capability is fully supported', () => {
    const visible = new Set(['split', 'speed', 'volume', 'crop', 'rotate']);
    const tools = toolsForSelection('video', visible).map((tool) => tool.id);
    assert.ok(tools.includes('split'));
    assert.ok(tools.includes('speed'));
    assert.ok(!tools.includes('effects'));
    assert.ok(tools.includes('replace'));
    assert.ok(tools.includes('delete'));
  });

  it('fails partial capability registrations', () => {
    const specs: CapabilitySpecLike[] = [
      {
        id: 'blur',
        hasGraphNode: true,
        hasAndroidRenderer: true,
        hasIosRenderer: false,
        hasExport: true,
        hasValidation: true,
        hasGoldenFixture: true,
      },
      {
        id: 'split',
        hasGraphNode: true,
        hasAndroidRenderer: true,
        hasIosRenderer: true,
        hasExport: true,
        hasValidation: true,
        hasGoldenFixture: true,
      },
    ];
    const failures = assertCapabilityInvariants(specs);
    assert.ok(failures.some((message) => message.includes('blur')));
    assert.equal(isCapabilityFullySupported(specs[1]), true);
  });

  it('keeps gated tools hidden without capabilities', () => {
    const tools = toolsForSelection(null, new Set(['split'])).map((tool) => tool.id);
    assert.ok(tools.includes('edit'));
    assert.ok(tools.includes('add'));
    assert.ok(!tools.includes('effects'));
    assert.ok(!tools.includes('filters'));
    assert.ok(!tools.includes('adjust'));
    assert.ok(!tools.includes('text'));
  });

  it('shows effects/filters/adjust when their capabilities are unlocked', () => {
    const visible = new Set(['blur', 'color_matrix', 'brightness', 'captions', 'glitch', 'text']);
    const tools = toolsForSelection(null, visible).map((tool) => tool.id);
    assert.ok(tools.includes('effects'));
    assert.ok(tools.includes('filters'));
    assert.ok(tools.includes('adjust'));
    assert.ok(tools.includes('captions'));
    const overlayTools = toolsForSelection('overlay', visible).map((tool) => tool.id);
    assert.ok(overlayTools.includes('animation'));
    const textTools = toolsForSelection('text', visible).map((tool) => tool.id);
    assert.ok(textTools.includes('animation'));
  });

  it('shows reframe when the reframe capability is unlocked', () => {
    const visible = new Set(['crop', 'reframe', 'rotate']);
    const tools = toolsForSelection('video', visible).map((tool) => tool.id);
    assert.ok(tools.includes('crop'));
    assert.ok(tools.includes('reframe'));
    assert.ok(tools.includes('rotate'));
  });
});
