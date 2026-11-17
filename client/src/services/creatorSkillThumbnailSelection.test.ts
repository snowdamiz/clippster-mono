import { expect, it } from 'vitest';
import { creatorSkillFrameSharpness, creatorSkillThumbnailFaceScore, creatorSkillThumbnailTimes, selectCreatorSkillThumbnailStills } from './creatorSkillThumbnailSelection';

it('samples three VOD frames in each of four regions', () => {
  const times = creatorSkillThumbnailTimes(100);
  expect(times).toHaveLength(12);
  expect(times[0]).toBeLessThan(times[3]);
  expect(times[times.length - 1]).toBeLessThan(100);
});

it('prefers a visible face over a sharper screen-only frame in the same region', () => {
  const face = creatorSkillThumbnailFaceScore(4, [{ width: .15, height: .2, score: .9 }]);
  const screen = creatorSkillThumbnailFaceScore(100, []);
  expect(face).toBeGreaterThan(screen);
  expect(selectCreatorSkillThumbnailStills([{ index: 0, score: face }, { index: 1, score: screen }]).map(still => still.index)).toEqual([0]);
});

it('prefers a frontal face over a turned face of the same size and confidence', () => {
  const face = { width: .4, height: .5, score: .9 };
  const frontal = creatorSkillThumbnailFaceScore(10, [{ ...face, keypoints: [{ x: .4, y: .4 }, { x: .6, y: .4 }, { x: .5, y: .5 }] }]);
  const turned = creatorSkillThumbnailFaceScore(10, [{ ...face, keypoints: [{ x: .4, y: .4 }, { x: .6, y: .4 }, { x: .6, y: .5 }] }]);
  expect(frontal).toBeGreaterThan(turned);
});

it('prefers locally sharp frames while retaining time diversity', () => {
  const stills = Array.from({ length: 12 }, (_, index) => ({ index, score: index % 3 === 1 ? 10 : 1 }));
  expect(selectCreatorSkillThumbnailStills(stills).map(still => still.index)).toEqual([1, 4, 7, 10]);
  const flat = new Uint8ClampedArray(8 * 8 * 4).fill(50);
  const edges = flat.slice();
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const value = (x + y) % 2 ? 255 : 0;
    const offset = (y * 8 + x) * 4;
    edges[offset] = edges[offset + 1] = edges[offset + 2] = value;
  }
  expect(creatorSkillFrameSharpness(edges, 8, 8)).toBeGreaterThan(creatorSkillFrameSharpness(flat, 8, 8));
});
