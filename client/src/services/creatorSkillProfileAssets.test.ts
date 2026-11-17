import { expect, it } from 'vitest';
import { creatorSkillProfileAssetIds } from './creatorSkillProfileAssets';
import { creatorSkillFormatForDuration } from '@clippster/shared-types';

it('uses only enabled 9:16 profile assets', () => {
  expect(creatorSkillProfileAssetIds({
    intro_ratio_settings: JSON.stringify({ '16:9': { assetId: 'landscape' }, '9:16': { assetId: 'portrait-intro' } }),
    outro_ratio_settings: { '9:16': { assetId: 12 } },
  })).toEqual({ intro: 'portrait-intro', outro: '12' });
  expect(creatorSkillProfileAssetIds({ intro_ratio_settings: { '9:16': null }, outro_ratio_settings: { '9:16': { assetId: 13, enabled: false } } })).toEqual({ intro: undefined, outro: undefined });
});

it('selects long-form format at two minutes and the matching creator assets', () => {
  expect(creatorSkillFormatForDuration(119.9)).toBe('9:16');
  expect(creatorSkillFormatForDuration(120)).toBe('16:9');
  expect(creatorSkillProfileAssetIds({
    intro_ratio_settings: { '16:9': { assetId: 'landscape-intro' }, '9:16': { assetId: 'portrait-intro' } },
  }, '16:9')).toEqual({ intro: 'landscape-intro', outro: undefined });
});
