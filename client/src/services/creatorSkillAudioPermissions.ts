import type { CreatorSkillPreferences } from '@clippster/shared-types';
import type { EditDocument } from '../ai-video/types';

/** Extra music requires an explicit saved creator preference for automatic VOD pre-edits. */
export function applyCreatorSkillAudioPermissions(document: EditDocument, preferences?: CreatorSkillPreferences): { document: EditDocument; removedMusic: boolean; reviewItems: string[] } {
  if (!document.music) return { document, removedMusic: false, reviewItems: [] };
  if (preferences?.editing?.musicAllowed === true) return {
    document,
    removedMusic: false,
    reviewItems: ['Confirm the added music is licensed for every destination platform, including sponsored placements.'],
  };
  return {
    document: { ...document, music: null },
    removedMusic: true,
    reviewItems: ['AI-selected music was removed because the creator profile has not explicitly allowed music for automatic VOD edits.'],
  };
}
