import { describe, expect, it } from 'vitest';
import { trimBlock } from './timing';
import { sceneTextFields } from './sceneText';
import type { EditDocument, EditShot, MediaItem } from '../types';
const shot = (id: string, scene = true): EditShot => ({
  id,
  mediaId: scene ? null : 'm1',
  scene: scene
    ? { composition: `compositions/${id}.html`, label: id, variables: { text: id } }
    : null,
  sourceIn: scene ? 0 : 1,
  duration: 4,
  speed: 1,
  move: 'none',
  transitionIn: 'cut',
  refShot: null,
  description: id,
  alternates: [],
});
const doc = (): EditDocument => ({
  title: 'QA',
  format: { width: 1920, height: 1080, fps: 30 },
  clipAudio: 0,
  music: null,
  shots: [shot('a'), shot('b'), shot('c')],
  overlays: [
    {
      id: 'inside',
      lane: 'text',
      start: 1,
      duration: 2,
      label: 'Title',
      composition: 'compositions/title.html',
      variables: { text: 'Title' },
    },
    {
      id: 'later',
      lane: 'graphics',
      start: 5,
      duration: 2,
      label: 'Graphic',
      composition: 'compositions/graphic.html',
      variables: {},
    },
  ],
});
const media = [{ id: 'm1', kind: 'video', duration: 6 }] as MediaItem[];
describe('segment trimming', () => {
  it('ripple-resizes a scene, retimes its animation and keeps associated overlays aligned', () => {
    const before = doc();
    const next = trimBlock(before, 'a', 'end', 2, [], 60);
    expect(next.shots.map((shot) => shot.duration)).toEqual([6, 4, 4]);
    expect(next.shots[0].scene?.variables.__editorTimeScale).toBe(1.5);
    expect(next.overlays[0]).toMatchObject({ start: 1.5, duration: 3 });
    expect(next.overlays[1]).toMatchObject({ start: 7, duration: 2 });
    expect(before.shots[0].duration).toBe(4);
    expect(
      trimBlock(next, 'a', 'end', -2, [], 60).shots[0].scene?.variables.__editorTimeScale
    ).toBe(1);
  });
  it('snaps to frames, enforces minimum and total length, and does not exceed source footage', () => {
    expect(trimBlock(doc(), 'a', 'end', 0.11, [], 60).shots[0].duration).toBeCloseTo(4 + 3 / 30);
    expect(trimBlock(doc(), 'a', 'end', -100, [], 60).shots[0].duration).toBe(0.1);
    expect(trimBlock(doc(), 'a', 'end', 20, [], 13).shots[0].duration).toBe(5);
    const footage = { ...doc(), shots: [shot('a', false)] };
    expect(trimBlock(footage, 'a', 'end', 20, media, 60).shots[0].duration).toBe(5);
    const trimmed = trimBlock(footage, 'a', 'start', 1, media, 60).shots[0];
    expect(trimmed).toMatchObject({ duration: 3, sourceIn: 2 });
    expect(trimBlock(footage, 'a', 'start', -20, media, 60).shots[0]).toMatchObject({
      duration: 5,
      sourceIn: 0,
    });
  });
  it('trims independent overlays without changing their parent shots', () => {
    const before = doc();
    const next = trimBlock(before, 'inside', 'end', 1, [], 60);
    expect(next.overlays[0]).toMatchObject({ start: 1, duration: 3 });
    expect(next.shots).toBe(before.shots);
    expect(trimBlock(before, 'inside', 'start', 1, [], 60).overlays[0]).toMatchObject({
      start: 2,
      duration: 1,
    });
  });
  it('resolves scene-linked text to its owner, and ignores invalid/no-op edits', () => {
    const before = doc();
    const field = sceneTextFields('a', before.shots[0].scene!)[0];
    expect(trimBlock(before, field.id, 'end', 1, [], 60).shots[0].duration).toBe(5);
    expect(trimBlock(before, 'a', 'end', 0, [], 60)).toBe(before);
    expect(trimBlock(before, 'a', 'end', NaN, [], 60)).toBe(before);
  });
});
