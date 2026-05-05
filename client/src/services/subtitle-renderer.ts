/**
 * Subtitle PNG Renderer
 * 
 * Pre-renders subtitle frames to transparent PNGs for pixel-perfect export.
 * This matches the preview rendering in VideoPlayer.vue exactly by using
 * Canvas 2D to replicate the SVG-based rendering.
 */

import { invoke } from '@tauri-apps/api/core';

export interface SubtitleSettings {
  enabled: boolean;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  textColor: string;
  backgroundColor: string;
  backgroundEnabled: boolean;
  border1Width: number;
  border1Color: string;
  border2Width: number;
  border2Color: string;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowBlur: number;
  shadowColor: string;
  position: 'top' | 'middle' | 'bottom' | { x: number; y: number };
  positionPercentage: number;
  maxWidth: number;
  animationStyle: 'none' | 'karaoke' | 'zoom' | 'pop' | 'glow' | 'box-highlight' | 'typewriter' | 'wave' | 'single-word';
  highlightColor: string;
  multiColorEnabled: boolean;
  multiColorMode: 'default' | 'custom';
  colorPalette: string[];
  lineHeight: number;
  letterSpacing: number;
  textAlign: 'left' | 'center' | 'right';
  textOffsetX: number;
  textOffsetY: number;
  padding: number;
  borderRadius: number;
  wordSpacing: number;
}

export interface WordInfo {
  word: string;
  start: number;
  end: number;
  confidence?: number;
}

export interface SubtitleOverlay {
  imagePath: string;
  startTime: number;
  endTime: number;
  positionX: number;
  positionY: number;
}

interface SubtitleFrame {
  words: WordInfo[];
  startTime: number;
  endTime: number;
  activeWordIndex: number;
}

const DEFAULT_COLOR_PALETTE = ['#04F827', '#0ea5e9', '#FFFD03', '#FFFFFF'];
const DEFAULT_SUBTITLE_HIGHLIGHT = '#0ea5e9';

/** Panel default `wordSpacing` is 0.35 (historical). Map to ~0.22em of font for natural gaps in preview + export. */
const SUBTITLE_WORD_SPACING_DEFAULT = 0.35;
const SUBTITLE_WORD_GAP_EM_EFFECTIVE = 0.22;

/** Letter spacing reference — VideoPlayer.vue uses 48px so the px value tracks rendered font. */
const REFERENCE_SUBTITLE_FONT_PX = 48;

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
  settings: Pick<
    SubtitleSettings,
    'animationStyle' | 'border1Width' | 'border2Width' | 'fontSize'
  >,
  fontSizePx: number,
  aspectRatio: string
): number {
  if (fontSizePx <= 0) return 0;
  const configuredFontSize = settings.fontSize > 0 ? settings.fontSize : REFERENCE_SUBTITLE_FONT_PX;
  const scaleFactor = fontSizePx / configuredFontSize;
  const strokeReserve = Math.max(0, (settings.border1Width || 0) + (settings.border2Width || 0)) * scaleFactor;
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

/**
 * Aspect-ratio scale factor — mirrors VideoPlayer.vue `finalFontSizeScale`.
 * Preview shrinks vertical/square to keep subtitles readable in narrow frames; we must apply
 * the SAME scale to the canvas so the export visually matches what the user saw.
 */
function aspectRatioFontScaleFromString(aspectRatio: string): number {
  const [w, h] = aspectRatio.split(':').map(Number);
  if (!Number.isFinite(w) || !Number.isFinite(h) || h <= 0) return 1;
  const value = w / h;
  if (value <= 0.9) return 0.65;
  if (value <= 1.1) return 0.78;
  return 1;
}

/**
 * Ensure the resolved font is fully loaded before measuring/drawing on canvas.
 * Without this, `ctx.font = '700 56px "Inter", sans-serif'` falls back to a system
 * font (different glyph widths) when the web font hasn't loaded yet — which causes
 * the export to wrap differently and look smaller/misplaced vs the preview.
 */
async function ensureFontLoaded(fontShorthand: string): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await document.fonts.load(fontShorthand);
    if ((document.fonts as any).ready) {
      await (document.fonts as any).ready;
    }
  } catch (err) {
    console.warn('[SubtitleRenderer] document.fonts.load failed (using fallback metrics):', err);
  }
}

/**
 * Pre-render subtitle frames to PNG images for a clip build.
 * Returns an array of SubtitleOverlay objects containing the image paths and timing.
 */
