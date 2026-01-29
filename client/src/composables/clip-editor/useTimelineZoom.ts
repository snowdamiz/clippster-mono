import { ref, computed, watch, type Ref, type ComputedRef } from 'vue';

/**
 * Constants for timeline zoom calculations
 */
export const TRACK_LABEL_WIDTH = 100;
export const PIXELS_PER_SECOND_BASE = 100;
export const MIN_TIMELINE_WIDTH = 800;

/**
 * Options for useTimelineZoom
 */
export interface TimelineZoomOptions {
  /** Reference to the tracks container element */
  containerRef: Ref<HTMLElement | null>;
  /** Current zoom level (0 = fit-to-width, > 0 = scaled) */
  zoomLevel: Ref<number> | ComputedRef<number>;
  /** Total duration of the timeline in seconds */
  duration: Ref<number> | ComputedRef<number>;
  /** Current playhead time for auto-scroll */
  currentTime: Ref<number> | ComputedRef<number>;
  /** Whether auto-scroll should be enabled */
  enableAutoScroll?: boolean;
}

/**
 * Return type for useTimelineZoom
 */
export interface TimelineZoomReturn {
  /** Calculated pixels per second based on zoom level */
  pixelsPerSecond: ComputedRef<number>;
  /** Total width of the timeline in pixels */
  timelineWidth: ComputedRef<number>;
  /** Current scroll position */
  scrollLeft: Ref<number>;
  /** Handle scroll events to update scroll position */
  handleScroll: () => void;
  /** Playhead position within timeline content (not accounting for scroll) */
  playheadPosition: ComputedRef<number>;
  /** Playhead screen position (accounting for scroll and track label) */
  playheadScreenPosition: ComputedRef<number>;
}

/**
 * useTimelineZoom - Extract zoom and scroll calculations from ClipEditorTimeline
 *
 * This composable handles:
 * - Pixels per second calculation based on zoom level
 * - Timeline width calculation
 * - Auto-scroll to keep playhead in view
 * - Scroll state management
 *
 * Extracted from ClipEditorTimeline.vue lines 264-351:
 * - pixelsPerSecond computed
 * - timelineWidth computed
 * - Auto-scroll watch logic
 *
 * Usage:
 * ```ts
 * const tracksContainer = ref<HTMLElement | null>(null);
 * const zoomLevel = ref(0);
 * const duration = ref(60);
 * const currentTime = ref(0);
 *
 * const {
 *   pixelsPerSecond,
 *   timelineWidth,
 *   scrollLeft,
 *   handleScroll,
 *   playheadPosition,
 *   playheadScreenPosition,
 * } = useTimelineZoom({
 *   containerRef: tracksContainer,
 *   zoomLevel,
 *   duration,
 *   currentTime,
 * });
 * ```
 */
export function useTimelineZoom(options: TimelineZoomOptions): TimelineZoomReturn {
  const {
    containerRef,
    zoomLevel,
    duration,
    currentTime,
    enableAutoScroll = true,
  } = options;

  // Track scroll position
  const scrollLeft = ref(0);

  /**
   * Calculate pixels per second based on zoom level
   * At zoom level 0: fit entire duration to container width
   * At zoom level > 0: scale from base pixels per second
   */
  const pixelsPerSecond = computed(() => {
    if (!containerRef.value) return PIXELS_PER_SECOND_BASE;

    // At zoom level 0, fit entire duration to container width
    if (zoomLevel.value === 0) {
      const containerWidth = containerRef.value.clientWidth;
      // Use at least MIN_TIMELINE_WIDTH to prevent too-compressed timeline
      const targetWidth = Math.max(MIN_TIMELINE_WIDTH, containerWidth);
      return duration.value > 0 ? targetWidth / duration.value : PIXELS_PER_SECOND_BASE;
    }

    // For zoom > 0, scale from the fit-to-width baseline
    return PIXELS_PER_SECOND_BASE * zoomLevel.value;
  });

  /**
   * Calculate timeline width based on duration and pixels per second
   */
  const timelineWidth = computed(() => {
    return duration.value * pixelsPerSecond.value;
  });

  /**
   * Playhead position within the timeline content (based on current time)
   */
  const playheadPosition = computed(() => {
    return currentTime.value * pixelsPerSecond.value;
  });

  /**
   * Playhead screen position (accounting for scroll and track label width)
   */
  const playheadScreenPosition = computed(() => {
    return TRACK_LABEL_WIDTH + playheadPosition.value - scrollLeft.value;
  });

  /**
   * Handle scroll events to update scroll position
   */
  function handleScroll(): void {
    if (containerRef.value) {
      scrollLeft.value = containerRef.value.scrollLeft;
    }
  }

  /**
   * Auto-scroll timeline to keep playhead in view
   * Triggers when currentTime changes during playback
   */
  if (enableAutoScroll) {
    watch(currentTime, (newTime) => {
      if (!containerRef.value) return;

      const playheadPos = newTime * pixelsPerSecond.value;
      const containerWidth = containerRef.value.clientWidth;
      const currentScrollLeft = containerRef.value.scrollLeft;

      // Target position: keep playhead at 30% from left edge (gives context)
      const targetScrollLeft = playheadPos - (containerWidth * 0.3);

      // Only auto-scroll if playhead would go off-screen
      const isOffScreenRight = playheadPos > currentScrollLeft + (containerWidth * 0.8);
      const isOffScreenLeft = playheadPos < currentScrollLeft + (containerWidth * 0.2);

      if (isOffScreenRight || isOffScreenLeft) {
        // Smooth scroll to keep playhead in view
        containerRef.value.scrollTo({
          left: Math.max(0, targetScrollLeft),
          behavior: 'smooth',
        });
      }
    });
  }

  return {
    pixelsPerSecond,
    timelineWidth,
    scrollLeft,
    handleScroll,
    playheadPosition,
    playheadScreenPosition,
  };
}
