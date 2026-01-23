import type { Ref } from 'vue';
import type { VideoSource } from './useVideoSourceTime';

/**
 * Options for useTimelineSegmentStyles
 */
export interface TimelineSegmentStylesOptions {
  /** Pixels per second for timeline scaling */
  pixelsPerSecond: Ref<number>;
}

/**
 * Return type for useTimelineSegmentStyles
 */
export interface TimelineSegmentStylesReturn {
  /** Get CSS style object for a segment */
  getSegmentStyle: (startTime: number, segmentDuration: number) => Record<string, string>;
  /** Format a video source label */
  formatSourceLabel: (source: VideoSource) => string;
}

/**
 * useTimelineSegmentStyles - Extract timeline segment styling logic
 *
 * Extracted from ClipEditorTimeline.vue:
 * - getSegmentStyle() - line 327-332
 * - formatSourceLabel() - line 356-359
 *
 * This composable handles:
 * - Segment positioning (left, width) based on time and zoom
 * - Source label formatting
 *
 * Usage:
 * ```ts
 * const { getSegmentStyle, formatSourceLabel } = useTimelineSegmentStyles({
 *   pixelsPerSecond: computed(() => zoom * 100),
 * });
 *
 * // In template
 * :style="getSegmentStyle(segment.start_time, segment.duration)"
 * {{ formatSourceLabel(source) }}
 * ```
 */
export function useTimelineSegmentStyles(
  options: TimelineSegmentStylesOptions
): TimelineSegmentStylesReturn {
  const { pixelsPerSecond } = options;

  /**
   * Get CSS style object for positioning a segment on the timeline
   * @param startTime - Start time in seconds
   * @param segmentDuration - Duration of the segment in seconds
   * @returns CSS style object with left and width properties
   */
  function getSegmentStyle(startTime: number, segmentDuration: number): Record<string, string> {
    return {
      left: startTime * pixelsPerSecond.value + 'px',
      width: segmentDuration * pixelsPerSecond.value + 'px',
    };
  }

  /**
   * Format a video source label for display
   * @param source - Video source object
   * @returns Formatted label string
   */
  function formatSourceLabel(source: VideoSource): string {
    const duration = source.end_time - source.start_time;
    return `Clip (${duration.toFixed(1)}s)`;
  }

  return {
    getSegmentStyle,
    formatSourceLabel,
  };
}
