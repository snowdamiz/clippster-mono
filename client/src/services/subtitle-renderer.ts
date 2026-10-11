import { invoke } from '@tauri-apps/api/core';
import { computeSubtitleFrames, renderSubtitleFrame, aspectRatioFontScaleFromString, ensureFontLoaded } from '../../../packages/clip-export/src/subtitleRaster';
import type { SubtitleSettings, WordInfo, SubtitleOverlay } from '../../../packages/clip-export/src/subtitleRaster';
export type { SubtitleSettings, WordInfo, SubtitleOverlay } from '../../../packages/clip-export/src/subtitleRaster';

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
