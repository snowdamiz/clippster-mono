import {
  createDefaultManualFramingConfig,
  createDefaultManualRegion,
} from '@clippster/shared-types';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getActiveFramingRegions,
  hasVisibleFraming,
  replaceActiveFramingRegions,
} from './framingRegions.ts';

describe('framingRegions', () => {
  it('requires a region or Use 16:9 before framing becomes visible', () => {
    const config = createDefaultManualFramingConfig();
    config.sourceFrameMode = 'none';
    assert.equal(hasVisibleFraming(config), false);
    config.regions = [createDefaultManualRegion(0)];
    assert.equal(hasVisibleFraming(config), true);
    config.regions = [];
    config.sourceFrameMode = 'use16x9';
    assert.equal(hasVisibleFraming(config), true);
  });

  it('uses base regions outside timed segments', () => {
    const config = createDefaultManualFramingConfig();
    const base = createDefaultManualRegion(0);
    config.regions = [base];
    config.segmentConfigs = [
      { segmentId: 'segment-1', startTime: 10, endTime: 20, regions: [] },
    ];

    assert.deepEqual(getActiveFramingRegions(config, 5).regions, [base]);
  });

  it('uses segment regions while the playhead is inside the segment', () => {
    const config = createDefaultManualFramingConfig();
    const segmentRegion = createDefaultManualRegion(1);
    config.segmentConfigs = [
      { segmentId: 'segment-1', startTime: 10, endTime: 20, regions: [segmentRegion] },
    ];

    assert.deepEqual(getActiveFramingRegions(config, 15), {
      regions: [segmentRegion],
      segmentIndex: 0,
    });
  });

  it('replaces only the active segment regions', () => {
    const config = createDefaultManualFramingConfig();
    config.regions = [createDefaultManualRegion(0)];
    config.segmentConfigs = [
      { segmentId: 'segment-1', startTime: 10, endTime: 20, regions: [] },
    ];
    const replacement = createDefaultManualRegion(2);

    const next = replaceActiveFramingRegions(config, 0, [replacement]);

    assert.deepEqual(next.regions, config.regions);
    assert.deepEqual(next.segmentConfigs?.[0]?.regions, [replacement]);
  });
});
