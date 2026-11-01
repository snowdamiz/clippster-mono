import { describe, expect, it } from 'vitest';
import { planAutoFraming, type FramingSample } from './planner';
import {
  trackingPosition,
  trackingExpression,
} from '../../../../packages/shared-types/src/framingTracking';
import { assertReviewedAutoFraming } from './validation';
import { mapFramingTranscript } from './timing';

const sample = (time: number, x: number, cut = false): FramingSample => ({
  time,
  cut,
  faces: [{ x, y: 0.2, width: 0.1, height: 0.2, score: 0.95 }],
});
describe('local framing planner', () => {
  it.each(['9:16', '4:5', '1:1'])('follows an off-center face without distorting %s', (ratio) => {
    const config = planAutoFraming([sample(0, 0.8), sample(1, 0.7)], 1920, 1080, ratio, 'source');
    const region = config.regions[0];
    const [w, h] = ratio.split(':').map(Number);
    expect((region.source.width * 1920) / (region.source.height * 1080)).toBeCloseTo(w / h);
    for (const p of region.sourceKeyframes!) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x + region.source.width).toBeLessThanOrEqual(1.000001);
    }
    expect(region.source.x).toBeGreaterThan((1 - region.source.width) / 2);
    expect(config.autoFraming?.reviewed).toBe(false);
  });
  it('keeps a camera stable through a short detection gap', () => {
    const config = planAutoFraming(
      [sample(0, 0.8), { time: 0.4, faces: [], cut: false }],
      1920,
      1080,
      '9:16',
      'source'
    );
    const [a, b] = config.regions[0].sourceKeyframes!;
    expect(b.x).toBe(a.x);
    expect(config.autoFraming?.warnings).toHaveLength(1);
  });
  it('snaps to the new shot instead of panning across a cut', () => {
    const config = planAutoFraming(
      [sample(0, 0.1), sample(1, 0.8, true)],
      1920,
      1080,
      '9:16',
      'source'
    );
    const points = config.regions[0].sourceKeyframes!;
    expect(trackingPosition(points, 0.99).x).toBe(points[0].x);
    expect(trackingPosition(points, 1).x).toBe(points[1].x);
    expect(trackingExpression(points, 'x')).toContain('gte(t,1.000000)');
  });
  it('interpolates smoothly and holds outside the path', () => {
    const points = [
      { time: 0, x: 0.1, y: 0 },
      { time: 2, x: 0.5, y: 0.2 },
    ];
    expect(trackingPosition(points, 1)).toEqual({ x: 0.30000000000000004, y: 0.1 });
    expect(trackingPosition(points, -1).x).toBe(0.1);
    expect(trackingPosition(points, 5).x).toBe(0.5);
  });
  it('does not pretend a center crop is face framing when detection fails', () => {
    expect(() =>
      planAutoFraming([{ time: 0, faces: [], cut: true }], 1920, 1080, '1:1', 'source')
    ).toThrow('No reliable faces');
    expect(() =>
      planAutoFraming(
        [{ ...sample(0, 0.2), faces: [{ ...sample(0, 0.2).faces[0], score: 0.2 }] }],
        1920,
        1080,
        '1:1',
        'source'
      )
    ).toThrow('No reliable faces');
  });
  it('flags people who cannot fit together', () => {
    const s = sample(0, 0.1);
    s.faces.push(sample(0, 0.8).faces[0]);
    expect(planAutoFraming([s], 1920, 1080, '9:16', 'source').autoFraming?.warnings[0]).toContain(
      'split layout'
    );
  });
});

describe('reviewed plan export contract', () => {
  it('maps caption words across removed gaps and repeated source ranges', () => {
    const words = [
      { word: 'one', start: 0, end: 1 },
      { word: 'cut', start: 3, end: 4 },
      { word: 'two', start: 10, end: 11 },
    ];
    const mapped = mapFramingTranscript(
      words,
      [
        { start: 10, end: 12 },
        { start: 20, end: 22 },
        { start: 10, end: 12 },
      ],
      10
    );
    expect(mapped.map((w) => [w.word, w.start])).toEqual([
      ['one', 0],
      ['two', 2],
      ['one', 4],
    ]);
  });
  const path = 'C:/video.mp4',
    segments = [
      { start_time: 10, end_time: 12 },
      { start_time: 20, end_time: 23 },
    ];
  function settings() {
    const config = planAutoFraming([sample(0, 0.2)], 1920, 1080, '9:16', 'source');
    config.autoFraming!.sourceIdentity = {
      path,
      ranges: [
        { start: 10, end: 12 },
        { start: 20, end: 23 },
      ],
    };
    return {
      framingMode: 'auto',
      aspectRatios: ['9:16'],
      manualFramingConfigs: { '9:16': config },
    };
  }
  it('blocks export until review and blocks changed sources or cuts', () => {
    const s = settings();
    expect(() => assertReviewedAutoFraming(s, path, segments)).toThrow('Preview and apply');
    s.manualFramingConfigs['9:16'].autoFraming!.reviewed = true;
    expect(() => assertReviewedAutoFraming(s, path, segments)).not.toThrow();
    expect(() => assertReviewedAutoFraming(s, path, [...segments].reverse())).toThrow(
      'source or cuts changed'
    );
    expect(() => assertReviewedAutoFraming(s, 'C:/other.mp4', segments)).toThrow(
      'source or cuts changed'
    );
    s.aspectRatios.push('4:5');
    expect(() => assertReviewedAutoFraming(s, path, segments)).toThrow('4:5');
  });
});
