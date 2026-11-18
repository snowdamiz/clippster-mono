import { expect, it } from 'vitest';
import type { CreatorSkillPackage } from '@clippster/shared-types';
import type { EditDocument } from '../ai-video/types';
import { applyCreatorSkillFootageCrops } from './creatorSkillFootageCrop';

const document = { title: 'Crop review', music: null, clipAudio: 1, format: { width: 1080, height: 1920, fps: 30 }, shots: [{ id: 'source-shot', mediaId: 'source', scene: null, sourceIn: 10, duration: 5, speed: 1, move: 'none', transitionIn: 'cut', refShot: null, description: '', alternates: [] }], overlays: [] } as EditDocument;
const item = (range: { start: number; end: number; crop?: { x: number; y: number; width: number; height: number } }) => ({ footageReview: [{ ...range, show: 'Article body', hide: ['Address bar'], note: 'Keep the article only' }] }) as CreatorSkillPackage;

it('applies a whole-shot privacy crop without changing source time or duration', () => {
  const result = applyCreatorSkillFootageCrops(document, { id: 'source', width: 1080, height: 1920 }, item({ start: 10, end: 15, crop: { x: .1, y: .1, width: .4, height: .5 } }));
  expect(result.applied).toBe(1);
  expect(result.document.shots[0]).toMatchObject({ sourceIn: 10, duration: 5, framing: { y: .35, zoom: 2.5 } });
  expect(result.document.shots[0].framing?.x).toBeCloseTo(.3);
});

it('flags partial or excessively tight proposals for manual editing', () => {
  expect(applyCreatorSkillFootageCrops(document, { id: 'source', width: 1080, height: 1920 }, item({ start: 11, end: 14, crop: { x: 0, y: 0, width: .5, height: .5 } })).reviewItems[0]).toContain('split or crop');
  expect(applyCreatorSkillFootageCrops(document, { id: 'source', width: 1080, height: 1920 }, item({ start: 10, end: 15, crop: { x: 0, y: 0, width: .1, height: .1 } })).reviewItems[0]).toContain('4× limit');
  expect(applyCreatorSkillFootageCrops(document, { id: 'source', width: 1920, height: 1080 }, item({ start: 10, end: 15, crop: { x: 0, y: 0, width: .4, height: .5 } })).reviewItems[0]).toContain('outside the renderer');
});

it('maps source coordinates through the renderer’s cover crop before framing', () => {
  const result = applyCreatorSkillFootageCrops(document, { id: 'source', width: 1920, height: 1080 }, item({ start: 10, end: 15, crop: { x: .38, y: .1, width: .2, height: .7 } }));
  expect(result.applied).toBe(1);
  expect(result.document.shots[0].framing?.zoom).toBeGreaterThan(1);
  expect(result.document.shots[0].framing?.x).toBeGreaterThan(0);
  expect(result.document.shots[0].framing?.x).toBeLessThan(1);
});
