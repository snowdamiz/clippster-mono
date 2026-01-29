import { computed, type Ref, type ComputedRef } from 'vue';
import type { VideoSource, AudioTrackInfo, TimelineState } from './usePlaybackEngine';

/**
 * Active video source with computed video time
 */
export interface ActiveVideoSource extends VideoSource {
  /** Current time within the source video (accounting for trim) */
  videoTime: number;
  /** Progress through this source (0-1) */
  progress: number;
  /** Time until this source ends */
  timeRemaining: number;
}

/**
 * Active audio track with computed state
 */
export interface ActiveAudioTrack extends AudioTrackInfo {
  /** Current time within the audio track */
  audioTime: number;
  /** Computed volume including fades */
  computedVolume: number;
}

/**
 * Transition between two video sources
 */
export interface ActiveTransition {
  type: 'crossfade' | 'wipe' | 'slide' | 'zoom';
  progress: number; // 0-1
  sourceA: VideoSource;
  sourceB: VideoSource;
  duration: number;
}

/**
 * Overlay item (text, sticker, watermark)
 */
export interface OverlayItem {
  id: string;
  type: 'text' | 'sticker' | 'watermark';
  startTime: number;
  endTime: number;
  data: Record<string, unknown>;
}

/**
 * Active overlay with computed state
 */
export interface ActiveOverlay extends OverlayItem {
  /** Time since this overlay started */
  elapsedTime: number;
  /** Progress through this overlay (0-1) */
  progress: number;
}

/**
 * Timeline renderer options
 */
export interface TimelineRendererOptions {
  /** Transition overlap duration in seconds (default: 0) */
  transitionDuration?: number;
}

/**
 * Timeline renderer return type
 */
export interface TimelineRendererReturn {
  // Queries (all take currentTime as input via reactive binding)
  getActiveVideoSource: (time: number) => ActiveVideoSource | null;
  getVideoSourceTime: (time: number, source: VideoSource) => number;
  getActiveAudioTracks: (time: number) => ActiveAudioTrack[];
  getActiveOverlays: (time: number, overlays: OverlayItem[]) => ActiveOverlay[];
  getActiveTransition: (time: number) => ActiveTransition | null;
  isInGap: (time: number) => boolean;
  getNextVideoSource: (time: number) => VideoSource | null;
  getPreviousVideoSource: (time: number) => VideoSource | null;

  // Precomputed for performance
  sortedVideoSources: ComputedRef<VideoSource[]>;
  sortedAudioTracks: ComputedRef<AudioTrackInfo[]>;
}

/**
 * Timeline renderer composable
 * 
 * Provides pure query functions to determine what should be visible/audible
 * at any given time on the timeline. All functions are stateless and derive
 * their results from the timeline state and the provided time.
 * 
 * Key principles:
 * 1. Pure functions - no side effects
 * 2. Efficient queries - pre-sorted data, binary search where applicable
 * 3. Gap-aware - gaps are first-class citizens, not special cases
 */
