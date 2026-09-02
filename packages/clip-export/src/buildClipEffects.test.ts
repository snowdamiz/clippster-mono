import { describe, expect, it } from 'vitest';

import { buildClipEffectFilters, clipEffectVideoChain, effectColorMatrix } from './buildClipEffects';
import { buildTimelineClipArgs } from './buildTimelineExport';

describe('clip effects', () => {
  it('builds the same color grades the preview matrices represent', () => {
    expect(buildClipEffectFilters({ type: 'grayscale', intensity: 100 }).join(' ')).toContain('colorchannelmixer=');
    expect(effectColorMatrix({ type: 'grayscale', intensity: 100 })?.[0]).toBeCloseTo(0.3);
    expect(buildClipEffectFilters({ type: 'sepia', intensity: 80 })[0]).toContain('colorchannelmixer=');
    expect(buildClipEffectFilters({ type: 'negative', intensity: 100 })).toEqual(['negate']);
    expect(buildClipEffectFilters({ type: 'warm', intensity: 70 })[0]).toContain('colorbalance=rs=');
    expect(buildClipEffectFilters({ type: 'mirror', intensity: 100 })).toEqual(['hflip']);
  });

  it('inserts effect filters into the clip render after contain-scale', () => {
    const args = buildTimelineClipArgs({
      clip: {
        path: '/phone.mp4',
        sourceStart: 0,
        sourceEnd: 4,
        speed: 1,
        muted: false,
        effect: { type: 'vignette', intensity: 60 },
      },
      outputPath: '/tmp/clip.mp4',
      width: 1080,
      height: 1920,
      silentAudio: false,
    });

    expect(args.join(' ')).toContain('force_original_aspect_ratio=decrease');
    expect(args.join(' ')).toContain('vignette=a=');
  });

  it('chains glitch and speed without dropping the scaled pad', () => {
    const chain = clipEffectVideoChain({ type: 'glitch', intensity: 50 }, 1.5);
    expect(chain).toContain('rgbashift=');
    expect(chain).toContain('setpts=PTS/1.5');
    expect(chain.startsWith('[scaled]')).toBe(true);
  });
});
