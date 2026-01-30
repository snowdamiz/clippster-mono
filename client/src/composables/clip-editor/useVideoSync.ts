import { computed, watch, type Ref, type ComputedRef } from 'vue';
import type { VideoSource } from './useVideoSourceTime';
import type { ActiveAudioTrack as TimelineActiveAudioTrack } from '@/composables/useTimelineRenderer';

/**
 * Re-export ActiveAudioTrack for convenience
 */
export type ActiveAudioTrack = TimelineActiveAudioTrack;

/**
 * Audio mixer interface for syncing audio playback
 */
export interface AudioMixerInterface {
  syncToTime: (time: number, activeTracks: ActiveAudioTrack[], isPlaying: boolean) => void;
}

/**
 * Timeline renderer interface for getting active audio tracks
 */
export interface TimelineRendererInterface {
  getActiveAudioTracks: (time: number) => ActiveAudioTrack[];
}

/**
 * Options for useVideoSync
 */
export interface VideoSyncOptions {
  /** Ref to the video element */
  videoRef: Ref<HTMLVideoElement | null>;
  /** Current timeline time */
  currentTime: Ref<number>;
  /** Whether playback is active */
  isPlaying: Ref<boolean>;
  /** Total video content duration (without audio-only portion) */
  videoContentDuration: ComputedRef<number>;
  /** Fallback duration */
  duration: ComputedRef<number>;
  /** Video sources for time conversion */
  videoSources: ComputedRef<VideoSource[]>;
  /** Function to convert timeline time to video source time */
  getVideoSourceTime: (time: number) => number;
  /** Currently loaded video source URL (to track which source is active) */
  currentVideoSrc?: Ref<string | null>;
  /** Audio mixer for syncing audio tracks */
  audioMixer?: AudioMixerInterface;
  /** Timeline renderer for getting active audio tracks */
  timelineRenderer?: TimelineRendererInterface;
  /** Callback when play is requested */
  onPlay?: () => void;
  /** Callback when pause is requested */
  onPause?: () => void;
}

/**
 * Return type for useVideoSync
 */
export interface VideoSyncReturn {
  /** Whether current time is past the video content (audio-only portion) */
  isAfterVideoEnd: ComputedRef<boolean>;
}

/**
 * useVideoSync - Video element synchronization with timeline
 *
 * Extracts complex video synchronization logic from ClipEditorPreview.vue:
 * - Watching currentTime to sync video element with trim offset
 * - Handling "past video end" state for audio-only playback
 * - Pre-play seeking to correct position
 * - Audio mixer synchronization
 *
 * Usage:
 * ```ts
 * const { isAfterVideoEnd } = useVideoSync({
 *   videoRef,
 *   currentTime: toRef(props, 'currentTime'),
 *   isPlaying: toRef(props, 'isPlaying'),
 *   videoContentDuration: computed(() => props.videoContentDuration || 0),
 *   duration: computed(() => props.duration || 0),
 *   videoSources: computed(() => props.videoSources || []),
 *   getVideoSourceTime,
 *   audioMixer,
 *   timelineRenderer,
 * });
 * ```
 */
