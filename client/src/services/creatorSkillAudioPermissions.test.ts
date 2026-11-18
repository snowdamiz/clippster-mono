import { expect, it } from 'vitest';
import type { EditDocument } from '../ai-video/types';
import { applyCreatorSkillAudioPermissions } from './creatorSkillAudioPermissions';

const document = { music: { mediaId: 'track', start: 0, volume: 0.5 } } as EditDocument;

it('removes AI-selected music without an explicit creator preference', () => {
  const result = applyCreatorSkillAudioPermissions(document);
  expect(result.document.music).toBeNull();
  expect(result.removedMusic).toBe(true);
  expect(result.reviewItems).toHaveLength(1);
  expect(document.music).not.toBeNull();
});

it('keeps music when the creator profile explicitly allows it', () => {
  const result = applyCreatorSkillAudioPermissions(document, { editing: { musicAllowed: true } });
  expect(result.document).toBe(document);
  expect(result.removedMusic).toBe(false);
  expect(result.reviewItems[0]).toContain('licensed');
});
