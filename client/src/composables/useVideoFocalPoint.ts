import { ref, computed } from 'vue';
import {
  getFocalPointsByRawVideoId,
  getFocalPointAtTime,
  type FocalPoint,
} from '@/services/database';

/**
 * Composable for managing focal points in video player
 * Provides reactive focal point that updates based on video playback time
 */
export function useVideoFocalPoint() {
  const focalPoints = ref<FocalPoint[]>([]);
  const currentTime = ref<number>(0);
  const rawVideoId = ref<string | null>(null);

  // Default to center if no focal points are loaded
  const defaultFocalPoint = { x: 0.5, y: 0.5 };

  /**
   * Current focal point based on video time
   * Interpolates between focal points for smooth transitions
   */
  const currentFocalPoint = computed(() => {
    if (focalPoints.value.length === 0) {
      return defaultFocalPoint;
    }

    if (focalPoints.value.length === 1) {
      const point = {
        x: focalPoints.value[0].focal_x,
        y: focalPoints.value[0].focal_y,
      };
      console.log('[VideoFocalPoint] Using single focal point:', point);
      return point;
    }

    // Find the two nearest focal points (before and after current time)
    let beforePoint: FocalPoint | null = null;
    let afterPoint: FocalPoint | null = null;

    for (const point of focalPoints.value) {
      if (point.time_offset <= currentTime.value) {
        beforePoint = point;
      }
      if (point.time_offset >= currentTime.value && afterPoint === null) {
        afterPoint = point;
        break;
      }
    }

    // If before the first point, use the first point
    if (beforePoint === null && afterPoint !== null) {
      return { x: afterPoint.focal_x, y: afterPoint.focal_y };
    }

    // If after the last point, use the last point
    if (beforePoint !== null && afterPoint === null) {
      return { x: beforePoint.focal_x, y: beforePoint.focal_y };
    }

    // If we have both points, interpolate
    if (beforePoint !== null && afterPoint !== null) {
      // If they're the same point (exact match), use it directly
      if (beforePoint.time_offset === afterPoint.time_offset) {
        return { x: beforePoint.focal_x, y: beforePoint.focal_y };
      }

      // Linear interpolation
      const timeDelta = afterPoint.time_offset - beforePoint.time_offset;
      const timeProgress = (currentTime.value - beforePoint.time_offset) / timeDelta;

      const interpolatedX =
        beforePoint.focal_x + (afterPoint.focal_x - beforePoint.focal_x) * timeProgress;
      const interpolatedY =
        beforePoint.focal_y + (afterPoint.focal_y - beforePoint.focal_y) * timeProgress;

      // Log significant focal point changes (more than 5% movement)
      const deltaX = Math.abs(interpolatedX - 0.5);
      const deltaY = Math.abs(interpolatedY - 0.5);
      if (deltaX > 0.05 || deltaY > 0.05) {
        console.log(
          `[VideoFocalPoint] Time: ${currentTime.value.toFixed(1)}s, Focal: (${interpolatedX.toFixed(3)}, ${interpolatedY.toFixed(3)}), Progress: ${(timeProgress * 100).toFixed(1)}%`
        );
      }

      return { x: interpolatedX, y: interpolatedY };
    }

    // Fallback to center
    return defaultFocalPoint;
  });

  /**
   * Load focal points for a video
   * @param videoId - Raw video ID
   */
  async function loadFocalPoints(videoId: string): Promise<void> {
    try {
      console.log('[VideoFocalPoint] Loading focal points for video:', videoId);
      rawVideoId.value = videoId;
      const points = await getFocalPointsByRawVideoId(videoId);
      focalPoints.value = points;
      console.log('[VideoFocalPoint] Loaded', points.length, 'focal points');

      // Log sample focal points for debugging
      if (points.length > 0) {
        console.log('[VideoFocalPoint] First focal point:', points[0]);
        if (points.length > 1) {
          console.log('[VideoFocalPoint] Last focal point:', points[points.length - 1]);
        }
      }
    } catch (error) {
      console.error('[VideoFocalPoint] Failed to load focal points:', error);
      focalPoints.value = [];
    }
  }

  /**
   * Update current video time
   * @param time - Current time in seconds
   */
  function updateTime(time: number): void {
    currentTime.value = time;
  }

  /**
   * Reset focal points (e.g., when changing videos)
   */
  function reset(): void {
    focalPoints.value = [];
    currentTime.value = 0;
    rawVideoId.value = null;
  }

  /**
   * Get focal point at specific time (async, more accurate)
   * @param time - Time in seconds
   * @returns Focal point coordinates
   */
  async function getFocalPointAt(time: number): Promise<{ x: number; y: number }> {
    if (!rawVideoId.value) {
      return defaultFocalPoint;
    }
    return await getFocalPointAtTime(rawVideoId.value, time);
  }

  return {
    // State
    focalPoints,
    currentTime,
    currentFocalPoint,

    // Methods
    loadFocalPoints,
    updateTime,
    reset,
    getFocalPointAt,
  };
}
