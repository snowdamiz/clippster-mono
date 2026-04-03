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
}: {
  settings: SubtitleSettings;
  words: WordInfo[];
  segments: { start: number; end: number; transcript: string }[];
  maxWords: number;
  canvasWidth: number;
  canvasHeight: number;
  aspectRatio: string;
  introOffset?: number;
}): Promise<SubtitleOverlay[]> {
  if (!settings.enabled || words.length === 0) {
    return [];
  }

  const overlays: SubtitleOverlay[] = [];
  const frames = computeSubtitleFrames(settings, words, segments, maxWords);

  console.log(`[SubtitleRenderer] Pre-rendering ${frames.length} subtitle frames for ${aspectRatio}`, {
    position: settings.position,
    positionPercentage: settings.positionPercentage,
    maxWidth: settings.maxWidth,
    fontSize: settings.fontSize,
    animationStyle: settings.animationStyle,
    highlightColor: settings.highlightColor,
  });

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    
    try {
      const result = await renderSubtitleFrame({
        settings,
        frame,
        canvasWidth,
        canvasHeight,
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

  console.log(`[SubtitleRenderer] Successfully pre-rendered ${overlays.length}/${frames.length} frames`);
  return overlays;
}

/**
 * Compute the subtitle frames (which words to show and when) based on segments and animation style.
 */
function computeSubtitleFrames(
  settings: SubtitleSettings,
  words: WordInfo[],
  segments: { start: number; end: number; transcript: string }[],
  maxWords: number
): SubtitleFrame[] {
  const frames: SubtitleFrame[] = [];

  // Calculate the overall clip time range from segments
  const clipStart = Math.min(...segments.map(s => s.start));
  const clipEnd = Math.max(...segments.map(s => s.end));
  
  // Filter words to only those within the clip's time range
  const clipWords = words.filter(w => w.start >= clipStart && w.end <= clipEnd);
  
  console.log('[SubtitleRenderer] computeSubtitleFrames called with:', {
    animationStyle: settings.animationStyle,
    totalWordsCount: words.length,
    clipWordsCount: clipWords.length,
    segmentsCount: segments.length,
    maxWords,
    clipTimeRange: { start: clipStart, end: clipEnd },
    firstClipWord: clipWords[0],
    lastClipWord: clipWords[clipWords.length - 1],
  });

  if (clipWords.length === 0) {
    console.warn('[SubtitleRenderer] No words found in clip time range');
    return frames;
  }

  if (settings.animationStyle === 'single-word') {
    // Single word mode: one frame per word
    for (let i = 0; i < clipWords.length; i++) {
      const word = clipWords[i];
      if (word.end - word.start < 0.05) continue; // Skip very short words
      
      // Adjust timing relative to clip start
      frames.push({
        words: [word],
        startTime: word.start - clipStart,
        endTime: word.end - clipStart,
        activeWordIndex: 0,
      });
    }
  } else {
    // Chunked display: group words by segments and chunks
    for (const segment of segments) {
      console.log('[SubtitleRenderer] Processing segment:', segment);
      const segmentWords = clipWords.filter(
        w => w.start >= segment.start && w.end <= segment.end
      );
      console.log('[SubtitleRenderer] Found', segmentWords.length, 'words in segment range', segment.start, '-', segment.end);

      if (segmentWords.length === 0) continue;

      // Split into chunks of maxWords
      for (let chunkStart = 0; chunkStart < segmentWords.length; chunkStart += maxWords) {
        const chunkWords = segmentWords.slice(chunkStart, chunkStart + maxWords);
        if (chunkWords.length === 0) continue;

        const chunkStartTime = chunkWords[0].start - clipStart;
        const chunkEndTime = chunkWords[chunkWords.length - 1].end - clipStart;

        // For karaoke and other word-highlighting styles, create a frame for each word
        if (settings.animationStyle === 'karaoke' || 
            settings.animationStyle === 'glow' || 
            settings.animationStyle === 'box-highlight') {
          for (let wordIdx = 0; wordIdx < chunkWords.length; wordIdx++) {
            const word = chunkWords[wordIdx];
            const nextWord = chunkWords[wordIdx + 1];
            const frameEnd = nextWord ? nextWord.start - clipStart : chunkEndTime;

            frames.push({
              words: chunkWords,
              startTime: word.start - clipStart,
              endTime: frameEnd,
              activeWordIndex: wordIdx,
            });
          }
        } else {
          // For non-highlighting styles, one frame per chunk
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

  console.log('[SubtitleRenderer] Computed', frames.length, 'total frames');
  return frames;
}

/**
 * Render a single subtitle frame to a PNG blob using Canvas 2D.
 */
async function renderSubtitleFrame({
  settings,
  frame,
  canvasWidth,
  canvasHeight,
  allWords,
}: {
  settings: SubtitleSettings;
  frame: SubtitleFrame;
  canvasWidth: number;
  canvasHeight: number;
  allWords: WordInfo[];
}): Promise<{ blob: Blob; positionX: number; positionY: number } | null> {
  if (frame.words.length === 0) return null;

  const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Calculate scale factor (based on 1080p reference)
  const scaleFactor = canvasHeight / 1080;
  const fontSize = settings.fontSize * scaleFactor;
  const letterSpacing = settings.letterSpacing * scaleFactor;
  const wordSpacing = (settings.wordSpacing || 0.35) * fontSize;

  // Set up font
  const font = `${settings.fontWeight} ${fontSize}px "${settings.fontFamily}", sans-serif`;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Calculate text dimensions
  const wordTexts = frame.words.map(w => 
    settings.animationStyle === 'single-word' ? w.word.toUpperCase() : w.word
  );
  
  let totalWidth = 0;
  const wordWidths: number[] = [];
  for (const text of wordTexts) {
    const width = measureTextWithLetterSpacing(ctx, text, letterSpacing);
    wordWidths.push(width);
    totalWidth += width;
  }
  totalWidth += wordSpacing * (wordTexts.length - 1);

  // Calculate position
  // Handle per-ratio position override (from ManualPOIEditor)
  // The position can be either:
  // 1. An object { x: number, y: number } with percentages from per-ratio override
  // 2. A string ('top', 'middle', 'bottom') with positionPercentage for Y
  const maxWidthPx = (canvasWidth * settings.maxWidth) / 100;
  const actualWidth = Math.min(totalWidth, maxWidthPx);
  
  let positionX: number;
  let positionY: number;
  
  if (typeof settings.position === 'object' && settings.position !== null && 'x' in settings.position) {
    // Per-ratio override with explicit x,y percentages
    positionX = (canvasWidth * settings.position.x) / 100 + (settings.textOffsetX || 0) * scaleFactor;
    positionY = (canvasHeight * settings.position.y) / 100 + (settings.textOffsetY || 0) * scaleFactor;
    console.log('[SubtitleRenderer] Using position object:', {
      positionObj: settings.position,
      calculatedX: positionX,
      calculatedY: positionY,
    });
  } else {
    // Default centered X with positionPercentage for Y
    positionX = canvasWidth / 2 + (settings.textOffsetX || 0) * scaleFactor;
    console.log('[SubtitleRenderer] Using default position (centered X, positionPercentage for Y):', {
      positionPercentage: settings.positionPercentage,
      calculatedX: positionX,
    });
    positionY = (canvasHeight * settings.positionPercentage) / 100 + (settings.textOffsetY || 0) * scaleFactor;
  }

  // Clamp position to ensure text stays within canvas bounds
  // The text is centered at positionX, so we need padding of half the text width on each side
  const halfTextWidth = totalWidth / 2;
  const edgePadding = 5 * scaleFactor; // Small padding from edge
  
  // Calculate bounds - ensure text doesn't extend past canvas edges
  const minX = halfTextWidth + edgePadding;
  const maxX = canvasWidth - halfTextWidth - edgePadding;
  
  // Only clamp if valid bounds exist (text fits in canvas)
  if (maxX > minX) {
    if (positionX < minX) {
      console.log('[SubtitleRenderer] Clamping X from', positionX, 'to', minX, '(text would extend past left edge)');
      positionX = minX;
    } else if (positionX > maxX) {
      console.log('[SubtitleRenderer] Clamping X from', positionX, 'to', maxX, '(text would extend past right edge)');
      positionX = maxX;
    }
  } else {
    // Text is wider than canvas - center it
    console.log('[SubtitleRenderer] Text wider than canvas, centering. totalWidth:', totalWidth, 'canvasWidth:', canvasWidth);
    positionX = canvasWidth / 2;
  }
  
  // Also clamp Y position
  const halfTextHeight = fontSize / 2;
  const minY = halfTextHeight + edgePadding;
  const maxY = canvasHeight - halfTextHeight - edgePadding;
  
  if (maxY > minY) {
    if (positionY < minY) {
      console.log('[SubtitleRenderer] Clamping Y from', positionY, 'to', minY);
      positionY = minY;
    } else if (positionY > maxY) {
      console.log('[SubtitleRenderer] Clamping Y from', positionY, 'to', maxY);
      positionY = maxY;
    }
  }

  // Draw background if enabled
  if (settings.backgroundEnabled && settings.backgroundColor && settings.backgroundColor !== 'transparent') {
    const bgPadding = settings.padding * scaleFactor;
    const bgWidth = actualWidth + bgPadding * 2;
    const bgHeight = fontSize * settings.lineHeight + bgPadding * 2;
    const bgX = positionX - bgWidth / 2;
    const bgY = positionY - bgHeight / 2;
    
    ctx.fillStyle = settings.backgroundColor;
    roundRect(ctx, bgX, bgY, bgWidth, bgHeight, settings.borderRadius * scaleFactor);
    ctx.fill();
  }

  // Draw each word
  let currentX = positionX - totalWidth / 2;
  
  for (let i = 0; i < frame.words.length; i++) {
    const word = frame.words[i];
    const text = wordTexts[i];
    const wordWidth = wordWidths[i];
    const isActive = i === frame.activeWordIndex;
    const wordCenterX = currentX + wordWidth / 2;

    // Get color for this word
    let fillColor = settings.textColor;
    if (settings.animationStyle === 'single-word' && settings.multiColorEnabled) {
      const globalIndex = allWords.findIndex(w => w.start === word.start && w.word === word.word);
      fillColor = getWordColor(settings, globalIndex);
    } else if (isActive && (settings.animationStyle === 'karaoke' || settings.animationStyle === 'glow')) {
      fillColor = settings.highlightColor || DEFAULT_SUBTITLE_HIGHLIGHT;
    }

    // Apply shadow
    if (settings.shadowBlur > 0 || settings.shadowOffsetX !== 0 || settings.shadowOffsetY !== 0) {
      ctx.shadowColor = settings.shadowColor || '#000000';
      ctx.shadowBlur = settings.shadowBlur * scaleFactor;
      ctx.shadowOffsetX = settings.shadowOffsetX * scaleFactor;
      ctx.shadowOffsetY = settings.shadowOffsetY * scaleFactor;
    }

    // Draw box highlight background
    if (isActive && settings.animationStyle === 'box-highlight') {
      ctx.save();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.fillStyle = settings.highlightColor || DEFAULT_SUBTITLE_HIGHLIGHT;
      ctx.globalAlpha = 0.3;
      const boxPadding = 4 * scaleFactor;
      roundRect(
        ctx,
        wordCenterX - wordWidth / 2 - boxPadding,
        positionY - fontSize / 2 - boxPadding / 2,
        wordWidth + boxPadding * 2,
        fontSize + boxPadding,
        4 * scaleFactor
      );
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // Draw glow effect
    if (isActive && settings.animationStyle === 'glow') {
      ctx.save();
      ctx.shadowColor = settings.highlightColor || DEFAULT_SUBTITLE_HIGHLIGHT;
      ctx.shadowBlur = 20 * scaleFactor;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      drawTextWithLetterSpacing(ctx, text, wordCenterX, positionY, letterSpacing, fillColor);
      ctx.restore();
    }

    // Draw border 2 (outer)
    if (settings.border2Width > 0) {
      ctx.save();
      ctx.strokeStyle = settings.border2Color || '#FF0000';
      ctx.lineWidth = (settings.border1Width + settings.border2Width) * 2 * scaleFactor;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      strokeTextWithLetterSpacing(ctx, text, wordCenterX, positionY, letterSpacing);
      ctx.restore();
    }

    // Draw border 1 (inner)
    if (settings.border1Width > 0) {
      ctx.save();
      ctx.strokeStyle = settings.border1Color || '#000000';
      ctx.lineWidth = settings.border1Width * 2 * scaleFactor;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      strokeTextWithLetterSpacing(ctx, text, wordCenterX, positionY, letterSpacing);
      ctx.restore();
    }

    // Draw fill text
    ctx.save();
    if (settings.border1Width <= 0 && settings.border2Width <= 0) {
      // Apply shadow to fill if no borders
      ctx.shadowColor = settings.shadowColor || '#000000';
      ctx.shadowBlur = settings.shadowBlur * scaleFactor;
      ctx.shadowOffsetX = settings.shadowOffsetX * scaleFactor;
      ctx.shadowOffsetY = settings.shadowOffsetY * scaleFactor;
    } else {
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }
    drawTextWithLetterSpacing(ctx, text, wordCenterX, positionY, letterSpacing, fillColor);
    ctx.restore();

    currentX += wordWidth + wordSpacing;
  }

  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return { blob, positionX, positionY };
}

/**
 * Measure text width accounting for letter spacing.
 */
function measureTextWithLetterSpacing(
  ctx: OffscreenCanvasRenderingContext2D,
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
  ctx: OffscreenCanvasRenderingContext2D,
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
  ctx: OffscreenCanvasRenderingContext2D,
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
  ctx: OffscreenCanvasRenderingContext2D,
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
