import { expect, it } from 'vitest';
import type { EditDocument } from '../ai-video/types';
import { validateDocument } from '../ai-video/director/validate';
import { addCreatorSkillHookTitle } from './creatorSkillHookTitle';

const document = {
  title: 'What Happened to Pepsi?', format: { width: 1080, height: 1920, fps: 30 }, music: null, clipAudio: 1,
  shots: [{ id: 'source', mediaId: 'source', scene: null, sourceIn: 0, duration: 5, speed: 1, move: 'none', transitionIn: 'cut', refShot: null, description: '', alternates: [] }], overlays: [],
} as EditDocument;

it('adds an editable hook from frame one without changing the clip audio', () => {
  const result = addCreatorSkillHookTitle(document, {});
  expect(result.added).toBe(true);
  expect(result.document.overlays[0]).toMatchObject({ lane: 'text', start: 0, duration: 2.5, label: 'Hook title: What Happened to Pepsi?' });
  expect(result.files['compositions/creator-skill-hook-title.html']).toContain('What Happened to Pepsi?');
  expect(result.document.clipAudio).toBe(1);
  expect(validateDocument(result.document, { media: [{ id: 'source', name: 'clip', kind: 'video', path: 'clip.mp4', duration: 5, width: 1080, height: 1920, hasAudio: true, contentHash: 'test' }], maxSeconds: 60, exampleShots: 0, files: Object.keys(result.files), requireFiles: true }).errors).toEqual([]);
});

it('uses the open graphics lane when text occupies the first frame', () => {
  const occupied = { ...document, overlays: [{ id: 'existing', lane: 'text', start: 0, duration: 5, label: 'Caption', composition: 'compositions/existing.html', variables: {} }] } as EditDocument;
  expect(addCreatorSkillHookTitle(occupied, {}).document.overlays[1].lane).toBe('graphics');
});

it('does not duplicate an existing first-frame title', () => {
  const titled = { ...document, overlays: [{ id: 'headline', lane: 'graphics', start: 0, duration: 2, label: 'Headline', composition: 'compositions/headline.html', variables: {} }] } as EditDocument;
  expect(addCreatorSkillHookTitle(titled, {}).added).toBe(false);
});

it('leaves placeholder titles for human review', () => {
  const placeholder = { ...document, title: 'X% gains today' };
  const result = addCreatorSkillHookTitle(placeholder, {});
  expect(result.added).toBe(false);
  expect(result.reviewItems[0]).toContain('no usable first-frame hook');
});