export function useVideoSync(options: VideoSyncOptions): VideoSyncReturn {
  const {
    videoRef,
    currentTime,
    isPlaying,
    videoContentDuration,
    duration,
    videoSources,
    getVideoSourceTime,
    currentVideoSrc,
    audioMixer,
    timelineRenderer,
  } = options;

  // Track which source is currently loaded in the video element
  // Initialize immediately with the source at current time
  function updateCurrentlyLoadedSource() {
    const sources = videoSources.value;
    if (!sources || sources.length === 0) {
      return null;
    }

    // Find source at current timeline position
    for (const source of sources) {
      if (currentTime.value >= source.start_time && currentTime.value < source.end_time) {
        return source;
      }
    }

    // If not found, use first source
    return sources[0] || null;
  }

  let currentlyLoadedSource: VideoSource | null = updateCurrentlyLoadedSource();

  // Update currently loaded source when video src changes
  if (currentVideoSrc) {
    watch(currentVideoSrc, () => {
      currentlyLoadedSource = updateCurrentlyLoadedSource();
      console.log(`[useVideoSync] Video source changed, loaded source:`, currentlyLoadedSource?.id);
    }, { immediate: true });
  }

  /**
   * Get effective video duration (videoContentDuration or fallback to duration)
   */
  function getEffectiveVideoDuration(): number {
    return videoContentDuration.value || duration.value || 0;
  }

  /**
   * Whether current time is past the video content (audio-only portion)
   */
  const isAfterVideoEnd = computed(() => {
    return currentTime.value > getEffectiveVideoDuration();
  });

  /**
   * Sync video element with current time
   */
  watch(currentTime, (newTime) => {
    const video = videoRef.value;
    if (!video) return;

    const videoDur = getEffectiveVideoDuration();

    // If we're past the video content, just pause and don't touch currentTime
    if (newTime > videoDur) {
      if (!video.paused) {
        video.pause();
      }
      // Don't set currentTime - let it stay wherever it naturally ended
      // This prevents the seek loop
    } else {
      // Find which source should be active at this timeline time
      const sources = videoSources.value;
      let targetSource: VideoSource | null = null;
      
      for (const source of sources) {
        if (newTime >= source.start_time && newTime < source.end_time) {
          targetSource = source;
          break;
        }
      }

      // Only seek if the target source matches the currently loaded source
      // This prevents seeking to wrong timestamps during source transitions
      // Allow seeking when currentlyLoadedSource is null (initial state)
      if (targetSource && (!currentlyLoadedSource || targetSource.id === currentlyLoadedSource.id)) {
        // Calculate the actual video source time with trim offset
        const offsetInSource = newTime - targetSource.start_time;
        const videoSourceTime = targetSource.trim_start + offsetInSource;

        // Normal video sync when within video duration
        if (Math.abs(video.currentTime - videoSourceTime) > 0.1) {
          console.log(`[useVideoSync] Seeking video: timeline=${newTime.toFixed(2)}s -> source=${videoSourceTime.toFixed(2)}s`);
          video.currentTime = videoSourceTime;
        }
      }
      // If sources don't match, let the video src change handler deal with it
    }

    // Sync audio mixer with current time
    if (audioMixer && timelineRenderer) {
      const activeTracks = timelineRenderer.getActiveAudioTracks(newTime);
      audioMixer.syncToTime(newTime, activeTracks, isPlaying.value);
    }
  });

  /**
   * Sync video playback state with isPlaying
   */
  watch(isPlaying, (playing) => {
    const video = videoRef.value;
    if (!video) return;

    const videoDur = getEffectiveVideoDuration();

    // Only play video if we're within the video content duration
    if (playing && currentTime.value <= videoDur) {
      // Find which source should be active at this timeline time
      const sources = videoSources.value;
      let targetSource: VideoSource | null = null;
      
      for (const source of sources) {
        if (currentTime.value >= source.start_time && currentTime.value < source.end_time) {
          targetSource = source;
          break;
        }
      }

      // Only seek if the target source matches the currently loaded source
      // Allow seeking when currentlyLoadedSource is null (initial state)
      if (targetSource && (!currentlyLoadedSource || targetSource.id === currentlyLoadedSource.id)) {
        // Ensure video is at correct source time before playing
        const offsetInSource = currentTime.value - targetSource.start_time;
        const videoSourceTime = targetSource.trim_start + offsetInSource;
        
        if (Math.abs(video.currentTime - videoSourceTime) > 0.1) {
          console.log(`[useVideoSync] Pre-play seek: timeline=${currentTime.value.toFixed(2)}s -> source=${videoSourceTime.toFixed(2)}s`);
          video.currentTime = videoSourceTime;
        }
      }

      video.play().catch(err => {
        console.error('[useVideoSync] Failed to play:', err);
      });
    } else {
      video.pause();
    }

    // Sync audio playback state
    if (audioMixer && timelineRenderer) {
      const activeTracks = timelineRenderer.getActiveAudioTracks(currentTime.value);
      audioMixer.syncToTime(currentTime.value, activeTracks, playing);
    }
  });

  return {
    isAfterVideoEnd,
  };
}
