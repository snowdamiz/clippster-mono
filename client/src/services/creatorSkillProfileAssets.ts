import { ratioAssetIdFor } from './creatorRatioAssets';
import type { CreatorSkillFormat } from '@clippster/shared-types';

/** Skill edits use only creator media explicitly configured for their output ratio. */
export function creatorSkillProfileAssetIds(profile: {
  intro_ratio_settings?: unknown;
  outro_ratio_settings?: unknown;
}, ratio: CreatorSkillFormat = '9:16'): { intro?: string; outro?: string } {
  return {
    intro: ratioAssetIdFor(profile.intro_ratio_settings, ratio),
    outro: ratioAssetIdFor(profile.outro_ratio_settings, ratio),
  };
}
