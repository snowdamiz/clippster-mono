import { expect, it } from 'vitest';
import { ratioAssetIds, remapRatioAssetIds } from './creatorRatioAssets';

it('maps per-ratio asset IDs while preserving disabled ratios', async () => {
  const settings = JSON.stringify({ '16:9': null, '9:16': { assetId: 'local-portrait' } });
  expect(ratioAssetIds(settings)).toEqual(['local-portrait']);
  expect(JSON.parse((await remapRatioAssetIds(settings, async id => id === 'local-portrait' ? 42 : 0))!))
    .toEqual({ '16:9': null, '9:16': { assetId: 42 } });
});
