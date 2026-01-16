import { ref, computed, watch, onUnmounted, type Ref, type ComputedRef } from 'vue';

/**
 * Timeline state interface - the data structure that drives playback
 */
export interface TimelineState {
  /** Total duration of the timeline in seconds */
  duration: number;
  /** Video sources on the timeline */
  videoSources: VideoSource[];
  /** Audio tracks on the timeline */
  audioTracks: AudioTrackInfo[];
}

/**
 * Video source on the timeline
 */
export interface VideoSource {
  id: string;
  /** Path to the video file */
  file_path: string;
  /** Start position on the timeline (seconds) */
  start_time: number;
  /** End position on the timeline (seconds) */
  end_time: number;
  /** Start position within the source video (trim start) */
  trim_start: number;
  /** End position within the source video (trim end), null = use full duration */
  trim_end: number | null;
  /** Original duration of the source video */
  original_duration: number;
}

/**
 * Audio track info for the timeline
 */
export interface AudioTrackInfo {
  id: string;
  filePath: string;
  startTime: number;
  endTime: number;
  volume: number;
  isMuted: boolean;
  fadeInDuration?: number;
  fadeOutDuration?: number;
}

/**
 * Playback engine options
 */
export interface PlaybackEngineOptions {
  /** Initial playback rate (default: 1.0) */
  initialPlaybackRate?: number;
  /** Callback when time updates */
  onTimeUpdate?: (time: number) => void;
  /** Callback when play state changes */
  onPlayStateChange?: (isPlaying: boolean) => void;
  /** Callback when playback reaches the end */
  onEnded?: () => void;
}

/**
 * Playback engine return type
 */
export interface PlaybackEngineReturn {
  // State (readonly)
  currentTime: Ref<number>;
  isPlaying: Readonly<Ref<boolean>>;
  playbackRate: Ref<number>;
  duration: ComputedRef<number>;

  // Controls
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  seekRelative: (delta: number) => void;
  setPlaybackRate: (rate: number) => void;
  goToStart: () => void;
  goToEnd: () => void;

  // Timeline management
  setTimeline: (timeline: TimelineState) => void;
  getTimeline: () => TimelineState;

  // Cleanup
  dispose: () => void;
}

/**
 * Master playback engine composable
 * 
 * This is the single source of truth for playback state.
 * It uses requestAnimationFrame to advance time when playing.
 * All other systems (video, audio, overlays) query this engine for the current time.
 * 
 * Key principles:
 * 1. Timeline is king - currentTime drives everything
 * 2. Pull, don't push - other systems query time, not push events
 * 3. Single source of truth - no duplicate state
 */
export function usePlaybackEngine(options: PlaybackEngineOptions = {}): PlaybackEngineReturn {
  const {
    initialPlaybackRate = 1.0,
    onTimeUpdate,
    onPlayStateChange,
    onEnded,
  } = options;

  // Core state
  const currentTime = ref(0);
  const isPlaying = ref(false);
  const playbackRate = ref(initialPlaybackRate);

  // Timeline state
  const timeline = ref<TimelineState>({
    duration: 0,
    videoSources: [],
    audioTracks: [],
  });

  // Computed duration from timeline
  const duration = computed(() => timeline.value.duration);

  // RAF loop state
  let rafId: number | null = null;
  let lastFrameTime: number = 0;

  /**
   * The core playback tick function
   * Called every animation frame when playing
   */
  function tick(timestamp: number) {
    if (!isPlaying.value) {
      rafId = null;
      return;
    }

    // Calculate delta time in seconds
    const deltaMs = timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    // Clamp delta to prevent huge jumps (e.g., after tab switch)
    const deltaSec = Math.min(deltaMs / 1000, 0.1);

    // Advance time
    const newTime = currentTime.value + deltaSec * playbackRate.value;

    // Check if we've reached the end
    if (newTime >= duration.value) {
      currentTime.value = duration.value;
      isPlaying.value = false;
      rafId = null;
      onTimeUpdate?.(currentTime.value);
      onEnded?.();
      onPlayStateChange?.(false);
      return;
    }

    // Update time
    currentTime.value = newTime;
    onTimeUpdate?.(newTime);

    // Schedule next frame
    rafId = requestAnimationFrame(tick);
  }

  /**
   * Start playback
   */
  function play() {
    if (isPlaying.value) return;

    // If at the end, restart from beginning
    if (currentTime.value >= duration.value && duration.value > 0) {
      currentTime.value = 0;
    }

    // Can't play if duration is 0
    if (duration.value <= 0) {
      console.warn('[PlaybackEngine] Cannot play: duration is 0');
      return;
    }

    isPlaying.value = true;
    lastFrameTime = performance.now();
    rafId = requestAnimationFrame(tick);
    onPlayStateChange?.(true);
  }

  /**
   * Pause playback
   */
  function pause() {
    if (!isPlaying.value) return;

    isPlaying.value = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    onPlayStateChange?.(false);
  }

  /**
   * Toggle play/pause
   */
  function togglePlay() {
    if (isPlaying.value) {
      pause();
    } else {
      play();
    }
  }

  /**
   * Seek to a specific time
   */
  function seek(time: number) {
    const clampedTime = Math.max(0, Math.min(time, duration.value));
    currentTime.value = clampedTime;
    onTimeUpdate?.(clampedTime);
  }

  /**
   * Seek relative to current position
   */
  function seekRelative(delta: number) {
    seek(currentTime.value + delta);
  }

  /**
   * Set playback rate
   */
  function setPlaybackRate(rate: number) {
    playbackRate.value = Math.max(0.1, Math.min(rate, 4.0));
  }

  /**
   * Go to start of timeline
   */
  function goToStart() {
    seek(0);
  }

  /**
   * Go to end of timeline
   */
  function goToEnd() {
    seek(duration.value);
  }

  /**
   * Set the timeline state
   */
  function setTimeline(newTimeline: TimelineState) {
    timeline.value = newTimeline;

    // Clamp current time to new duration
    if (currentTime.value > newTimeline.duration) {
      currentTime.value = Math.max(0, newTimeline.duration);
    }
  }

  /**
   * Get the current timeline state
   */
  function getTimeline(): TimelineState {
    return timeline.value;
  }

  /**
   * Cleanup
   */
  function dispose() {
    pause();
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  // Auto-cleanup on unmount
  onUnmounted(() => {
    dispose();
  });

  return {
    // State
    currentTime,
    isPlaying: isPlaying as Readonly<Ref<boolean>>,
    playbackRate,
    duration,

    // Controls
    play,
    pause,
    togglePlay,
    seek,
    seekRelative,
    setPlaybackRate,
    goToStart,
    goToEnd,

    // Timeline management
    setTimeline,
    getTimeline,

    // Cleanup
    dispose,
  };
}
