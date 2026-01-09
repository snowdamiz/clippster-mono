/**
 * Audio dB (decibel) utilities for waveform visualization
 * Provides accurate dB calculations and color mapping similar to professional DAWs like CapCut
 * 
 * CapCut Style: Base color for the bar with yellow/red gradient at the TOP only when loud
 */

// dB thresholds for color coding (relative to 0 dBFS - digital full scale)
export const DB_THRESHOLDS = {
  // Green zone: Safe levels (-∞ to -12 dB)
  SAFE_MAX: -12,
  // Yellow zone: Caution levels (-12 to -6 dB)
  CAUTION_MAX: -6,
  // Orange zone: Warning levels (-6 to -3 dB)
  WARNING_MAX: -3,
  // Red zone: Clipping danger (-3 to 0 dB)
  CLIP_THRESHOLD: -0.5,
  // Absolute minimum dB to display (below this is silence)
  FLOOR: -60,
};

// Colors for CapCut-style waveform (teal/cyan like CapCut)
export const DB_COLORS = {
  BASE: '#5eead4',       // Base waveform color: teal-300 (matches CapCut)
  YELLOW: '#facc15',     // Caution zone at top: yellow-400
  ORANGE: '#fb923c',     // Warning zone at top: orange-400
  RED: '#f87171',        // Clipping zone at top: red-400
  SILENCE: '#4b5563',    // Below floor: gray-600
};

// Amplitude thresholds (linear scale 0-1) for CapCut-style coloring
export const AMPLITUDE_THRESHOLDS = {
  YELLOW: 0.5,   // 50% amplitude - start showing yellow at top
  ORANGE: 0.75,  // 75% amplitude - start showing orange at top  
  RED: 0.9,      // 90% amplitude - start showing red at top
};

/**
 * Convert linear amplitude (0-1) to dB (decibels)
 * 0 dBFS = 1.0 linear (digital full scale)
 * -6 dBFS = 0.5 linear
 * -20 dBFS ≈ 0.1 linear
 * -∞ dBFS = 0 linear
 */
export function linearToDb(linear: number): number {
  if (linear <= 0) return DB_THRESHOLDS.FLOOR;
  const db = 20 * Math.log10(Math.abs(linear));
  return Math.max(DB_THRESHOLDS.FLOOR, db);
}

/**
 * Convert dB to linear amplitude
 */
export function dbToLinear(db: number): number {
  if (db <= DB_THRESHOLDS.FLOOR) return 0;
  return Math.pow(10, db / 20);
}

/**
 * Get color based on dB level (legacy - use getCapcutStyleColors for CapCut-style rendering)
 */
export function getDbColor(db: number): string {
  if (db <= DB_THRESHOLDS.FLOOR) return DB_COLORS.SILENCE;
  if (db < DB_THRESHOLDS.SAFE_MAX) return DB_COLORS.BASE;
  if (db < DB_THRESHOLDS.CAUTION_MAX) return DB_COLORS.YELLOW;
  if (db < DB_THRESHOLDS.WARNING_MAX) return DB_COLORS.ORANGE;
  return DB_COLORS.RED;
}

/**
 * Get color based on linear amplitude (0-1)
 * Returns base color - use renderCapcutStyleBar for proper CapCut-style gradient bars
 */
export function getAmplitudeColor(amplitude: number): string {
  // For CapCut style, we always return the base color
  // The gradient effect is handled in the rendering function
  if (amplitude <= 0.01) return DB_COLORS.SILENCE;
  return DB_COLORS.BASE;
}

/**
 * Get a gradient of colors for a peak based on its amplitude
 * Returns an object with the main color and whether it's clipping
 */
export function getPeakColorInfo(amplitude: number): {
  color: string;
  db: number;
  isClipping: boolean;
  isCaution: boolean;
  isWarning: boolean;
} {
  const db = linearToDb(amplitude);
  return {
    color: getDbColor(db),
    db,
    isClipping: db >= DB_THRESHOLDS.WARNING_MAX,
    isCaution: db >= DB_THRESHOLDS.SAFE_MAX && db < DB_THRESHOLDS.CAUTION_MAX,
    isWarning: db >= DB_THRESHOLDS.CAUTION_MAX && db < DB_THRESHOLDS.WARNING_MAX,
  };
}

/**
 * Normalize dB value to 0-1 range for display purposes
 * Maps from FLOOR to 0 dBFS to 0-1 range
 */
export function normalizeDb(db: number): number {
  const range = Math.abs(DB_THRESHOLDS.FLOOR);
  const normalized = (db - DB_THRESHOLDS.FLOOR) / range;
  return Math.max(0, Math.min(1, normalized));
}

