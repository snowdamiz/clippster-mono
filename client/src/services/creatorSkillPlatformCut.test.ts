import { expect, it } from 'vitest';
import type { CreatorSkillPackage } from '@clippster/shared-types';
import type { EditDocument, SpeechSegment } from '../ai-video/types';
import { creatorSkillTikTokCut, creatorSkillTikTokRestrictedSponsors } from './creatorSkillPlatformCut';
import { draftCreatorSkillSrt } from './creatorSkillCaptions';

const document = {
  title: 'Clip', format: { fps: 30 }, shots: [
    { id: 'a', mediaId: 'source', sourceIn: 0, duration: 12, speed: 1 },
    { id: 'b', mediaId: 'source', sourceIn: 15, duration: 8, speed: 1 },
  ], overlays: [{ id: 'creator-skill-sponsor-disclosure', start: 0, duration: 20 }, { id: 'title', start: 0, duration: 3 }],
} as EditDocument;
const item = { sponsors: [{ name: 'Pepsi', confirmed: true, platforms: ['YouTube', 'Instagram'] }] } as CreatorSkillPackage;
const speech = (start: number) => [{ start, end: start + 1, text: 'Pepsi is a sponsor', speakerId: null }] as SpeechSegment[];

it('makes an editable TikTok cut before a restricted sponsor read and removes the ad overlay', () => {
  const result = creatorSkillTikTokCut(document, 'source', speech(17), item);
  expect(result.document?.shots).toHaveLength(2);
  expect(result.document?.shots[1].duration).toBeCloseTo(1.733, 2);
  expect(result.document?.overlays.map(overlay => overlay.id)).toEqual(['title']);
  const captions = draftCreatorSkillSrt(result.document!, 'source', [
    { start: 1, end: 2, text: 'This is the topic', speakerId: null },
    ...speech(17),
  ]);
  expect(captions.content).toContain('This is the topic');
  expect(captions.content).not.toContain('Pepsi');
});

it('does not offer a short or unrestricted sponsor cut', () => {
  expect(creatorSkillTikTokRestrictedSponsors(item)).toEqual(['Pepsi']);
  expect(creatorSkillTikTokRestrictedSponsors({ sponsors: [{ ...item.sponsors[0], platforms: ['TikTok'] }] } as CreatorSkillPackage)).toEqual([]);
  expect(creatorSkillTikTokCut(document, 'source', speech(3), item).document).toBeUndefined();
  expect(creatorSkillTikTokCut(document, 'source', speech(17), { sponsors: [{ ...item.sponsors[0], platforms: ['TikTok'] }] } as CreatorSkillPackage).document).toBeUndefined();
});

it('blocks a cut that still contains sponsor graphics', () => {
  const decorated = { ...document, overlays: [...document.overlays, { id: 'logo', lane: 'graphics', start: 1, duration: 2, label: 'Pepsi offer', variables: {}, composition: 'compositions/logo.html' }] } as EditDocument;
  const result = creatorSkillTikTokCut(decorated, 'source', speech(17), item);
  expect(result.document).toBeUndefined();
  expect(result.reviewItems[0]).toContain('still contains Pepsi sponsor text');
});

it('rebuilds burned captions for the sponsor-free cut instead of carrying the full master transcript', () => {
  const captioned = { ...document, overlays: [...document.overlays, { id: 'creator-skill-captions', lane: 'captions', start: 0, duration: 20, label: 'Burned vertical captions', variables: {}, composition: 'compositions/creator-skill-captions.html' }] } as EditDocument;
  const result = creatorSkillTikTokCut(captioned, 'source', speech(17), item, { 'compositions/creator-skill-captions.html': '<div>Pepsi</div>' });
  expect(result.document?.overlays.map(overlay => overlay.id)).toEqual(['title']);
});
