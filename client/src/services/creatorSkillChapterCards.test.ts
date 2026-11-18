import { expect, it } from 'vitest';
import type { CreatorSkillPackage } from '@clippster/shared-types';
import type { EditDocument } from '../ai-video/types';
import { validateDocument } from '../ai-video/director/validate';
import { addCreatorSkillChapterCards } from './creatorSkillChapterCards';

const document = {
  title: 'Long take', format: { width: 1920, height: 1080, fps: 30 }, music: null, clipAudio: 1,
  shots: [{ id: 'source', mediaId: 'source', scene: null, sourceIn: 0, duration: 180, speed: 1, move: 'none', transitionIn: 'cut', refShot: null, description: '', alternates: [] }], overlays: [],
} as EditDocument;
const item = {
  chapters: [{ time: 0, title: 'The opening question' }, { time: 55.9, title: 'The source report' }, { time: 120.1, title: 'The takeaway' }],
  platformCopy: [],
} as unknown as CreatorSkillPackage;

it('renders editable chapter cards at validated timeline times', () => {
  const result = addCreatorSkillChapterCards(document, {}, item);
  expect(result.added).toBe(3);
  expect(result.document.overlays.map(overlay => overlay.start)).toEqual([0, 55, 120]);
  expect(result.files['compositions/creator-skill-chapter-1.html']).toContain('The source report');
  expect(validateDocument(result.document, { media: [{ id: 'source', name: 'clip', kind: 'video', path: 'clip.mp4', duration: 180, width: 1920, height: 1080, hasAudio: true, contentHash: 'test' }], maxSeconds: 180, exampleShots: 0, files: Object.keys(result.files), requireFiles: true }).errors).toEqual([]);
});

it('skips cards for invalid chapters or vertical shorts', () => {
  expect(addCreatorSkillChapterCards(document, {}, { ...item, chapters: [{ time: 0, title: 'Start' }, { time: 9, title: 'Too soon' }, { time: 175, title: 'Too late' }] }).added).toBe(0);
  expect(addCreatorSkillChapterCards({ ...document, format: { width: 1080, height: 1920, fps: 30 } }, {}, item).added).toBe(0);
});

it('reports a chapter that collides with both graphic lanes', () => {
  const occupied = { ...document, overlays: ['graphics', 'text'].map(lane => ({ id: lane, lane, start: 55, duration: 3, label: lane, composition: `compositions/${lane}.html`, variables: {} })) } as EditDocument;
  const result = addCreatorSkillChapterCards(occupied, {}, item);
  expect(result.added).toBe(2);
  expect(result.reviewItems).toEqual(expect.arrayContaining([expect.stringContaining('Chapter 2 at 55s could not fit')]));
});
