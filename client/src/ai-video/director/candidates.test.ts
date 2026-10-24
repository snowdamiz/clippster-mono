import { describe, expect, it } from 'vitest';
import type { Blueprint, MediaItem, SourceSegment } from '../types';
import { buildCandidates, outputFormat } from './candidates';

const shot = (index: number, overrides: Partial<Blueprint['shots'][number]> = {}): Blueprint['shots'][number] => ({
  index,
  start: index * 2,
  end: index * 2 + 2,
  duration: 2,
  transitionIn: 'cut',
  motion: 0.6,
  motionPeak: 0.8,
  brightness: 0.4,
  saturation: 0.5,
  averageColor: '#333333',
  speedRampHint: false,
  freezeHint: false,
  flashes: [],
  label: { shotType: 'close-up', camera: 'tracking' },
  ...overrides,
});

const segment = (index: number, overrides: Partial<SourceSegment>): SourceSegment => ({
  index,
  start: index * 4,
  end: index * 4 + 4,
  motion: 0.5,
  brightness: 0.4,
  saturation: 0.5,
  quality: 'good',
  ...overrides,
});

const media: MediaItem[] = [
  { id: 'm1', name: 'a.mp4', kind: 'video', path: '', duration: 20, width: 1920, height: 1080, hasAudio: true, contentHash: 'h1' },
  { id: 'a1', name: 's.mp3', kind: 'audio', path: '', duration: 90, width: 0, height: 0, hasAudio: true, contentHash: 'h2' },
];

describe('outputFormat', () => {
  it('follows the example aspect ratio', () => {
    expect(outputFormat({ width: 1080, height: 1920, fps: 60 })).toEqual({ width: 1080, height: 1920, fps: 30 });
    expect(outputFormat({ width: 1440, height: 1800, fps: 24 })).toEqual({ width: 1080, height: 1350, fps: 24 });
    expect(outputFormat({ width: 1000, height: 1000, fps: 25 })).toEqual({ width: 1080, height: 1080, fps: 25 });
    expect(outputFormat({ width: 3840, height: 2160, fps: 29.97 })).toEqual({ width: 1920, height: 1080, fps: 30 });
  });
});

describe('buildCandidates', () => {
  it('ranks matching segments and skips unusable footage and audio', () => {
    const blueprint = { shots: [shot(0)] } as Blueprint;
    const sources = {
      m1: [
        segment(0, { shotType: 'wide', camera: 'static', motion: 0.05 }),
        segment(1, { shotType: 'close-up', camera: 'tracking', motion: 0.55, description: 'Wheel close-up' }),
        segment(2, { shotType: 'close-up', camera: 'tracking', quality: 'unusable' }),
      ],
      a1: [segment(0, {})],
    };
    const [result] = buildCandidates(blueprint, media, sources);
    expect(result.refShot).toBe(0);
    expect(result.options.map((o) => o.sourceIn)).toEqual([4, 0]);
    expect(result.options[0]).toMatchObject({ mediaId: 'm1', maxDuration: 16, description: 'Wheel close-up' });
  });
});