/**
 * Calculate RMS (Root Mean Square) level from peak values
 * RMS is a better representation of perceived loudness
 */
export function peakToRms(peakMin: number, peakMax: number): number {
  // Approximate RMS from peak values (typically RMS is about 3dB below peak)
  const peak = Math.max(Math.abs(peakMin), Math.abs(peakMax));
  // RMS is typically about 70.7% of peak for a sine wave
  return peak * 0.707;
}

/**
 * Get the appropriate bar height multiplier based on dB
 * This ensures quiet audio doesn't appear as loud as it would with linear scaling
 */
export function getDbScaledHeight(amplitude: number, maxHeight: number): number {
  if (amplitude <= 0) return 1; // Minimum 1px for visibility
  
  const db = linearToDb(amplitude);
  // Normalize to 0-1 range where 0 dBFS = 1.0
  const normalizedDb = normalizeDb(db);
  
  // Apply a slight curve to make the visualization more readable
  // This makes quiet sounds more visible while still showing relative levels
  const curved = Math.pow(normalizedDb, 0.7);
  
  return Math.max(1, curved * maxHeight);
}

/**
 * Create a vertical gradient for CapCut-style audio waveform
 * Base color at bottom, yellow/orange/red at top based on amplitude
 */
export function createCapcutGradient(
  ctx: CanvasRenderingContext2D,
  barHeight: number,
  amplitude: number
): CanvasGradient {
  const gradient = ctx.createLinearGradient(0, barHeight, 0, 0);
  
  // Base color for most of the bar
  gradient.addColorStop(0, DB_COLORS.BASE);
  
  if (amplitude >= AMPLITUDE_THRESHOLDS.RED) {
    // Very loud: base -> yellow -> orange -> red at top
    gradient.addColorStop(0.5, DB_COLORS.BASE);
    gradient.addColorStop(0.7, DB_COLORS.YELLOW);
    gradient.addColorStop(0.85, DB_COLORS.ORANGE);
    gradient.addColorStop(1, DB_COLORS.RED);
  } else if (amplitude >= AMPLITUDE_THRESHOLDS.ORANGE) {
    // Loud: base -> yellow -> orange at top
    gradient.addColorStop(0.6, DB_COLORS.BASE);
    gradient.addColorStop(0.8, DB_COLORS.YELLOW);
    gradient.addColorStop(1, DB_COLORS.ORANGE);
  } else if (amplitude >= AMPLITUDE_THRESHOLDS.YELLOW) {
    // Medium: base -> yellow at top
    gradient.addColorStop(0.7, DB_COLORS.BASE);
    gradient.addColorStop(1, DB_COLORS.YELLOW);
  } else {
    // Quiet: all base color
    gradient.addColorStop(1, DB_COLORS.BASE);
  }
  
  return gradient;
}

/**
 * Render a single CapCut-style waveform bar
 * Bars grow UPWARD from baseline (bottom of waveform area)
 * Single solid color (teal) like CapCut
 */
export function renderCapcutStyleBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  baselineY: number,
  barWidth: number,
  barHeight: number,
  amplitude: number
): void {
  if (barHeight <= 0) return;
  
  // Simple solid color bar growing upward from baseline
  ctx.fillStyle = DB_COLORS.BASE;
  ctx.fillRect(x, baselineY - barHeight, barWidth, barHeight);
}

/**
 * Analyze peaks and return statistics
 */
export function analyzePeaks(peaks: { min: number; max: number }[]): {
  peakDb: number;
  avgDb: number;
  clippingCount: number;
  warningCount: number;
} {
  if (peaks.length === 0) {
    return { peakDb: DB_THRESHOLDS.FLOOR, avgDb: DB_THRESHOLDS.FLOOR, clippingCount: 0, warningCount: 0 };
  }
  
  let maxAmplitude = 0;
  let sumAmplitude = 0;
  let clippingCount = 0;
  let warningCount = 0;
  
  for (const peak of peaks) {
    const amplitude = Math.max(Math.abs(peak.min), Math.abs(peak.max));
    maxAmplitude = Math.max(maxAmplitude, amplitude);
    sumAmplitude += amplitude;
    
    const db = linearToDb(amplitude);
    if (db >= DB_THRESHOLDS.WARNING_MAX) clippingCount++;
    else if (db >= DB_THRESHOLDS.CAUTION_MAX) warningCount++;
  }
  
  return {
    peakDb: linearToDb(maxAmplitude),
    avgDb: linearToDb(sumAmplitude / peaks.length),
    clippingCount,
    warningCount,
  };
}