export function useTimelineRenderer(
  timeline: Ref<TimelineState>,
  options: TimelineRendererOptions = {}
): TimelineRendererReturn {
  const { transitionDuration = 0 } = options;

  /**
   * Video sources sorted by start_time for efficient queries
   */
  const sortedVideoSources = computed(() => {
    return [...timeline.value.videoSources].sort((a, b) => a.start_time - b.start_time);
  });

  /**
   * Audio tracks sorted by startTime
   */
  const sortedAudioTracks = computed(() => {
    return [...timeline.value.audioTracks].sort((a, b) => a.startTime - b.startTime);
  });

  /**
   * Check if a time falls within a gap (no video source)
   * Uses a small tolerance to avoid false gaps at segment boundaries
   */
  function isInGap(time: number): boolean {
    const sources = sortedVideoSources.value;
    const GAP_TOLERANCE = 0.05; // 50ms tolerance for segment boundaries

    // No sources = always a gap
    if (sources.length === 0) {
      return true;
    }

    // Before first source (with tolerance)
    if (time < sources[0].start_time - GAP_TOLERANCE) {
      return true;
    }

    // After last source (with tolerance)
    const lastSource = sources[sources.length - 1];
    if (time >= lastSource.end_time + GAP_TOLERANCE) {
      return true;
    }

    // Check if time falls within any source (with tolerance for boundaries)
    for (const source of sources) {
      // Use tolerance at end boundary to handle segment transitions
      if (time >= source.start_time && time < source.end_time + GAP_TOLERANCE) {
        return false;
      }
    }

    // Check for small gaps between adjacent segments (< tolerance = not a real gap)
    for (let i = 0; i < sources.length - 1; i++) {
      const current = sources[i];
      const next = sources[i + 1];
      const gapSize = next.start_time - current.end_time;
      
      // If gap is smaller than tolerance and time is in this region, not a gap
      if (gapSize < GAP_TOLERANCE && time >= current.end_time && time < next.start_time) {
        return false;
      }
    }

    // Between sources with significant gap = real gap
    return true;
  }

  /**
   * Get the video source active at the given time
   * Returns null if in a gap
   * Uses tolerance at segment boundaries to ensure seamless transitions
   */
  function getActiveVideoSource(time: number): ActiveVideoSource | null {
    const sources = sortedVideoSources.value;
    const BOUNDARY_TOLERANCE = 0.05; // 50ms tolerance

    // First pass: exact match
    for (const source of sources) {
      if (time >= source.start_time && time < source.end_time) {
        const videoTime = getVideoSourceTime(time, source);
        const sourceDuration = source.end_time - source.start_time;
        const elapsed = time - source.start_time;

        return {
          ...source,
          videoTime,
          progress: sourceDuration > 0 ? elapsed / sourceDuration : 0,
          timeRemaining: source.end_time - time,
        };
      }
    }

    // Second pass: check if we're at a segment boundary (within tolerance)
    // This handles the case where time is exactly at end_time
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      const nextSource = sources[i + 1];

      // At the end of current source, check if next source starts immediately
      if (time >= source.end_time && time < source.end_time + BOUNDARY_TOLERANCE) {
        if (nextSource && nextSource.start_time <= source.end_time + BOUNDARY_TOLERANCE) {
          // Transition to next source
          const videoTime = nextSource.trim_start;
          const sourceDuration = nextSource.end_time - nextSource.start_time;

          return {
            ...nextSource,
            videoTime,
            progress: 0,
            timeRemaining: sourceDuration,
          };
        } else {
          // No next source or gap - clamp to end of current source
          const videoTime = source.trim_end ?? (source.trim_start + (source.end_time - source.start_time));
          const sourceDuration = source.end_time - source.start_time;

          return {
            ...source,
            videoTime: videoTime - 0.001, // Slightly before end to avoid issues
            progress: 1,
            timeRemaining: 0,
          };
        }
      }
    }

    return null;
  }

  /**
   * Convert timeline time to video source time (accounting for trim)
   */
  function getVideoSourceTime(time: number, source: VideoSource): number {
    // Calculate position within the source's timeline segment
    const timelineOffset = time - source.start_time;

    // Add trim_start to get position in source video
    return source.trim_start + timelineOffset;
  }

  /**
   * Get the next video source after the given time
   */
  function getNextVideoSource(time: number): VideoSource | null {
    const sources = sortedVideoSources.value;

    for (const source of sources) {
      if (source.start_time > time) {
        return source;
      }
    }

    return null;
  }

  /**
   * Get the previous video source before the given time
   */
  function getPreviousVideoSource(time: number): VideoSource | null {
    const sources = sortedVideoSources.value;

    for (let i = sources.length - 1; i >= 0; i--) {
      if (sources[i].end_time <= time) {
        return sources[i];
      }
    }

    return null;
  }

  /**
   * Get all audio tracks active at the given time
   */
  function getActiveAudioTracks(time: number): ActiveAudioTrack[] {
    const tracks = sortedAudioTracks.value;
    const activeTracks: ActiveAudioTrack[] = [];

    for (const track of tracks) {
      if (time >= track.startTime && time < track.endTime && !track.isMuted) {
        // Calculate position within the timeline segment
        const timelineOffset = time - track.startTime;
        // Add source_start_time to get the correct position in the source audio file
        // This ensures split segments play the correct portion of the audio
        const audioTime = track.sourceStartTime + timelineOffset;
        const computedVolume = computeTrackVolume(track, time);

        activeTracks.push({
          ...track,
          audioTime,
          computedVolume,
        });
      }
    }

    return activeTracks;
  }

  /**
   * Compute track volume including fade in/out
   */
  function computeTrackVolume(track: AudioTrackInfo, time: number): number {
    let volume = track.volume;

    const elapsed = time - track.startTime;
    const remaining = track.endTime - time;

    // Apply fade in
    if (track.fadeInDuration && track.fadeInDuration > 0 && elapsed < track.fadeInDuration) {
      volume *= elapsed / track.fadeInDuration;
    }

    // Apply fade out
    if (track.fadeOutDuration && track.fadeOutDuration > 0 && remaining < track.fadeOutDuration) {
      volume *= remaining / track.fadeOutDuration;
    }

    // Clamp to 0-2 range (allow up to 200% volume)
    return Math.max(0, Math.min(2, volume));
  }

  /**
   * Get all overlays active at the given time
   */
  function getActiveOverlays(time: number, overlays: OverlayItem[]): ActiveOverlay[] {
    const activeOverlays: ActiveOverlay[] = [];

    for (const overlay of overlays) {
      if (time >= overlay.startTime && time < overlay.endTime) {
        const elapsedTime = time - overlay.startTime;
        const duration = overlay.endTime - overlay.startTime;

        activeOverlays.push({
          ...overlay,
          elapsedTime,
          progress: duration > 0 ? elapsedTime / duration : 0,
        });
      }
    }

    return activeOverlays;
  }

  /**
   * Get active transition at the given time (if any)
   * Transitions occur when two sources overlap or are configured to crossfade
   */
  function getActiveTransition(time: number): ActiveTransition | null {
    if (transitionDuration <= 0) {
      return null;
    }

    const sources = sortedVideoSources.value;

    for (let i = 0; i < sources.length - 1; i++) {
      const sourceA = sources[i];
      const sourceB = sources[i + 1];

      // Check if there's a transition zone between these sources
      const transitionStart = sourceA.end_time - transitionDuration;
      const transitionEnd = sourceA.end_time;

      // Only if sources are adjacent (no gap)
      if (sourceB.start_time <= sourceA.end_time && time >= transitionStart && time < transitionEnd) {
        const progress = (time - transitionStart) / transitionDuration;

        return {
          type: 'crossfade', // Default transition type
          progress: Math.max(0, Math.min(1, progress)),
          sourceA,
          sourceB,
          duration: transitionDuration,
        };
      }
    }

    return null;
  }

  return {
    // Queries
    getActiveVideoSource,
    getVideoSourceTime,
    getActiveAudioTracks,
    getActiveOverlays,
    getActiveTransition,
    isInGap,
    getNextVideoSource,
    getPreviousVideoSource,

    // Precomputed
    sortedVideoSources,
    sortedAudioTracks,
  };
}
