import { computed, type Ref, type ComputedRef } from 'vue';

/**
 * Time marker for the ruler
 */
export interface TimeMarker {
  time: number;
}

/**
 * Options for useTimelineRuler
 */
export interface TimelineRulerOptions {
  /** Total duration of the timeline in seconds */
  duration: Ref<number> | ComputedRef<number>;
  /** Current zoom level */
  zoomLevel: Ref<number> | ComputedRef<number>;
}

/**
 * Return type for useTimelineRuler
 */
export interface TimelineRulerReturn {
  /** Array of time markers for the ruler */
  timeMarkers: ComputedRef<TimeMarker[]>;
  /** Get appropriate time interval based on zoom level */
  getTimeInterval: () => number;
}

/**
 * useTimelineRuler - Extract ruler generation from ClipEditorTimeline
 *
 * This composable handles:
 * - Time marker generation for the ruler
 * - Interval calculation based on zoom level
 *
 * Extracted from ClipEditorTimeline.vue lines 354-374:
 * - timeMarkers computed
 * - getTimeInterval() function
 *
 * The interval adapts based on visible duration to show appropriate
 * time markers (30s, 15s, 10s, 5s, or 1s intervals).
 *
 * Usage:
 * ```ts
 * const duration = ref(120);
 * const zoomLevel = ref(1);
 *
 * const { timeMarkers, getTimeInterval } = useTimelineRuler({
 *   duration,
 *   zoomLevel,
 * });
 *
 * // In template
 * <div v-for="marker in timeMarkers" :key="marker.time">
 *   {{ formatTime(marker.time) }}
 * </div>
 * ```
 */
export function useTimelineRuler(options: TimelineRulerOptions): TimelineRulerReturn {
  const { duration, zoomLevel } = options;

  /**
   * Get appropriate time interval based on zoom level
   * Returns larger intervals when zoomed out, smaller when zoomed in
   */
  function getTimeInterval(): number {
    // Handle fit-to-width mode (zoomLevel = 0)
    const effectiveZoom = zoomLevel.value === 0 ? 1 : zoomLevel.value;
    const visibleDuration = duration.value / effectiveZoom;

    if (visibleDuration > 120) return 30; // 30s intervals for > 2 min
    if (visibleDuration > 60) return 15;  // 15s intervals for > 1 min
    if (visibleDuration > 30) return 10;  // 10s intervals for > 30s
    if (visibleDuration > 10) return 5;   // 5s intervals for > 10s
    return 1;  // 1s intervals for short durations
  }

  /**
   * Generate time markers for the ruler
   * Creates markers at regular intervals based on zoom level
   */
  const timeMarkers = computed<TimeMarker[]>(() => {
    const markers: TimeMarker[] = [];
    const interval = getTimeInterval();

    for (let time = 0; time <= duration.value; time += interval) {
      markers.push({ time });
    }

    return markers;
  });

  return {
    timeMarkers,
    getTimeInterval,
  };
}