export async function preRenderSubtitleOverlays({
  settings,
  words,
  segments,
  maxWords,
  canvasWidth,
  canvasHeight,
  aspectRatio,
  introOffset = 0,
  clipStartTime = 0,
}: {
  settings: SubtitleSettings;
  words: WordInfo[];
  segments: { start: number; end: number; transcript: string }[];
  maxWords: number;
  canvasWidth: number;
  canvasHeight: number;
  aspectRatio: string;
  introOffset?: number;
  /**
   * Source-time offset of the OUTPUT clip's first frame. Word/segment times are subtracted
   * by this value to convert them into output-video time (which always starts at 0 + introOffset).
   * For a clip extracted from `-ss K` of the source, pass `K`. For a clip whose source already
   * matches the output (most common case), pass 0.
   */
  clipStartTime?: number;
}): Promise<SubtitleOverlay[]> {
  if (!settings.enabled || words.length === 0) {
    return [];
  }

  const overlays: SubtitleOverlay[] = [];
  const frames = computeSubtitleFrames(settings, words, segments, maxWords, clipStartTime);

  console.log(`[SubtitleRenderer] Pre-rendering ${frames.length} subtitle frames for ${aspectRatio}`, {
    position: settings.position,
    positionPercentage: settings.positionPercentage,
    maxWidth: settings.maxWidth,
    fontSize: settings.fontSize,
    animationStyle: settings.animationStyle,
    highlightColor: settings.highlightColor,
  });

  // Pre-load the font ONCE before rendering all frames so canvas measureText
  // returns the same widths the preview's CSS layout used.
  const aspectFontScale = aspectRatioFontScaleFromString(aspectRatio);
  const previewFontPx = settings.fontSize * aspectFontScale * (canvasHeight / 1080);
  const preloadFont = `${settings.fontWeight} ${Math.max(1, Math.round(previewFontPx))}px "${settings.fontFamily}", sans-serif`;
  await ensureFontLoaded(preloadFont);

  console.log(`[SubtitleRenderer] Renderer effective scale for ${aspectRatio}:`, {
    aspectFontScale,
    canvasScale: canvasHeight / 1080,
    combined: aspectFontScale * (canvasHeight / 1080),
    settingsFontSize: settings.fontSize,
    canvasFontSize: previewFontPx,
    fontFamily: settings.fontFamily,
  });

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    
    try {
      const result = await renderSubtitleFrame({
        settings,
        frame,
        canvasWidth,
        canvasHeight,
        aspectRatio,
        allWords: words,
      });

      if (result) {
        // Save PNG to temp file via Tauri
        const arrayBuffer = await result.blob.arrayBuffer();
        const bytes = Array.from(new Uint8Array(arrayBuffer));
        
        const imagePath = await invoke<string>('save_subtitle_overlay_png', {
          pngBytes: bytes,
          aspectRatio: aspectRatio.replace(':', '-'),
          frameIndex: i,
        });

        overlays.push({
          imagePath,
          startTime: frame.startTime + introOffset,
          endTime: frame.endTime + introOffset,
          positionX: result.positionX,
          positionY: result.positionY,
        });
      }
    } catch (err) {
      console.error(`[SubtitleRenderer] Failed to render frame ${i}:`, err);
    }
  }

  if (frames.length > 0 && overlays.length === 0) {
    throw new Error('Subtitle PNG rendering produced 0 overlays. Refusing to fall back to mismatched ASS subtitles.');
  }

  console.log(`[SubtitleRenderer] Successfully pre-rendered ${overlays.length}/${frames.length} frames`);
  return overlays;
}

/**
 * Compute the subtitle frames (which words to show and when) based on segments and animation style.
 *
 * IMPORTANT — timing model:
 *   `clipStartTime` is the source-time at which the OUTPUT video begins (typically 0 when the
 *   source media file already IS the clip). Frame times are emitted in output-video time, i.e.
 *   `(wordTime - clipStartTime)`. The previous implementation used `min(segment.start)` for
 *   this offset, which silently shifted ALL subtitles earlier whenever the clip had silence
 *   before the first whisper segment — making subtitles appear during silence and end before
 *   the speaker actually finished talking.
 */
