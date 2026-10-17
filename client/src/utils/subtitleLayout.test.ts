import { describe, expect, it } from 'vitest';
import {
  getSubtitleLineHeightMultiplier,
  getSubtitleWordSafetyPaddingPx,
  getSubtitleWordSpacingPx,
} from './subtitleLayout';

describe('shared preview/export subtitle geometry', () => {
  it('scales the default word gap with the rendered font and clamps negative gaps', () => {
    expect(getSubtitleWordSpacingPx(undefined, 48)).toBeCloseTo(10.56);
    expect(getSubtitleWordSpacingPx(0.35, 24)).toBeCloseTo(5.28);
    expect(getSubtitleWordSpacingPx(-1, 48)).toBe(0);
    expect(getSubtitleWordSpacingPx(0.35, 0)).toBe(0);
  });
  it('keeps space for animated captions in portrait and landscape', () => {
    const settings = { animationStyle: 'karaoke' as const, lineHeight: 1.2 };
    expect(getSubtitleLineHeightMultiplier(settings, '9:16')).toBe(1.45);
    expect(getSubtitleLineHeightMultiplier(settings, '16:9')).toBe(1.35);
    expect(getSubtitleLineHeightMultiplier({ ...settings, lineHeight: 2 }, '9:16')).toBe(2);
    expect(
      getSubtitleLineHeightMultiplier({ animationStyle: 'single-word', lineHeight: NaN }, '9:16')
    ).toBe(1.2);
  });
  it('preserves scaled outline and animation padding used by desktop PNG exports', () => {
    const settings = {
      animationStyle: 'pop' as const,
      border1Width: 2,
      border2Width: 1,
      fontSize: 48,
    };
    expect(getSubtitleWordSafetyPaddingPx(settings, 24, '9:16')).toBeCloseTo(6.3);
    expect(getSubtitleWordSafetyPaddingPx(settings, 24, '16:9')).toBeCloseTo(4.86);
    expect(
      getSubtitleWordSafetyPaddingPx({ ...settings, animationStyle: 'single-word' }, 24, '9:16')
    ).toBe(1.5);
  });
});
