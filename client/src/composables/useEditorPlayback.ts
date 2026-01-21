import { ref, computed, watch, onUnmounted, type Ref, type ComputedRef } from 'vue';
import { usePlaybackEngine, type TimelineState, type VideoSource, type AudioTrackInfo } from './usePlaybackEngine';
import { useTimelineRenderer, type ActiveVideoSource, type ActiveAudioTrack } from './useTimelineRenderer';
import { useAudioMixer } from './useAudioMixer';
import type { VideoEditorSource, AudioTrack } from '@/types';

export type { VideoEditorSource };

// Re-export AudioTrack as EditorAudioTrack for compatibility
export type EditorAudioTrack = AudioTrack;

/**
 * Editor playback options
 */
export interface EditorPlaybackOptions {
  videoServerPort: Ref<number | null>;
  videoSources: Ref<VideoEditorSource[]>;
  audioTracks: Ref<EditorAudioTrack[]>;
  onTimeUpdate?: (time: number) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  onSourceChange?: (source: ActiveVideoSource | null) => void;
}

/**
 * Editor playback return type
 */
export interface EditorPlaybackReturn {
  // State
  currentTime: Ref<number>;
  isPlaying: Readonly<Ref<boolean>>;
  playbackRate: Ref<number>;
  duration: ComputedRef<number>;
  shouldMuteVideo: ComputedRef<boolean>;

  // Active content
  activeSource: ComputedRef<ActiveVideoSource | null>;
  nextSource: ComputedRef<VideoSource | null>;
  isInGap: ComputedRef<boolean>;
  activeAudioTracks: ComputedRef<ActiveAudioTrack[]>;

  // Video URL helpers
  activeVideoUrl: ComputedRef<string | null>;
  preloadVideoUrl: ComputedRef<string | null>;

  // Controls
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  seekRelative: (delta: number) => void;
  setPlaybackRate: (rate: number) => void;
  goToStart: () => void;
  goToEnd: () => void;

  // Video element management
  setVideoElement: (video: HTMLVideoElement | null) => void;
  syncVideoElement: () => void;

  // Audio
  initializeAudio: () => Promise<void>;
  setMasterVolume: (volume: number) => void;
  setMuted: (muted: boolean) => void;
  masterVolume: Ref<number>;
  isMuted: Ref<boolean>;

  // Cleanup
  dispose: () => void;
}

/**
 * Unified editor playback composable
 * 
 * Combines PlaybackEngine, TimelineRenderer, and AudioMixer into a single
 * easy-to-use interface for the video editor.
 */
