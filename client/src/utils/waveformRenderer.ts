/**
 * Waveform Renderer - Single unified canvas rendering function
 *
 * Renders audio waveforms with:
 * - Min/max peak display (accurate audio envelope)
 * - 1px bar width for maximum detail
 * - CapCut-style coloring (teal base, yellow/red for loud sections)
 * - Playhead-aware coloring (different colors before/after playhead)
 */

import type { WaveformPeak } from '@/services/waveformService';

// ============================================================================
// Color Configuration
// ============================================================================

export const WAVEFORM_COLORS = {
  // Base waveform color (matches app accent cyan)
  BASE: '#0ea5e9',
  // Played portion (same cyan as base)
  PLAYED: '#0ea5e9',
  // Loud level indicators
  YELLOW: '#facc15',
  ORANGE: '#fb923c',
  RED: '#f87171',
  // Silence/very quiet
  SILENCE: '#4b5563',
} as const;

// Amplitude thresholds for color transitions
export const AMPLITUDE_THRESHOLDS = {
  YELLOW: 0.5, // 50% amplitude - start showing yellow at top
  ORANGE: 0.75, // 75% amplitude - start showing orange at top
  RED: 0.9, // 90% amplitude - start showing red at top
} as const;

// ============================================================================
// Render Options
// ============================================================================

export interface WaveformRenderOptions {
  // Canvas dimensions
  width: number;
  height: number;

  // Waveform data
  peaks: WaveformPeak[];

  // Bar styling (default: 1px bars, 1px gap for maximum detail)
  barWidth?: number;
  barGap?: number;

  // Amplitude scaling (0-1)
  amplitude?: number;

  // Playhead position for dual-color rendering (0-1 ratio, optional)
  playheadRatio?: number;

  // Color configuration
  baseColor?: string;
  playedColor?: string;

  // Render style
  style?: 'bars' | 'mirror' | 'line';

  // Whether to use gradient coloring for loud sections
  useGradientColors?: boolean;

  // Baseline position (0 = top, 0.5 = center, 1 = bottom)
  baseline?: number;

  // Opacity for dimming (0-1, default 1)
  opacity?: number;
}

// ============================================================================
// Main Render Function
// ============================================================================

/**
 * Render waveform peaks to a canvas
 * This is the single unified rendering function for all waveform displays
 */
export function renderWaveform(canvas: HTMLCanvasElement, options: WaveformRenderOptions): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('[WaveformRenderer] Failed to get 2D context');
    return;
  }

  const {
    width,
    height,
    peaks,
    barWidth = 1,
    barGap = 1,
    amplitude = 0.9,
    playheadRatio,
    baseColor = WAVEFORM_COLORS.BASE,
    playedColor = WAVEFORM_COLORS.PLAYED,
    style = 'bars',
    useGradientColors = true,
    baseline = 1, // Default: bars grow upward from bottom
    opacity = 1,
  } = options;

  // Handle device pixel ratio for sharp rendering
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Apply opacity if specified
  ctx.globalAlpha = opacity;

  if (peaks.length === 0) {
    return;
  }

  // Calculate rendering parameters
  const totalBarWidth = barWidth + barGap;
  const maxBarHeight = height * amplitude;
  const baselineY = height * baseline;
  const playheadPixel = playheadRatio !== undefined ? playheadRatio * width : undefined;

  // Render based on style
  switch (style) {
    case 'mirror':
      renderMirrorStyle(ctx, {
        peaks,
        width,
        height,
        totalBarWidth,
        barWidth,
        maxBarHeight,
        playheadPixel,
        baseColor,
        playedColor,
        useGradientColors,
      });
      break;
    case 'line':
      renderLineStyle(ctx, {
        peaks,
        width,
        height,
        maxBarHeight,
        playheadPixel,
        baseColor,
        playedColor,
      });
      break;
    case 'bars':
    default:
      renderBarsStyle(ctx, {
        peaks,
        width,
        totalBarWidth,
        barWidth,
        maxBarHeight,
        baselineY,
        playheadPixel,
        baseColor,
        playedColor,
        useGradientColors,
      });
      break;
  }

  // Reset globalAlpha
  ctx.globalAlpha = 1;
}

// ============================================================================
// Bar Style Rendering (Default - CapCut style)
// ============================================================================

interface BarsRenderParams {
  peaks: WaveformPeak[];
  width: number;
  totalBarWidth: number;
  barWidth: number;
  maxBarHeight: number;
  baselineY: number;
  playheadPixel?: number;
  baseColor: string;
  playedColor: string;
  useGradientColors: boolean;
}

