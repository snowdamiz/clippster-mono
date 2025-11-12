import type { WaveformPeak } from '@/composables/useAudioWaveform';

export interface WaveformRenderOptions {
  width: number;
  height: number;
  peaks: WaveformPeak[];
  barWidth?: number;
  barSpacing?: number;
  color?: string;
  backgroundColor?: string;
  opacity?: number;
  style?: 'bars' | 'line' | 'filled';
  amplitude?: number; // 0-1, multiplier for peak height
}

export interface WaveformRenderContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

// Default waveform rendering options
export const DEFAULT_WAVEFORM_OPTIONS: Partial<WaveformRenderOptions> = {
  barWidth: 2,
  barSpacing: 1,
  color: '#9333ea', // purple-600
  backgroundColor: 'transparent',
  opacity: 0.8,
  style: 'bars',
  amplitude: 1.0,
};

// Create or get canvas rendering context
export function getWaveformRenderContext(canvas: HTMLCanvasElement): WaveformRenderContext {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D rendering context from canvas');
  }

  return { canvas, ctx };
}

// Clear canvas for rendering
export function clearCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  backgroundColor: string = 'transparent'
): void {
  if (backgroundColor === 'transparent') {
    ctx.clearRect(0, 0, width, height);
  } else {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
  }
}

// Render waveform as vertical bars
export function renderWaveformBars(
  ctx: CanvasRenderingContext2D,
  options: WaveformRenderOptions
): void {
  const {
    width,
    height,
    peaks,
    barWidth = 2,
    barSpacing = 1,
    color = '#9333ea',
    opacity = 0.8,
    amplitude = 1.0,
  } = options;

  if (peaks.length === 0) return;

  const totalBarWidth = barWidth + barSpacing;
  const centerY = height / 2;
  const maxBarHeight = height * amplitude;

  // Set rendering style
  ctx.fillStyle = color;
  ctx.globalAlpha = opacity;

  peaks.forEach((peak, index) => {
    const x = index * totalBarWidth;

    // Skip if bar would be outside canvas bounds
    if (x + barWidth > width) return;

    // Calculate bar heights from peak values
    const positiveHeight = Math.abs(peak.max) * maxBarHeight;
    const negativeHeight = Math.abs(peak.min) * maxBarHeight;

    // Draw upper bar (positive values)
    if (positiveHeight > 0) {
      ctx.fillRect(x, centerY - positiveHeight, barWidth, positiveHeight);
    }

    // Draw lower bar (negative values)
    if (negativeHeight > 0) {
      ctx.fillRect(x, centerY, barWidth, negativeHeight);
    }
  });

  ctx.globalAlpha = 1.0;
}