function computeSubtitleFrames(
  settings: SubtitleSettings,
  words: WordInfo[],
  segments: { start: number; end: number; transcript: string }[],
  maxWords: number,
  clipStartTime: number
): SubtitleFrame[] {
  const frames: SubtitleFrame[] = [];

  // Filter window: keep words inside the union of segment ranges. We use min/max for filtering
  // ONLY — never for time offsetting (see header comment above).
  const filterStart = segments.length > 0 ? Math.min(...segments.map(s => s.start)) : -Infinity;
  const filterEnd = segments.length > 0 ? Math.max(...segments.map(s => s.end)) : Infinity;

  const clipWords = words.filter(w => w.start >= filterStart && w.end <= filterEnd);

  console.log('[SubtitleRenderer] computeSubtitleFrames called with:', {
    animationStyle: settings.animationStyle,
    totalWordsCount: words.length,
    clipWordsCount: clipWords.length,
    segmentsCount: segments.length,
    maxWords,
    clipStartTime,
    filterRange: { start: filterStart, end: filterEnd },
    firstClipWord: clipWords[0],
    lastClipWord: clipWords[clipWords.length - 1],
  });

  if (clipWords.length === 0) {
    console.warn('[SubtitleRenderer] No words found in clip time range');
    return frames;
  }

  if (settings.animationStyle === 'single-word') {
    // Match preview behaviour (`pickActiveSingleWordAtTime`): every word gets a frame —
    // never silently dropped — and short ASR tokens get their hit window extended to a
    // minimum readable duration, capped by the next word's start so two frames can't
    // overlap. Without this, fast tokens (articles, contractions) were exported as a
    // sub-frame flash or skipped entirely.
    const MIN_WORD_HOLD_SEC = 0.1;
    const EPS = 1e-4;
    const sorted = [...clipWords].sort(
      (a, b) => a.start - b.start || a.end - b.end
    );
    for (let i = 0; i < sorted.length; i++) {
      const word = sorted[i];
      if (word.end <= word.start) continue;
      const next = sorted[i + 1];
      const nextStart = next ? next.start : Number.POSITIVE_INFINITY;
      const extendedEnd = Math.min(
        Math.max(word.end, word.start + MIN_WORD_HOLD_SEC),
        nextStart - EPS
      );
      if (extendedEnd <= word.start) continue;

      frames.push({
        words: [word],
        startTime: word.start - clipStartTime,
        endTime: extendedEnd - clipStartTime,
        activeWordIndex: 0,
      });
    }
  } else {
    for (const segment of segments) {
      const segmentWords = clipWords.filter(
        w => w.start >= segment.start && w.end <= segment.end
      );

      if (segmentWords.length === 0) continue;

      for (let chunkStart = 0; chunkStart < segmentWords.length; chunkStart += maxWords) {
        const chunkWords = segmentWords.slice(chunkStart, chunkStart + maxWords);
        if (chunkWords.length === 0) continue;

        const chunkStartTime = chunkWords[0].start - clipStartTime;
        const chunkEndTime = chunkWords[chunkWords.length - 1].end - clipStartTime;

        if (settings.animationStyle === 'karaoke' ||
            settings.animationStyle === 'glow' ||
            settings.animationStyle === 'box-highlight') {
          for (let wordIdx = 0; wordIdx < chunkWords.length; wordIdx++) {
            const word = chunkWords[wordIdx];
            const nextWord = chunkWords[wordIdx + 1];
            // For karaoke-style highlighting, the previous word stays highlighted until the
            // next word starts; the chunk hides at its last word's end.
            const frameEnd = nextWord ? nextWord.start - clipStartTime : chunkEndTime;

            frames.push({
              words: chunkWords,
              startTime: word.start - clipStartTime,
              endTime: frameEnd,
              activeWordIndex: wordIdx,
            });
          }
        } else {
          frames.push({
            words: chunkWords,
            startTime: chunkStartTime,
            endTime: chunkEndTime,
            activeWordIndex: -1,
          });
        }
      }
    }
  }

  console.log('[SubtitleRenderer] Computed', frames.length, 'total frames (offset by clipStartTime =', clipStartTime, ')');
  return frames;
}

/**
 * Break the visible words into lines that fit in maxW (matches VideoPlayer:
 * `maxWidth` % of canvas + `flex-wrap: wrap`).
 * If a single word is wider than maxW, it occupies its own line (can extend past
 * the limit, as in a non-breaking long token).
 */
