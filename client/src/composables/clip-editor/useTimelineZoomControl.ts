/**
 * useTimelineZoomControl - Timeline zoom level state management
 *
 * Extracted from ClipEditorDialog.vue to centralize zoom control logic.
 * Handles zoom in/out operations with proper bounds and special handling for fit-to-width mode.
 */

import { ref, type Ref } from 'vue';

export interface TimelineZoomControlOptions {
  /** Initial zoom level (0 = fit entire timeline to view) */
  initialZoom?: number;
  /** Minimum zoom level when zoomed in */
  minZoom?: number;
  /** Maximum zoom level */
  maxZoom?: number;
  /** Zoom multiplier for each step */
  zoomFactor?: number;
  /** Threshold below which zoom resets to 0 (fit-to-width) */
  fitThreshold?: number;
}

export interface TimelineZoomControlReturn {
  /** Current zoom level (0 = fit-to-width) */
  zoomLevel: Ref<number>;
  /** Zoom in handler */
  zoomIn: () => void;
  /** Zoom out handler */
  zoomOut: () => void;
  /** Reset zoom to fit-to-width */
  resetZoom: () => void;
  /** Set zoom to a specific level */
  setZoom: (level: number) => void;
}

/**
 * Composable for managing timeline zoom state and operations
 */
export function useTimelineZoomControl(
  options: TimelineZoomControlOptions = {}
): TimelineZoomControlReturn {
  const {
    initialZoom = 0,
    minZoom = 0.5,
    maxZoom = 10,
    zoomFactor = 1.5,
    fitThreshold = 0.3,
  } = options;

  const zoomLevel = ref(initialZoom);

  /**
   * Zoom in on the timeline.
   * From 0 (fit-to-width), jumps to minZoom, then scales up by zoomFactor.
   */
  function zoomIn(): void {
    if (zoomLevel.value === 0) {
      // From fit-to-width, jump to minimum zoom level
      zoomLevel.value = minZoom;
    } else {
      // Scale up, capped at maxZoom
      zoomLevel.value = Math.min(zoomLevel.value * zoomFactor, maxZoom);
    }
  }

  /**
   * Zoom out on the timeline.
   * Scales down by zoomFactor, but resets to 0 (fit-to-width) when below threshold.
   */
  function zoomOut(): void {
    const newZoom = zoomLevel.value / zoomFactor;
    // Reset to fit-to-width when zoom gets too small
    zoomLevel.value = newZoom < fitThreshold ? 0 : newZoom;
  }

  /**
   * Reset zoom to fit-to-width mode
   */
  function resetZoom(): void {
    zoomLevel.value = 0;
  }

  /**
   * Set zoom to a specific level
   */
  function setZoom(level: number): void {
    if (level < 0) {
      zoomLevel.value = 0;
    } else if (level > maxZoom) {
      zoomLevel.value = maxZoom;
    } else {
      zoomLevel.value = level;
    }
  }

  return {
    zoomLevel,
    zoomIn,
    zoomOut,
    resetZoom,
    setZoom,
  };
}
