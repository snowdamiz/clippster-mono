import type { SubtitleSettings } from '@/types';

/** Panel default `wordSpacing` is 0.35 (historical). Map to ~0.22em of font for natural gaps in preview + export. */
const SUBTITLE_WORD_SPACING_DEFAULT = 0.35;
const SUBTITLE_WORD_GAP_EM_EFFECTIVE = 0.22;

/** Letter spacing reference — VideoPlayer.vue uses 48px so the px value tracks rendered font. */
export const REFERENCE_SUBTITLE_FONT_PX = 48;

/**
 * Pixel gap between words, scaled with rendered font size (matches VideoPlayer flex `gap`).
 */
export function getSubtitleWordSpacingPx(
  wordSpacingSetting: number | undefined,
  fontSizePx: number
): number {
  const w = wordSpacingSetting ?? SUBTITLE_WORD_SPACING_DEFAULT;
  if (fontSizePx <= 0) return 0;
  return Math.max(
    0,
    (w / SUBTITLE_WORD_SPACING_DEFAULT) * SUBTITLE_WORD_GAP_EM_EFFECTIVE * fontSizePx
  );
}

export function getSubtitleLineHeightMultiplier(
  settings: Pick<SubtitleSettings, 'animationStyle' | 'lineHeight'>,
  aspectRatio: string
): number {
  const configured =
    Number.isFinite(settings.lineHeight) && settings.lineHeight > 0 ? settings.lineHeight : 1.2;
  const [w, h] = aspectRatio.split(':').map(Number);
  const aspectRatioValue = (w || 16) / (h || 9);
  const isVertical = aspectRatioValue <= 0.9;
  const needsExtraRoom =
    settings.animationStyle === 'karaoke' ||
    settings.animationStyle === 'zoom' ||
    settings.animationStyle === 'pop' ||
    settings.animationStyle === 'glow' ||
    settings.animationStyle === 'box-highlight' ||
    settings.animationStyle === 'wave';

  if (isVertical && needsExtraRoom) {
    return Math.max(configured, 1.45);
  }
  if (needsExtraRoom) {
    return Math.max(configured, 1.35);
  }
  return configured;
}

export function getSubtitleWordSafetyPaddingPx(
  settings: Pick<SubtitleSettings, 'animationStyle' | 'border1Width' | 'border2Width' | 'fontSize'>,
  fontSizePx: number,
  aspectRatio: string
): number {
  if (fontSizePx <= 0) return 0;
  const configuredFontSize = settings.fontSize > 0 ? settings.fontSize : REFERENCE_SUBTITLE_FONT_PX;
  const scaleFactor = fontSizePx / configuredFontSize;
  const strokeReserve =
    Math.max(0, (settings.border1Width || 0) + (settings.border2Width || 0)) * scaleFactor;
  const [w, h] = aspectRatio.split(':').map(Number);
  const aspectRatioValue = (w || 16) / (h || 9);
  const isVertical = aspectRatioValue <= 0.9;
  const needsEffectReserve =
    settings.animationStyle === 'karaoke' ||
    settings.animationStyle === 'zoom' ||
    settings.animationStyle === 'pop' ||
    settings.animationStyle === 'glow' ||
    settings.animationStyle === 'box-highlight' ||
    settings.animationStyle === 'wave';

  if (!needsEffectReserve) return strokeReserve;

  // The SVG word stack can draw outside the measured text box (stroke + active scale).
  // Reserve that room in layout so neighboring words do not overlap in 9:16 captions.
  const effectReserve = fontSizePx * (isVertical ? 0.2 : 0.14);
  return strokeReserve + effectReserve;
}