function wrapWordIndicesToLines(
  wordWidths: number[],
  maxW: number,
  wordSpacing: number
): number[][] {
  if (wordWidths.length === 0) return [];
  const lines: number[][] = [];
  let i = 0;
  while (i < wordWidths.length) {
    const line: number[] = [i];
    let lineW = wordWidths[i];
    i++;
    while (i < wordWidths.length) {
      const withGap = lineW + wordSpacing + wordWidths[i];
      if (withGap <= maxW + 1e-2) {
        line.push(i);
        lineW = withGap;
        i++;
      } else {
        break;
      }
    }
    lines.push(line);
  }
  return lines;
}

function widthOfLine(
  lineIndices: number[],
  wordWidths: number[],
  wordSpacing: number
): number {
  if (lineIndices.length === 0) return 0;
  let w = 0;
  for (let k = 0; k < lineIndices.length; k++) {
    w += wordWidths[lineIndices[k]];
    if (k < lineIndices.length - 1) w += wordSpacing;
  }
  return w;
}

/**
 * Render a single subtitle frame to a PNG blob using Canvas 2D.
 */
async function renderSubtitleFrame({
  settings,
  frame,
  canvasWidth,
  canvasHeight,
  aspectRatio,
  allWords,
}: {
  settings: SubtitleSettings;
  frame: SubtitleFrame;
  canvasWidth: number;
  canvasHeight: number;
  aspectRatio: string;
  allWords: WordInfo[];
}): Promise<{ blob: Blob; positionX: number; positionY: number } | null> {
  if (frame.words.length === 0) return null;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Match VideoPlayer.vue `finalFontSizeScale = aspectRatioScale × (containerHeight / 1080)`.
  // canvasHeight here plays the role of `containerHeight`; aspectFontScale shrinks vertical/square
  // (0.65 / 0.78) so the rendered PNG visually matches the preview after the canvas is composited
  // to the actual output frame by FFmpeg's scale2ref.
  const aspectFontScale = aspectRatioFontScaleFromString(aspectRatio);
  const scaleFactor = aspectFontScale * (canvasHeight / 1080);
  const fontSize = settings.fontSize * scaleFactor;
  // VideoPlayer.vue letter spacing: raw × (renderedFont / 48). Pre-export was `raw × scaleFactor`,
  // which gave a different gap-to-font ratio and contributed to the layout drift.
  const letterSpacing =
    fontSize > 0 ? (settings.letterSpacing || 0) * (fontSize / REFERENCE_SUBTITLE_FONT_PX) : 0;
  const wordSpacing = getSubtitleWordSpacingPx(settings.wordSpacing, fontSize);
  const wordSafetyPadding = getSubtitleWordSafetyPaddingPx(settings, fontSize, aspectRatio);

  // Set up font (already preloaded once in preRenderSubtitleOverlays)
  const font = `${settings.fontWeight} ${fontSize}px "${settings.fontFamily}", sans-serif`;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Calculate text dimensions
  const wordTexts = frame.words.map(w => 
    settings.animationStyle === 'single-word' ? w.word.toUpperCase() : w.word
  );
  
  const wordWidths: number[] = [];
  const textWidths: number[] = [];
  for (const text of wordTexts) {
    const textWidth = measureTextWithLetterSpacing(ctx, text, letterSpacing);
    textWidths.push(textWidth);
    wordWidths.push(textWidth + wordSafetyPadding * 2);
  }

  // maxWidth matches VideoPlayer `maxWidth: customSubtitleWidth + '%'`
  const maxWidthPx = (canvasWidth * (settings.maxWidth || 100)) / 100;
  const lineStepPx = getSubtitleLineHeightMultiplier(settings, aspectRatio) * fontSize;

  const wordLines = wrapWordIndicesToLines(wordWidths, maxWidthPx, wordSpacing);
  const lineWidthPx: number[] = wordLines.map((line) => widthOfLine(line, wordWidths, wordSpacing));
  const maxLineW = lineWidthPx.length ? Math.max(...lineWidthPx) : 0;
  const nLines = wordLines.length;
  // Content width: same as CSS `min(max-content, maxW)` on the text box
  const colWidthPx = Math.min(maxWidthPx, maxLineW);
  // Total block height: similar to a wrapped flex column
  const blockHeightPx = nLines > 0 ? (nLines - 1) * lineStepPx + fontSize : fontSize;
  const align = settings.textAlign || 'center';

  // Calculate position
  // Handle per-ratio position override (from ManualPOIEditor)
  // The position can be either:
  // 1. An object { x: number, y: number } with percentages from per-ratio override
  // 2. A string ('top', 'middle', 'bottom') with positionPercentage for Y
  let positionX: number;
  let positionY: number;

  if (typeof settings.position === 'object' && settings.position !== null && 'x' in settings.position) {
    positionX = (canvasWidth * settings.position.x) / 100 + (settings.textOffsetX || 0) * scaleFactor;
    positionY = (canvasHeight * settings.position.y) / 100 + (settings.textOffsetY || 0) * scaleFactor;
    console.log('[SubtitleRenderer] Using position object:', {
      positionObj: settings.position,
      calculatedX: positionX,
      calculatedY: positionY,
    });
  } else {
    positionX = canvasWidth / 2 + (settings.textOffsetX || 0) * scaleFactor;
    console.log('[SubtitleRenderer] Using default position (centered X, positionPercentage for Y):', {
      positionPercentage: settings.positionPercentage,
      calculatedX: positionX,
    });
    positionY = (canvasHeight * settings.positionPercentage) / 100 + (settings.textOffsetY || 0) * scaleFactor;
  }

  // Keep the text block in frame (after line wrap, not single-line width)
  const halfTextWidth = colWidthPx / 2;
  const edgePadding = 5 * scaleFactor;
  const minX = halfTextWidth + edgePadding;
  const maxX = canvasWidth - halfTextWidth - edgePadding;
  if (maxX > minX) {
    if (positionX < minX) {
      positionX = minX;
    } else if (positionX > maxX) {
      positionX = maxX;
    }
  } else {
    positionX = canvasWidth / 2;
  }

  const halfTextHeight = blockHeightPx / 2;
  const minY = halfTextHeight + edgePadding;
  const maxY = canvasHeight - halfTextHeight - edgePadding;
  if (maxY > minY) {
    if (positionY < minY) {
      positionY = minY;
    } else if (positionY > maxY) {
      positionY = maxY;
    }
  }

  // Per-line Y (text vertical center per line) — same anchor as the flex preview block
  function lineY(lineIndex: number): number {
    if (nLines <= 0) return positionY;
    const t = lineIndex - (nLines - 1) / 2;
    return positionY + t * lineStepPx;
  }

  // Draw background if enabled (encompass all wrapped lines)
  if (settings.backgroundEnabled && settings.backgroundColor && settings.backgroundColor !== 'transparent') {
    const bgPadding = settings.padding * scaleFactor;
    const bgWidth = colWidthPx + bgPadding * 2;
    const bgHeight = blockHeightPx + bgPadding * 2;
    const bgX = positionX - bgWidth / 2;
    const bgY = positionY - bgHeight / 2;
    ctx.fillStyle = settings.backgroundColor;
    roundRect(ctx, bgX, bgY, bgWidth, bgHeight, settings.borderRadius * scaleFactor);
    ctx.fill();
  }

  function lineStartX(lineW: number): number {
    if (align === 'left') {
      return positionX - maxWidthPx / 2;
    }
    if (align === 'right') {
      return positionX + maxWidthPx / 2 - lineW;
    }
    return positionX - lineW / 2;
  }

  for (let li = 0; li < wordLines.length; li++) {
    const indices = wordLines[li];
    const lineW = lineWidthPx[li] ?? 0;
    let currentX = lineStartX(lineW);
    const y = lineY(li);

    for (const i of indices) {
      const word = frame.words[i]!;
      const text = wordTexts[i]!;
      const wordWidth = wordWidths[i]!;
      const textWidth = textWidths[i]!;
      const isActive = i === frame.activeWordIndex;
      const wordCenterX = currentX + wordWidth / 2;

      let fillColor = settings.textColor;
      if (settings.animationStyle === 'single-word' && settings.multiColorEnabled) {
        const globalIndex = allWords.findIndex(
          (w) => w.start === word.start && w.word === word.word
        );
        fillColor = getWordColor(settings, globalIndex);
      } else if (isActive && (settings.animationStyle === 'karaoke' || settings.animationStyle === 'glow')) {
        fillColor = settings.highlightColor || DEFAULT_SUBTITLE_HIGHLIGHT;
      }

      if (settings.shadowBlur > 0 || settings.shadowOffsetX !== 0 || settings.shadowOffsetY !== 0) {
        ctx.shadowColor = settings.shadowColor || '#000000';
        ctx.shadowBlur = settings.shadowBlur * scaleFactor;
        ctx.shadowOffsetX = settings.shadowOffsetX * scaleFactor;
        ctx.shadowOffsetY = settings.shadowOffsetY * scaleFactor;
      }

      if (isActive && settings.animationStyle === 'box-highlight') {
        ctx.save();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.fillStyle = settings.highlightColor || DEFAULT_SUBTITLE_HIGHLIGHT;
        ctx.globalAlpha = 0.3;
        const boxPad = 4 * scaleFactor;
        roundRect(
          ctx,
          wordCenterX - textWidth / 2 - boxPad,
          y - fontSize / 2 - boxPad / 2,
          textWidth + boxPad * 2,
          fontSize + boxPad,
          4 * scaleFactor
        );
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      if (isActive && settings.animationStyle === 'glow') {
        ctx.save();
        ctx.shadowColor = settings.highlightColor || DEFAULT_SUBTITLE_HIGHLIGHT;
        ctx.shadowBlur = 20 * scaleFactor;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        drawTextWithLetterSpacing(ctx, text, wordCenterX, y, letterSpacing, fillColor);
        ctx.restore();
      }

      if (settings.border2Width > 0) {
        ctx.save();
        ctx.strokeStyle = settings.border2Color || '#FF0000';
        ctx.lineWidth = (settings.border1Width + settings.border2Width) * 2 * scaleFactor;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        strokeTextWithLetterSpacing(ctx, text, wordCenterX, y, letterSpacing);
        ctx.restore();
      }

      if (settings.border1Width > 0) {
        ctx.save();
        ctx.strokeStyle = settings.border1Color || '#000000';
        ctx.lineWidth = settings.border1Width * 2 * scaleFactor;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        strokeTextWithLetterSpacing(ctx, text, wordCenterX, y, letterSpacing);
        ctx.restore();
      }

      ctx.save();
      if (settings.border1Width <= 0 && settings.border2Width <= 0) {
        ctx.shadowColor = settings.shadowColor || '#000000';
        ctx.shadowBlur = settings.shadowBlur * scaleFactor;
        ctx.shadowOffsetX = settings.shadowOffsetX * scaleFactor;
        ctx.shadowOffsetY = settings.shadowOffsetY * scaleFactor;
      } else {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }
      drawTextWithLetterSpacing(ctx, text, wordCenterX, y, letterSpacing, fillColor);
      ctx.restore();

      currentX += wordWidth + wordSpacing;
    }
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) {
        resolve(result);
      } else {
        reject(new Error('Failed to convert subtitle canvas to PNG blob'));
      }
    }, 'image/png');
  });
  return { blob, positionX, positionY };
}