function renderBarsStyle(ctx: CanvasRenderingContext2D, params: BarsRenderParams): void {
  const {
    peaks,
    width,
    barWidth,
    maxBarHeight,
    baselineY,
    playheadPixel,
    baseColor,
    playedColor,
    useGradientColors,
  } = params;

  if (peaks.length === 0) return;

  // Calculate step size to distribute all peaks evenly across canvas width
  const step = width / peaks.length;
  // Use the smaller of requested barWidth or step size (minus 1px gap) to avoid overlapping
  const actualBarWidth = Math.max(1, Math.min(barWidth, step - 1));

  for (let i = 0; i < peaks.length; i++) {
    const x = i * step;

    const peak = peaks[i];
    const magnitude = Math.max(Math.abs(peak.min), Math.abs(peak.max));
    const barHeight = Math.max(1, magnitude * maxBarHeight);

    // Determine color based on playhead position
    const barCenter = x + actualBarWidth / 2;
    const isBeforePlayhead = playheadPixel !== undefined && barCenter < playheadPixel;

    // Get fill color/style
    const fillStyle = getFillStyle(
      ctx,
      x,
      baselineY,
      barHeight,
      magnitude,
      isBeforePlayhead ? playedColor : baseColor,
      useGradientColors
    );

    ctx.fillStyle = fillStyle;
    ctx.fillRect(x, baselineY - barHeight, actualBarWidth, barHeight);
  }
}

// ============================================================================
// Mirror Style Rendering (Traditional waveform)
// ============================================================================

interface MirrorRenderParams {
  peaks: WaveformPeak[];
  width: number;
  height: number;
  totalBarWidth: number;
  barWidth: number;
  maxBarHeight: number;
  playheadPixel?: number;
  baseColor: string;
  playedColor: string;
  useGradientColors: boolean;
}

function renderMirrorStyle(ctx: CanvasRenderingContext2D, params: MirrorRenderParams): void {
  const {
    peaks,
    width,
    height,
    barWidth,
    maxBarHeight,
    playheadPixel,
    baseColor,
    playedColor,
    useGradientColors,
  } = params;

  if (peaks.length === 0) return;

  const centerY = height / 2;
  const halfMaxHeight = maxBarHeight / 2;

  // Calculate step size to distribute all peaks evenly across canvas width
  const step = width / peaks.length;
  // Use the smaller of requested barWidth or step size (minus 1px gap) to avoid overlapping
  const actualBarWidth = Math.max(1, Math.min(barWidth, step - 1));

  for (let i = 0; i < peaks.length; i++) {
    const x = i * step;

    const peak = peaks[i];
    const positiveHeight = Math.abs(peak.max) * halfMaxHeight;
    const negativeHeight = Math.abs(peak.min) * halfMaxHeight;
    const magnitude = Math.max(Math.abs(peak.min), Math.abs(peak.max));

    // Determine color based on playhead position
    const barCenter = x + actualBarWidth / 2;
    const isBeforePlayhead = playheadPixel !== undefined && barCenter < playheadPixel;
    const color = isBeforePlayhead ? playedColor : baseColor;

    // Draw upper bar (positive values)
    if (positiveHeight > 0) {
      const fillStyle = getFillStyle(
        ctx,
        x,
        centerY - positiveHeight,
        positiveHeight,
        magnitude,
        color,
        useGradientColors
      );
      ctx.fillStyle = fillStyle;
      ctx.fillRect(x, centerY - positiveHeight, actualBarWidth, positiveHeight);
    }

    // Draw lower bar (negative values)
    if (negativeHeight > 0) {
      const fillStyle = getFillStyle(
        ctx,
        x,
        centerY,
        negativeHeight,
        magnitude,
        color,
        useGradientColors
      );
      ctx.fillStyle = fillStyle;
      ctx.fillRect(x, centerY, actualBarWidth, negativeHeight);
    }
  }
}

// ============================================================================
// Line Style Rendering
// ============================================================================

interface LineRenderParams {
  peaks: WaveformPeak[];
  width: number;
  height: number;
  maxBarHeight: number;
  playheadPixel?: number;
  baseColor: string;
  playedColor: string;
}

