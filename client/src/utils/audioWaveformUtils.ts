/**
 * Audio Waveform Utilities
 * 
 * @deprecated This module is deprecated. Use the new waveformRenderer instead:
 * ```typescript
 * import { renderWaveform, renderAudioTrackWaveform, createThrottledRenderer } from '@/utils/waveformRenderer';
 * ```
 * 
 * This file is kept for backwards compatibility and re-exports from the new renderer.
 */

// Re-export everything from the new renderer for backwards compatibility
export {
  renderWaveform,
  renderAudioTrackWaveform,
  renderWaveformWithPlayhead,
  createThrottledRenderer,
  WAVEFORM_COLORS,
  AMPLITUDE_THRESHOLDS,
  type WaveformRenderOptions,
} from '@/utils/waveformRenderer';

// Re-export types from waveformService
export type { WaveformPeak } from '@/services/waveformService';

// Legacy interface - kept for compatibility
export interface WaveformRenderContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

// Legacy default options
export const DEFAULT_WAVEFORM_OPTIONS = {
  barWidth: 1,
  barSpacing: 1,
  color: '#5eead4',
  backgroundColor: 'transparent',
  opacity: 0.8,
  style: 'bars' as const,
  amplitude: 1.0,
};

/**
 * @deprecated Use renderWaveform from '@/utils/waveformRenderer' instead
 */
export function getWaveformRenderContext(canvas: HTMLCanvasElement): WaveformRenderContext {
  console.warn('[audioWaveformUtils] getWaveformRenderContext is deprecated.');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D rendering context from canvas');
  }
  return { canvas, ctx };
}

/**
 * @deprecated Use renderWaveform from '@/utils/waveformRenderer' instead
 */
export function clearCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  backgroundColor: string = 'transparent'
): void {
  console.warn('[audioWaveformUtils] clearCanvas is deprecated.');
  if (backgroundColor === 'transparent') {
    ctx.clearRect(0, 0, width, height);
  } else {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
  }
}

/**
 * @deprecated Use waveformService.calculatePeaks or getPeaksForRange instead
 */
export function calculateWaveformParameters(
  duration: number,
  width: number,
  zoomLevel: number,
  resolution?: string,
  peakCount?: number
): {
  barWidth: number;
  barSpacing: number;
  samplesPerPixel: number;
  resolution: string;
} {
  console.warn('[audioWaveformUtils] calculateWaveformParameters is deprecated.');
  
  const effectiveWidth = width * zoomLevel;
  const selectedPeakCount = peakCount || Math.min(16000, Math.floor(effectiveWidth));
  const selectedResolution = resolution || 'high';
  
  return {
    barWidth: 1,
    barSpacing: 1,
    samplesPerPixel: (duration * 44100) / effectiveWidth,
    resolution: selectedResolution,
  };
}

/**
 * @deprecated Peaks are now calculated on-demand by waveformService
 */
export function downsamplePeaks(
  sourcePeaks: { min: number; max: number }[],
  targetCount: number
): { min: number; max: number }[] {
  console.warn('[audioWaveformUtils] downsamplePeaks is deprecated. Use waveformService.getPeaksForRange instead.');
  
  if (sourcePeaks.length <= targetCount || targetCount <= 0) {
    return sourcePeaks;
  }

  const ratio = sourcePeaks.length / targetCount;
  const result: { min: number; max: number }[] = [];

  for (let i = 0; i < targetCount; i++) {
    const startIdx = Math.floor(i * ratio);
    const endIdx = Math.floor((i + 1) * ratio);

    let min = 0;
    let max = 0;
    for (let j = startIdx; j < endIdx && j < sourcePeaks.length; j++) {
      min = Math.min(min, sourcePeaks[j].min);
      max = Math.max(max, sourcePeaks[j].max);
    }
    result.push({ min, max });
  }

  return result;
}

/**
 * @deprecated Not needed with on-demand peak calculation
 */
export function interpolateWaveform(
  sourcePeaks: { min: number; max: number }[],
  targetCount: number
): { min: number; max: number }[] {
  console.warn('[audioWaveformUtils] interpolateWaveform is deprecated.');
  
  if (sourcePeaks.length >= targetCount || targetCount <= 0) {
    return sourcePeaks;
  }

  const ratio = sourcePeaks.length / targetCount;
  const interpolated: { min: number; max: number }[] = [];

  for (let i = 0; i < targetCount; i++) {
    const sourceIndex = Math.floor(i * ratio);
    const nextIndex = Math.min(sourceIndex + 1, sourcePeaks.length - 1);
    const fraction = i * ratio - sourceIndex;

    const current = sourcePeaks[sourceIndex];
    const next = sourcePeaks[nextIndex];

    interpolated.push({
      min: current.min + (next.min - current.min) * fraction,
      max: current.max + (next.max - current.max) * fraction,
    });
  }

  return interpolated;
}

// Legacy render functions - redirect to new renderer
export { renderWaveform as renderWaveformBars } from '@/utils/waveformRenderer';
export { renderWaveform as renderWaveformDbBars } from '@/utils/waveformRenderer';
export { renderWaveform as renderWaveformLine } from '@/utils/waveformRenderer';
export { renderWaveform as renderWaveformFilled } from '@/utils/waveformRenderer';
export { renderWaveform as renderWaveformOnCanvas } from '@/utils/waveformRenderer';
