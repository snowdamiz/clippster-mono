import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { detectPlatformFromUrl, getPlatformConfig } from '../config/platforms';
import { extractTokendChannel, isTokendUrl, parseTokendMediaRef } from './tokendUrl';

describe('platforms', () => {
  it('detects tokend URLs', () => {
    assert.equal(detectPlatformFromUrl('https://tokend.tv/seed-nova'), 'tokend');
    assert.equal(detectPlatformFromUrl('https://www.youtube.com/watch?v=abc'), 'youtube');
  });

  it('includes tokend platform config', () => {
    assert.equal(getPlatformConfig('tokend')?.name, 'Tokend');
  });
});

describe('tokend helpers', () => {
  it('parses channel slugs', () => {
    assert.equal(extractTokendChannel('https://tokend.tv/seed-nova'), 'seed-nova');
    assert.equal(extractTokendChannel('@seed-nova'), 'seed-nova');
    assert.equal(isTokendUrl('https://tokend.tv/seed-nova'), true);
  });

  it('parses media refs for grants', () => {
    const ref = parseTokendMediaRef('tokend-vod-dev-seed-nova-1');
    assert.ok(ref);
    assert.equal(ref!.type, 'streams');
    assert.equal(ref!.id, 'tokend-vod-dev-seed-nova-1');
  });
});