// Render waveform as connected lines
export function renderWaveformLine(
  ctx: CanvasRenderingContext2D,
  options: WaveformRenderOptions
): void {
  const {
    height,
    peaks,
    barSpacing = 1,
    color = '#9333ea',
    opacity = 0.8,
    amplitude = 1.0,
  } = options;

  if (peaks.length === 0) return;

  const step = barSpacing;
  const centerY = height / 2;
  const maxAmplitude = height * amplitude;

  ctx.strokeStyle = color;
  ctx.globalAlpha = opacity;
  ctx.lineWidth = 1;
  ctx.beginPath();

  // Draw upper waveform (positive values)
  peaks.forEach((peak, index) => {
    const x = index * step;
    const y = centerY - Math.abs(peak.max) * maxAmplitude;

    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  // Draw lower waveform (negative values) in reverse
  for (let i = peaks.length - 1; i >= 0; i--) {
    const peak = peaks[i];
    const x = i * step;
    const y = centerY + Math.abs(peak.min) * maxAmplitude;

    ctx.lineTo(x, y);
  }

  ctx.closePath();
  ctx.stroke();
  ctx.globalAlpha = 1.0;
}

// Render filled waveform
export function renderWaveformFilled(
  ctx: CanvasRenderingContext2D,
  options: WaveformRenderOptions
): void {
  const {
    height,
    peaks,
    barSpacing = 1,
    color = '#9333ea',
    opacity = 0.6,
    amplitude = 1.0,
  } = options;

  if (peaks.length === 0) return;

  const step = barSpacing;
  const centerY = height / 2;
  const maxAmplitude = height * amplitude;

  ctx.fillStyle = color;
  ctx.globalAlpha = opacity;
  ctx.beginPath();

  // Start from center-left
  ctx.moveTo(0, centerY);

  // Draw upper waveform
  peaks.forEach((peak, index) => {
    const x = index * step;
    const y = centerY - Math.abs(peak.max) * maxAmplitude;
    ctx.lineTo(x, y);
  });

  // Draw lower waveform back to center
  for (let i = peaks.length - 1; i >= 0; i--) {
    const peak = peaks[i];
    const x = i * step;
    const y = centerY + Math.abs(peak.min) * maxAmplitude;
    ctx.lineTo(x, y);
  }

  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1.0;
}

// Main waveform rendering function
export function renderWaveform(
  ctx: CanvasRenderingContext2D,
  options: WaveformRenderOptions
): void {
  const mergedOptions = { ...DEFAULT_WAVEFORM_OPTIONS, ...options };

  // Clear canvas first
  clearCanvas(ctx, mergedOptions.width, mergedOptions.height, mergedOptions.backgroundColor);

  // Render based on style
  switch (mergedOptions.style) {
    case 'bars':
      renderWaveformBars(ctx, mergedOptions as WaveformRenderOptions);
      break;
    case 'line':
      renderWaveformLine(ctx, mergedOptions as WaveformRenderOptions);
      break;
    case 'filled':
      renderWaveformFilled(ctx, mergedOptions as WaveformRenderOptions);
      break;
    default:
      renderWaveformBars(ctx, mergedOptions as WaveformRenderOptions);
  }
}

// Render waveform on a canvas element
export function renderWaveformOnCanvas(
  canvas: HTMLCanvasElement,
  options: Omit<WaveformRenderOptions, 'canvas' | 'ctx'>
): void {
  const { ctx } = getWaveformRenderContext(canvas);

  // Set canvas size
  canvas.width = options.width;
  canvas.height = options.height;

  renderWaveform(ctx, options as WaveformRenderOptions);
}

// Generate gradient colors for waveform
export function createWaveformGradient(
  ctx: CanvasRenderingContext2D,
  height: number,
  startColor: string,
  endColor: string
): CanvasGradient {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, startColor);
  gradient.addColorStop(0.5, endColor);
  gradient.addColorStop(1, startColor);
  return gradient;
}

// Throttled rendering function for performance
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

// Utility to calculate optimal waveform parameters based on zoom level
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
  const effectiveWidth = width * zoomLevel;

  // Determine optimal resolution if not provided
  const selectedResolution = resolution || determineOptimalResolution(duration, effectiveWidth);

  // Use provided peak count or get default for resolution
  const selectedPeakCount = peakCount || getDefaultPeakCountForResolution(selectedResolution);

  // Calculate bar dimensions to use the ENTIRE canvas width
  const availableWidth = width; // Use 100% of canvas width

  // Calculate optimal bar width and spacing to use ALL available width
  const targetTotalWidth = availableWidth;
  const maxBarWidth = 4; // Cap at 4px for visual clarity
  const minBarWidth = 1; // Minimum 1px for visibility

  // Calculate ideal bar width that would use all available width
  let idealBarWidth = Math.floor(targetTotalWidth / selectedPeakCount);
  let barWidth = Math.min(maxBarWidth, Math.max(minBarWidth, idealBarWidth));

  // Calculate spacing to ensure we use the FULL available width
  const totalBarArea = barWidth * selectedPeakCount;
  const remainingWidth = targetTotalWidth - totalBarArea;
  const barSpacing = selectedPeakCount > 1 ? remainingWidth / (selectedPeakCount - 1) : 0;

  const samplesPerPixel = (duration * 44100) / effectiveWidth; // Assuming 44.1kHz sample rate

  return {
    barWidth,
    barSpacing,
    samplesPerPixel,
    resolution: selectedResolution,
  };
}

// Helper function to determine optimal resolution
function determineOptimalResolution(duration: number, effectiveWidth: number): string {
  const samplesPerPixel = (duration * 44100) / effectiveWidth;

  // Select resolution based on zoom level (matching Rust logic)
  if (samplesPerPixel > 5000) {
    return 'low'; // 500 peaks - very zoomed out
  } else if (samplesPerPixel > 2000) {
    return 'medium'; // 1000 peaks - zoomed out
  } else if (samplesPerPixel > 800) {
    return 'high'; // 2000 peaks - normal
  } else if (samplesPerPixel > 300) {
    return 'ultra'; // 4000 peaks - zoomed in
  } else {
    return 'extreme'; // 8000 peaks - very zoomed in
  }
}

// Helper function to get default peak count for resolution
function getDefaultPeakCountForResolution(resolution: string): number {
  switch (resolution) {
    case 'low':
      return 500;
    case 'medium':
      return 1000;
    case 'high':
      return 2000;
    case 'ultra':
      return 4000;
    case 'extreme':
      return 8000;
    default:
      return 2000;
  }
}

// Utility to interpolate waveform data for smooth zooming
export function interpolateWaveform(
  sourcePeaks: WaveformPeak[],
  targetCount: number
): WaveformPeak[] {
  if (sourcePeaks.length <= targetCount) {
    return sourcePeaks;
  }

  const ratio = sourcePeaks.length / targetCount;
  const interpolated: WaveformPeak[] = [];

  for (let i = 0; i < targetCount; i++) {
    const sourceIndex = Math.floor(i * ratio);
    const nextIndex = Math.min(sourceIndex + 1, sourcePeaks.length - 1);
    const fraction = i * ratio - sourceIndex;

    const current = sourcePeaks[sourceIndex];
    const next = sourcePeaks[nextIndex];

    // Linear interpolation between peaks
    interpolated.push({
      min: current.min + (next.min - current.min) * fraction,
      max: current.max + (next.max - current.max) * fraction,
    });
  }

  return interpolated;
}