export function useEditorPlayback(options: EditorPlaybackOptions): EditorPlaybackReturn {
  const {
    videoServerPort,
    videoSources,
    audioTracks,
    onTimeUpdate,
    onPlayStateChange,
    onSourceChange,
  } = options;

  // Video element reference
  let videoElement: HTMLVideoElement | null = null;
  const SYNC_TOLERANCE = 0.15; // 150ms drift tolerance

  // Convert video sources to timeline format
  const timelineVideoSources = computed<VideoSource[]>(() => {
    const sources = videoSources.value;
    console.log('[useEditorPlayback] Converting video sources:', sources.length, 'sources');
    return sources.map((s) => ({
      id: s.id,
      file_path: s.source_path,
      start_time: s.start_time,
      end_time: s.end_time,
      trim_start: s.trim_start,
      trim_end: s.trim_end,
      original_duration: s.source_duration ?? (s.end_time - s.start_time),
    }));
  });

  // Convert audio tracks to timeline format
  const timelineAudioTracks = computed<AudioTrackInfo[]>(() => {
    // Check if any track is soloed
    const hasSolo = audioTracks.value.some((t) => t.isSolo);

    return audioTracks.value
      .filter((t) => !t.isMuted && (!hasSolo || t.isSolo))
      .map((t) => ({
        id: t.id,
        filePath: buildAudioUrl(t.filePath),
        startTime: t.startTime,
        endTime: t.endTime,
        volume: t.volume,
        isMuted: t.isMuted,
        fadeInDuration: t.fadeIn,
        fadeOutDuration: t.fadeOut,
      }));
  });

  // Compute timeline duration from sources
  const timelineDuration = computed(() => {
    if (timelineVideoSources.value.length === 0) return 0;
    return Math.max(...timelineVideoSources.value.map((s) => s.end_time));
  });

  // Timeline state (reactive)
  const timeline = computed<TimelineState>(() => ({
    duration: timelineDuration.value,
    videoSources: timelineVideoSources.value,
    audioTracks: timelineAudioTracks.value,
  }));

  // Initialize playback engine
  const engine = usePlaybackEngine({
    onTimeUpdate: (time) => {
      onTimeUpdate?.(time);
      syncVideoToTimeline();
      syncAudioToTimeline();
    },
    onPlayStateChange: (playing) => {
      onPlayStateChange?.(playing);
      if (videoElement) {
        if (playing && videoElement.paused && !isInGap.value) {
          videoElement.play().catch(() => {});
        } else if (!playing && !videoElement.paused) {
          videoElement.pause();
        }
      }
    },
  });

  // Initialize timeline renderer
  const renderer = useTimelineRenderer(timeline);

  // Initialize audio mixer
  const mixer = useAudioMixer();

  // Update engine timeline when sources change
  watch(
    timeline,
    (newTimeline) => {
      engine.setTimeline(newTimeline);
    },
    { immediate: true, deep: true }
  );

  // Computed: active video source at current time
  const activeSource = computed(() => {
    const source = renderer.getActiveVideoSource(engine.currentTime.value);
    return source;
  });

  // Computed: next video source (for preloading)
  // Preload when within 2 seconds of the end of current segment
  const PRELOAD_THRESHOLD = 2.0;
  const nextSource = computed(() => {
    const currentTime = engine.currentTime.value;
    const current = activeSource.value;
    
    // If we're in a segment and approaching its end, preload the next one
    if (current && current.timeRemaining <= PRELOAD_THRESHOLD) {
      return renderer.getNextVideoSource(current.end_time - 0.01);
    }
    
    // Also preload if we're in a gap approaching a segment
    if (renderer.isInGap(currentTime)) {
      return renderer.getNextVideoSource(currentTime);
    }
    
    return null;
  });

  // Computed: is current time in a gap
  const isInGap = computed(() => {
    return renderer.isInGap(engine.currentTime.value);
  });

  // Computed: active audio tracks
  const activeAudioTracks = computed(() => {
    return renderer.getActiveAudioTracks(engine.currentTime.value);
  });

  // Computed: should mute video (only when there are ACTIVE extracted audio tracks at current time)
  const shouldMuteVideo = computed(() => {
    const currentTime = engine.currentTime.value;
    // Check if any active audio track is linked to a video source (extracted audio)
    const hasActiveExtracted = activeAudioTracks.value.some(activeTrack => {
      // Find the original track to check linkedSourceId
      const originalTrack = audioTracks.value.find(t => t.id === activeTrack.id);
      return originalTrack?.linkedSourceId !== undefined;
    });
    return hasActiveExtracted;
  });

  // Track source changes
  let lastSourceId: string | null = null;
  watch(activeSource, (source) => {
    if (source?.id !== lastSourceId) {
      lastSourceId = source?.id ?? null;
      onSourceChange?.(source);
    }
  });


  /**
   * Build video URL from file path
   */
  function buildVideoUrl(filePath: string): string {
    if (!videoServerPort.value) return '';
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      return filePath;
    }
    const encodedPath = btoa(unescape(encodeURIComponent(filePath)));
    return `http://localhost:${videoServerPort.value}/video/${encodedPath}`;
  }

  /**
   * Build audio URL from file path
   */
  function buildAudioUrl(filePath: string): string {
    if (!videoServerPort.value) return filePath;
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      return filePath;
    }
    const encodedPath = btoa(unescape(encodeURIComponent(filePath)));
    return `http://localhost:${videoServerPort.value}/video/${encodedPath}`;
  }

  // Computed: active video URL
  const activeVideoUrl = computed(() => {
    const source = activeSource.value;
    if (!source) return null;
    return buildVideoUrl(source.file_path);
  });

  // Computed: preload video URL
  const preloadVideoUrl = computed(() => {
    const source = nextSource.value;
    if (!source) return null;
    return buildVideoUrl(source.file_path);
  });

  /**
   * Set the video element to sync with
   */
  function setVideoElement(video: HTMLVideoElement | null): void {
    videoElement = video;
  }

  // Large drift threshold - if drift exceeds this, it's a user-initiated seek (scrubbing)
  const LARGE_DRIFT_THRESHOLD = 0.5;

  /**
   * Sync video element to current timeline position
   */
  function syncVideoToTimeline(force: boolean = false): void {
    if (!videoElement) return;

    const source = activeSource.value;

    if (!source || isInGap.value) {
      // In a gap - pause video
      if (!videoElement.paused) {
        videoElement.pause();
      }
      return;
    }

    // Check if we need to change video source
    const currentUrl = buildVideoUrl(source.file_path);
    if (videoElement.src !== currentUrl) {
      videoElement.src = currentUrl;
      videoElement.load();
    }

    const drift = Math.abs(videoElement.currentTime - source.videoTime);
    
    // Large drift = user scrubbed the playhead, always sync immediately
    const isUserSeek = drift > LARGE_DRIFT_THRESHOLD;

    if (!force && !isUserSeek) {
      // Small drift - only sync if video is ready and not seeking
      if (videoElement.seeking || videoElement.readyState < 3) {
        return;
      }
      
      // Only sync if drift exceeds small tolerance
      if (drift <= SYNC_TOLERANCE) {
        return;
      }
    }

    videoElement.currentTime = source.videoTime;

    // Sync play state
    if (engine.isPlaying.value && videoElement.paused && videoElement.readyState >= 2) {
      videoElement.play().catch(() => {});
    }
  }

  /**
   * Sync audio tracks to current timeline position
   */
  function syncAudioToTimeline(): void {
    mixer.syncToTime(
      engine.currentTime.value,
      activeAudioTracks.value,
      engine.isPlaying.value
    );
  }

  /**
   * Initialize audio system
   */
  async function initializeAudio(): Promise<void> {
    await mixer.initialize();
  }

  // Cleanup
  function dispose(): void {
    engine.dispose();
    mixer.dispose();
  }

  // Wrap play/pause/togglePlay to ensure video is synced before playback starts
  function play() {
    // Sync video element to current timeline position BEFORE starting playback
    // This ensures video starts from the correct position (e.g., where playhead was moved to)
    // Force sync here since user explicitly pressed play
    syncVideoToTimeline(true);
    engine.play();
  }

  function pause() {
    engine.pause();
    // CRITICAL: Sync audio immediately when pausing to stop audio playback
    // Without this, audio continues playing because syncAudioToTimeline is only called in the animation loop
    syncAudioToTimeline();
  }

  function togglePlay() {
    if (engine.isPlaying.value) {
      pause();
    } else {
      play();
    }
  }

  onUnmounted(() => {
    dispose();
  });

  return {
    // State (from engine)
    currentTime: engine.currentTime,
    isPlaying: engine.isPlaying,
    playbackRate: engine.playbackRate,
    duration: engine.duration,
    shouldMuteVideo,

    // Active content
    activeSource,
    nextSource,
    isInGap,
    activeAudioTracks,

    // Video URL helpers
    activeVideoUrl,
    preloadVideoUrl,

    // Controls (wrapped to sync video before play)
    play,
    pause,
    togglePlay,
    seek: engine.seek,
    seekRelative: engine.seekRelative,
    setPlaybackRate: engine.setPlaybackRate,
    goToStart: engine.goToStart,
    goToEnd: engine.goToEnd,

    // Video element management
    setVideoElement,
    syncVideoElement: syncVideoToTimeline,

    // Audio (from mixer)
    initializeAudio,
    setMasterVolume: mixer.setMasterVolume,
    setMuted: mixer.setMuted,
    masterVolume: mixer.masterVolume,
    isMuted: mixer.isMuted,

    // Cleanup
    dispose,
  };
}
