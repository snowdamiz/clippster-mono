import { describe, expect, it } from 'vitest';
import type { Blueprint, EditDocument, MediaItem } from '../types';
import {
  exampleCutTimes,
  exampleTimeAt,
  removeOverlay,
  removeShot,
  setBlockText,
  swapShot,
} from './edits';

const media: MediaItem[] = [
  {
    id: 'm1',
    name: 'a.mp4',
    kind: 'video',
    path: '',
    duration: 10,
    width: 1920,
    height: 1080,
    hasAudio: false,
    contentHash: 'h1',
  },
  {
    id: 'm2',
    name: 'b.mp4',
    kind: 'video',
    path: '',
    duration: 4,
    width: 1920,
    height: 1080,
    hasAudio: false,
    contentHash: 'h2',
  },
  {
    id: 'p1',
    name: 'c.jpg',
    kind: 'photo',
    path: '',
    duration: 0,
    width: 800,
    height: 600,
    hasAudio: false,
    contentHash: 'h3',
  },
];

const shot = (
  id: string,
  overrides: Partial<EditDocument['shots'][number]> = {}
): EditDocument['shots'][number] => ({
  id,
  mediaId: 'm1',
  scene: null,
  sourceIn: 0,
  duration: 2,
  speed: 1,
  move: 'none',
  transitionIn: 'cut',
  refShot: null,
  description: id,
  alternates: [],
  ...overrides,
});

const doc = (overrides: Partial<EditDocument> = {}): EditDocument => ({
  title: 't',
  format: { width: 1920, height: 1080, fps: 30 },
  music: null,
  clipAudio: 1,
  shots: [
    shot('s1', { sourceIn: 7 }),
    shot('s2', { transitionIn: 'flash' }),
    shot('s3', { mediaId: 'p1' }),
  ],
  overlays: [
    {
      id: 't1',
      lane: 'text',
      start: 0,
      duration: 1,
      label: 'A',
      composition: 'compositions/title.html',
      variables: { text: 'A' },
    },
    {
      id: 'g1',
      lane: 'graphics',
      start: 4.5,
      duration: 1.5,
      label: 'End',
      composition: 'compositions/end.html',
      variables: {},
    },
  ],
  ...overrides,
});

describe('timeline edits', () => {
  it('swaps a shot with an alternate and keeps the old one as an alternate', () => {
    const start = doc({
      shots: [
        shot('s1', { alternates: [{ mediaId: 'm2', sourceIn: 1, description: 'Steadier' }] }),
      ],
    });
    const swapped = swapShot(start, 's1', 0, media);
    expect(swapped.shots[0]).toMatchObject({
      mediaId: 'm2',
      sourceIn: 1,
      description: 'Steadier',
      alternates: [{ mediaId: 'm1', sourceIn: 0, description: 's1' }],
    });
    expect(swapShot(swapped, 's1', 0, media).shots[0]).toMatchObject({
      mediaId: 'm1',
      sourceIn: 0,
    });
  });

  it('refuses an alternate whose source no longer fits', () => {
    const start = doc({
      shots: [
        shot('s1', {
          duration: 3.5,
          alternates: [{ mediaId: 'm2', sourceIn: 1, description: 'x' }],
        }),
      ],
    });
    expect(swapShot(start, 's1', 0, media)).toEqual(start);
  });

  it('extends the previous shot into a removed shot as far as its source allows', () => {
    const removed = removeShot(doc(), 's2', media);
    expect(removed.shots.map((s) => [s.id, s.duration])).toEqual([
      ['s1', 3],
      ['s3', 2],
    ]);
    expect(removed.overlays.find((o) => o.id === 'g1')).toMatchObject({
      start: 4.5,
      duration: 0.5,
    });
  });

  it('extends photos fully and makes the new first shot a cut', () => {
    const photoFirst = doc({
      shots: [
        shot('s1', { mediaId: 'p1' }),
        shot('s2', { transitionIn: 'dip' }),
        shot('s3', { transitionIn: 'flash' }),
      ],
    });
    expect(removeShot(photoFirst, 's2', media).shots.map((s) => s.duration)).toEqual([4, 2]);
    expect(removeShot(photoFirst, 's1', media).shots[0].transitionIn).toBe('cut');
  });

  it('edits text and removes overlays', () => {
    const edited = setBlockText(doc(), 't1', 'SUMMER 2026');
    expect(edited.overlays[0]).toMatchObject({
      label: 'SUMMER 2026',
      variables: { text: 'SUMMER 2026' },
    });
    expect(removeOverlay(edited, 'g1').overlays.map((o) => o.id)).toEqual(['t1']);
  });

  it('edits a scene, extends it fully into a removed shot and never swaps it', () => {
    const scene = shot('intro', {
      mediaId: null,
      scene: {
        composition: 'compositions/card.html',
        label: 'Title card',
        variables: { text: 'HI', bg: '#000' },
      },
    });
    const start = doc({ shots: [scene, shot('s2')] });
    expect(setBlockText(start, 'intro', 'HELLO').shots[0].scene).toEqual({
      composition: 'compositions/card.html',
      label: 'Title card',
      variables: { text: 'HELLO', bg: '#000' },
    });
    expect(removeShot(start, 's2', media).shots).toMatchObject([{ id: 'intro', duration: 4 }]);
    expect(swapShot(start, 'intro', 0, media)).toEqual(start);
  });

  it('places example cuts from runs of consecutive example shots', () => {
    const blueprint = {
      shots: [0, 1, 2, 3].map((index) => ({ index, duration: [1.5, 2.5, 1, 3][index] })),
    } as unknown as Blueprint;
    const document = doc({
      shots: [
        shot('a', { refShot: 0 }),
        shot('b', { refShot: 1 }),
        shot('c', { refShot: null }),
        shot('d', { refShot: 3 }),
      ],
    });
    expect(exampleCutTimes(document, blueprint)).toEqual([1.5, 6]);
  });

  it('maps output time to the same offset in the matched example shot', () => {
    const blueprint = {
      shots: [
        { start: 10, duration: 1.5 },
        { start: 40, duration: 3 },
      ],
    } as unknown as Blueprint;
    const document = doc({
      shots: [shot('a', { refShot: 1 }), shot('b', { refShot: 0 }), shot('c')],
    });
    expect(exampleTimeAt(document, blueprint, 0.5)).toBe(40.5);
    expect(exampleTimeAt(document, blueprint, 3.9)).toBe(11.5);
    expect(exampleTimeAt(document, blueprint, 5)).toBeNull();
    expect(exampleTimeAt(document, null, 0.5)).toBeNull();
  });
});
