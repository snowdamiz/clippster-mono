import { computed, type Ref, type ComputedRef } from 'vue';

/**
 * Video source on the timeline
 */
export interface VideoSource {
  id: string;
  file_path: string;
  start_time: number;
  end_time: number;
  trim_start: number;
  trim_end: number | null;
  original_duration: number;
}

/**
 * Return type for useVideoSourceTime
 */
export interface VideoSourceTimeReturn {
  /**
   * Convert timeline time to actual video source time
   * This accounts for trim_start offset - the video file may start at a different
   * position than the beginning of the file.
   *
   * @param timelineTime - Time on the editor timeline (what the user sees)
   * @returns Actual position in the video file
   */
  getVideoSourceTime: (timelineTime: number) => number;

  /**
   * Find which video source contains the given timeline time
   * @param timelineTime - Time on the editor timeline
   * @returns The video source at that time, or null if none
   */
  findSourceAtTime: (timelineTime: number) => VideoSource | null;

  /**
   * Check if the current timeline time is past all video content
   * @param timelineTime - Time on the editor timeline
   * @param contentDuration - Total duration of video content
   * @returns True if past all video sources
   */
  isAfterVideoEnd: (timelineTime: number, contentDuration: number) => boolean;

  /**
   * Get the maximum end time of all video sources
   */
  videoContentDuration: ComputedRef<number>;
}

/**
 * useVideoSourceTime - Handle time conversion between timeline and video source
 *
 * Extracts the time conversion logic from ClipEditorPreview (lines 601-624)
 *
 * The clip editor uses two different time systems:
 * 1. Timeline time: 0 to duration (what the user sees and interacts with)
 * 2. Video source time: trim_start to trim_end (actual position in the video file)
 *
 * This composable handles converting between these two systems.
 *
 * Usage:
 * ```ts
 * const { getVideoSourceTime, findSourceAtTime, isAfterVideoEnd } = useVideoSourceTime(videoSources);
 *
 * // When seeking in the video element
 * videoElement.currentTime = getVideoSourceTime(timelineTime);
 *
 * // Check if we should show black screen
 * if (isAfterVideoEnd(currentTime, contentDuration)) {
 *   showBlackScreen();
 * }
 * ```
 */
export function useVideoSourceTime(
  videoSources: Ref<VideoSource[]>
): VideoSourceTimeReturn {
  /**
   * Calculate the actual video content duration (max end time of video sources)
   */
  const videoContentDuration = computed(() => {
    if (!videoSources.value || videoSources.value.length === 0) {
      return 0;
    }
    return Math.max(...videoSources.value.map((s) => s.end_time));
  });

  /**
   * Find which video source contains the given timeline time
   */
  function findSourceAtTime(timelineTime: number): VideoSource | null {
    if (!videoSources.value || videoSources.value.length === 0) {
      return null;
    }

    for (const source of videoSources.value) {
      if (timelineTime >= source.start_time && timelineTime < source.end_time) {
        return source;
      }
    }

    return null;
  }

  /**
   * Convert timeline time to actual video source time
   */
  function getVideoSourceTime(timelineTime: number): number {
    if (!videoSources.value || videoSources.value.length === 0) {
      return timelineTime;
    }

    // Find the video source that contains this timeline time
    const source = findSourceAtTime(timelineTime);
    if (source) {
      // Calculate offset within this source
      const offsetInSource = timelineTime - source.start_time;
      // Add trim_start to get actual video file position
      return source.trim_start + offsetInSource;
    }

    // If we're past all sources, use the last source's end position
    const lastSource = videoSources.value[videoSources.value.length - 1];
    if (lastSource && timelineTime >= lastSource.end_time) {
      const offsetInSource = lastSource.end_time - lastSource.start_time;
      return lastSource.trim_start + offsetInSource;
    }

    return timelineTime;
  }

  /**
   * Check if the current time is past all video content
   */
  function isAfterVideoEnd(timelineTime: number, contentDuration: number): boolean {
    const videoDuration = contentDuration || videoContentDuration.value;
    return timelineTime > videoDuration;
  }

  return {
    getVideoSourceTime,
    findSourceAtTime,
    isAfterVideoEnd,
    videoContentDuration,
  };
}
