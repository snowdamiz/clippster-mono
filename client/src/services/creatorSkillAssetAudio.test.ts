import { expect, it } from 'vitest';
import { creatorSkillAssetAudioReview } from './creatorSkillAssetAudio';

it('flags selected asset audio when added music has not been approved', () => {
  expect(creatorSkillAssetAudioReview('outro', true, false)).toContain('no added music was approved');
  expect(creatorSkillAssetAudioReview('intro', true, true)).toContain('platform licensing');
  expect(creatorSkillAssetAudioReview('outro', false, false)).toBeNull();
});