/**
 * Measure text width accounting for letter spacing.
 */
function measureTextWithLetterSpacing(
  ctx: CanvasRenderingContext2D,
  text: string,
  letterSpacing: number
): number {
  const baseWidth = ctx.measureText(text).width;
  return baseWidth + letterSpacing * (text.length - 1);
}

/**
 * Draw text with letter spacing.
 */
function drawTextWithLetterSpacing(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  letterSpacing: number,
  fillColor: string
): void {
  ctx.fillStyle = fillColor;
  
  if (letterSpacing === 0) {
    ctx.fillText(text, centerX, y);
    return;
  }

  const totalWidth = measureTextWithLetterSpacing(ctx, text, letterSpacing);
  let x = centerX - totalWidth / 2;
  
  for (const char of text) {
    const charWidth = ctx.measureText(char).width;
    ctx.fillText(char, x + charWidth / 2, y);
    x += charWidth + letterSpacing;
  }
}

/**
 * Stroke text with letter spacing.
 */
function strokeTextWithLetterSpacing(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  letterSpacing: number
): void {
  if (letterSpacing === 0) {
    ctx.strokeText(text, centerX, y);
    return;
  }

  const totalWidth = measureTextWithLetterSpacing(ctx, text, letterSpacing);
  let x = centerX - totalWidth / 2;
  
  for (const char of text) {
    const charWidth = ctx.measureText(char).width;
    ctx.strokeText(char, x + charWidth / 2, y);
    x += charWidth + letterSpacing;
  }
}

/**
 * Get color for a word based on multi-color settings.
 */
function getWordColor(settings: SubtitleSettings, wordIndex: number): string {
  if (!settings.multiColorEnabled) {
    return settings.textColor || '#FFFFFF';
  }
  
  if (settings.multiColorMode === 'custom' && settings.colorPalette && settings.colorPalette.length > 0) {
    return settings.colorPalette[wordIndex % settings.colorPalette.length];
  }
  
  return DEFAULT_COLOR_PALETTE[wordIndex % DEFAULT_COLOR_PALETTE.length];
}

/**
 * Draw a rounded rectangle path.
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