function renderLineStyle(ctx: CanvasRenderingContext2D, params: LineRenderParams): void {
  const { peaks, width, height, maxBarHeight, playheadPixel, baseColor, playedColor } = params;

  const centerY = height / 2;
  const halfMaxHeight = maxBarHeight / 2;
  const step = width / peaks.length;

  // Draw filled waveform
  ctx.beginPath();
  ctx.moveTo(0, centerY);

  // Upper waveform (positive values)
  for (let i = 0; i < peaks.length; i++) {
    const x = i * step;
    const y = centerY - Math.abs(peaks[i].max) * halfMaxHeight;
    ctx.lineTo(x, y);
  }

  // Lower waveform (negative values) in reverse
  for (let i = peaks.length - 1; i >= 0; i--) {
    const x = i * step;
    const y = centerY + Math.abs(peaks[i].min) * halfMaxHeight;
    ctx.lineTo(x, y);
  }

  ctx.closePath();

  // Fill with gradient if playhead is defined
  if (playheadPixel !== undefined) {
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    const playheadRatio = playheadPixel / width;
    gradient.addColorStop(0, playedColor);
    gradient.addColorStop(Math.max(0, playheadRatio - 0.001), playedColor);
    gradient.addColorStop(playheadRatio, baseColor);
    gradient.addColorStop(1, baseColor);
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = baseColor;
  }

  ctx.globalAlpha = 0.7;
  ctx.fill();
  ctx.globalAlpha = 1.0;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get fill style for a bar based on magnitude and configuration
 */
function getFillStyle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  height: number,
  magnitude: number,
  baseColor: string,
  useGradient: boolean
): string | CanvasGradient {
  if (!useGradient || magnitude < AMPLITUDE_THRESHOLDS.YELLOW) {
    return baseColor;
  }

  // Create gradient for loud sections
  const gradient = ctx.createLinearGradient(x, y + height, x, y);
  gradient.addColorStop(0, baseColor);

  if (magnitude >= AMPLITUDE_THRESHOLDS.RED) {
    // Very loud: base -> yellow -> orange -> red at top
    gradient.addColorStop(0.5, baseColor);
    gradient.addColorStop(0.7, WAVEFORM_COLORS.YELLOW);
    gradient.addColorStop(0.85, WAVEFORM_COLORS.ORANGE);
    gradient.addColorStop(1, WAVEFORM_COLORS.RED);
  } else if (magnitude >= AMPLITUDE_THRESHOLDS.ORANGE) {
    // Loud: base -> yellow -> orange at top
    gradient.addColorStop(0.6, baseColor);
    gradient.addColorStop(0.8, WAVEFORM_COLORS.YELLOW);
    gradient.addColorStop(1, WAVEFORM_COLORS.ORANGE);
  } else {
    // Medium: base -> yellow at top
    gradient.addColorStop(0.7, baseColor);
    gradient.addColorStop(1, WAVEFORM_COLORS.YELLOW);
  }

  return gradient;
}

/**
 * Render a simple single-color bar (for performance-critical scenarios)
 */
export function renderSimpleBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  baselineY: number,
  barWidth: number,
  barHeight: number,
  color: string
): void {
  if (barHeight <= 0) return;
  ctx.fillStyle = color;
  ctx.fillRect(x, baselineY - barHeight, barWidth, barHeight);
}

/**
 * Create a throttled render function for performance
 */
export function createThrottledRenderer(renderFn: () => void, _delay: number = 16): () => void {
  let isScheduled = false;

  return () => {
    if (!isScheduled) {
      isScheduled = true;
      requestAnimationFrame(() => {
        renderFn();
        isScheduled = false;
      });
    }
  };
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Render waveform with playhead indicator
 * Commonly used pattern: white before playhead, teal after
 */
export function renderWaveformWithPlayhead(
  canvas: HTMLCanvasElement,
  peaks: WaveformPeak[],
  width: number,
  height: number,
  currentTime: number,
  duration: number,
  options: Partial<WaveformRenderOptions> = {}
): void {
  const playheadRatio = duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;

  renderWaveform(canvas, {
    width,
    height,
    peaks,
    playheadRatio,
    playedColor: WAVEFORM_COLORS.PLAYED,
    baseColor: WAVEFORM_COLORS.BASE,
    ...options,
  });
}

/**
 * Render audio track waveform (CapCut style - bars from bottom)
 */
export function renderAudioTrackWaveform(
  canvas: HTMLCanvasElement,
  peaks: WaveformPeak[],
  width: number,
  height: number,
  options: Partial<WaveformRenderOptions> = {}
): void {
  renderWaveform(canvas, {
    width,
    height,
    peaks,
    style: 'bars',
    baseline: 1, // Bars grow upward from bottom
    useGradientColors: true,
    ...options,
  });
}
