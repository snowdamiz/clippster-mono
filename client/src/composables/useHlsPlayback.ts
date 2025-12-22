import { ref, computed, onUnmounted } from 'vue';
import Hls from 'hls.js';

// Constants for playlist polling
const PLAYLIST_POLL_INTERVAL = 1000; // 1 second between checks
const PLAYLIST_POLL_MAX_ATTEMPTS = 60; // Max 60 seconds waiting for playlist
const PLAYLIST_SEGMENT_POLL_INTERVAL = 1000; // Wait for first segment after playlist exists
const PLAYLIST_SEGMENT_POLL_MAX_ATTEMPTS = 20; // Up to ~20s after playlist appears
const VIDEO_SERVER_PORT = 48276;

// Buffer recovery constants - optimized for 4-second segments
const BUFFER_STALL_RECOVERY_TIMEOUT = 4500; // 4.5 seconds before attempting recovery (> 1 segment)
const MAX_BUFFER_STALL_RETRIES = 3; // Max recovery attempts before seeking to live

// HLS Playback state
export interface HlsPlaybackState {
  // Playback
  isPlaying: boolean;
  isPaused: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;

  // Buffer state
  bufferedRanges: Array<{ start: number; end: number }>;
  isInitialized: boolean;

  // Live edge tracking
  liveEdgeTime: number;
  isAtLiveEdge: boolean;

  // Audio/Video
  isMuted: boolean;
  volume: number;

  // Errors
  error: string | null;

  // HLS specific
  isLive: boolean;
  latency: number;
}

// Configuration - optimized for 4-second segments
const LIVE_EDGE_THRESHOLD = 12; // seconds behind live to consider "at live edge" (3 segments)
const SAFE_SEEK_PADDING = 0.25; // Avoid seeking exactly to the start of first fragment

/**
 * Composable for HLS-based livestream playback with DVR support
 * Uses hls.js for playback, which handles all buffering, seeking, and live edge tracking
 */
export function useHlsPlayback() {
  // State
  const state = ref<HlsPlaybackState>({
    isPlaying: false,
    isPaused: false,
    isBuffering: true,
    currentTime: 0,
    duration: 0,
    bufferedRanges: [],
    isInitialized: false,
    liveEdgeTime: 0,
    isAtLiveEdge: true,
    isMuted: false,
    volume: 1,
    error: null,
    isLive: true,
    latency: 0,
  });

  // Internal refs
  let videoElement: HTMLVideoElement | null = null;
  let hls: Hls | null = null;
  let hlsUrl: string | null = null;
  let updateInterval: number | null = null;
  let isCleaningUp = false;
  let availableStartTime = 0; // Earliest known playable time from playlist/segments

  // Buffer stall recovery state
  let bufferStallStart: number | null = null;
  let bufferStallRetries = 0;
  let bufferStallRecoveryTimeout: number | null = null;

  // Computed
  const isAtLiveEdge = computed(() => {
    if (!state.value.isInitialized) return true;
    return state.value.liveEdgeTime - state.value.currentTime <= LIVE_EDGE_THRESHOLD;
  });

  /**
   * Generate HLS URL for the local server
   */
  function getHlsUrl(outputDir: string): string {
    const encodedDir = btoa(outputDir);
    return `http://127.0.0.1:${VIDEO_SERVER_PORT}/hls/${encodedDir}/playlist.m3u8.tmp`;
  }

  /**
   * Wait for the HLS playlist to become available
   */
  async function waitForPlaylist(url: string): Promise<boolean> {
    for (let attempt = 0; attempt < PLAYLIST_POLL_MAX_ATTEMPTS; attempt++) {
      if (isCleaningUp) return false;

      try {
        const response = await fetch(url, { method: 'GET', mode: 'cors' });
        if (response.ok) return true;
      } catch {
        // Network error - continue polling
      }

      await new Promise((resolve) => setTimeout(resolve, PLAYLIST_POLL_INTERVAL));
    }

    console.warn('[HlsPlayback] Playlist not available after max wait time');
    return false;
  }

  /**
   * Wait for the first segment to appear in the playlist
   */
  async function waitForFirstSegment(url: string): Promise<boolean> {
    for (let attempt = 0; attempt < PLAYLIST_SEGMENT_POLL_MAX_ATTEMPTS; attempt++) {
      if (isCleaningUp) return false;

      try {
        const response = await fetch(url, { method: 'GET', cache: 'no-store', mode: 'cors' });
        if (response.ok) {
          const text = await response.text();
          const segmentCount = (text.match(/#EXTINF:/g) || []).length;
          if (segmentCount > 0) return true;
        }
      } catch {
        // Network error - continue polling
      }

      await new Promise((resolve) => setTimeout(resolve, PLAYLIST_SEGMENT_POLL_INTERVAL));
    }

    return false;
  }

  /**
   * Initialize HLS playback
   */
  async function initialize(video: HTMLVideoElement, outputDir: string): Promise<boolean> {
    // Reset cleanup flag when starting new initialization
    isCleaningUp = false;

    // Skip if already initialized for this URL
    const newUrl = getHlsUrl(outputDir);
    if (hlsUrl === newUrl && videoElement === video && state.value.isInitialized) {
      return true;
    }

    // Clean up any existing state if switching streams
    if (hlsUrl && hlsUrl !== newUrl) {
      await cleanup();
    }

    videoElement = video;
    hlsUrl = newUrl;

    // Check if HLS.js is supported
    if (!Hls.isSupported()) {
      // Try native HLS support (Safari)
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        return initializeNative(video, hlsUrl);
      }

      state.value.error = 'HLS playback not supported in this browser';
      return false;
    }

    // Wait for the playlist to be available
    const playlistReady = await waitForPlaylist(hlsUrl);
    if (!playlistReady) {
      if (!isCleaningUp) {
        state.value.error = 'Playlist not available - recording may not have started';
      }
      return false;
    }

    // Ensure at least one segment exists
    await waitForFirstSegment(hlsUrl);

    try {
      // Create HLS instance with live streaming config optimized for DVR playback
      hls = new Hls({
        // Live streaming optimizations for 4-second segments
        // We use a larger buffer to ensure smooth playback and avoid stalling
        liveSyncDurationCount: 5, // Stay 5 segments (20s) behind live edge for safety
        // Do NOT auto-jump forward when far behind (e.g., paused DVR). Large value disables catch-up seeks.
        liveMaxLatencyDurationCount: Number.POSITIVE_INFINITY,
        liveDurationInfinity: true, // Enable DVR mode (infinite duration)
        liveBackBufferLength: 300, // Keep 5 minutes of back buffer for seeking

        // Standard latency mode for reliability
        lowLatencyMode: false, // Standard latency mode (more reliable)
        backBufferLength: 300, // 5 minutes back buffer
        maxBufferLength: 60, // Buffer 60 seconds ahead (15 segments)
        maxMaxBufferLength: 120, // Max buffer when bandwidth allows

        // Gap handling - critical for resolution changes that create gaps
        maxBufferHole: 4, // Allow up to 4 second gaps (1 segment)
        nudgeMaxRetry: 10, // Retry nudging past stalls
        maxStarvationDelay: 4, // Wait max 4s before seeking when starved
        highBufferWatchdogPeriod: 1, // Check for stalls every 1s

        // Performance - optimized for local playback
        enableWorker: true,
        fragLoadingTimeOut: 20000, // 20s timeout (allow time for file write)
        fragLoadingMaxRetry: 6, // More retries for local file system delays
        levelLoadingTimeOut: 10000,
        levelLoadingMaxRetry: 4,

        // Manifest loading - poll for live updates
        manifestLoadingTimeOut: 10000,
        manifestLoadingMaxRetry: 6,
        manifestLoadingRetryDelay: 1000, // 1s retry delay

        // Playlist refresh - poll for new segments
        levelLoadingRetryDelay: 1000,

        // Start at live edge but allow seeking back
        startPosition: -1, // -1 means start at live edge (but liveSyncDurationCount controls effective position)
      });

      // Set up HLS event handlers
      setupHlsEventHandlers(hls);

      // Set up video event handlers
      setupVideoEventHandlers(video);

      // Load source
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      // Start update interval
      startUpdateInterval();
      return true;
    } catch (error) {
      console.error('[HlsPlayback] Failed to initialize:', error);
      state.value.error = `Failed to initialize HLS: ${error}`;
      return false;
    }
  }

  /**
   * Initialize with native HLS support (Safari)
   */
  function initializeNative(video: HTMLVideoElement, url: string): boolean {
    try {
      video.src = url;
      setupVideoEventHandlers(video);
      startUpdateInterval();
      state.value.isInitialized = true;
      return true;
    } catch (error) {
      console.error('[HlsPlayback] Native HLS init failed:', error);
      state.value.error = `Native HLS init failed: ${error}`;
      return false;
    }
  }

  /**
   * Set up HLS.js event handlers
   */
  function setupHlsEventHandlers(hlsInstance: Hls) {
    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
      state.value.isInitialized = true;
      state.value.isBuffering = false;

      // Auto-play when manifest is ready
      if (videoElement) {
        videoElement.play().catch(() => {});
      }
    });

    hlsInstance.on(Hls.Events.LEVEL_LOADED, (event, data) => {
      const levelDetails = data.details;
      if (levelDetails) {
        state.value.isLive = levelDetails.live;
        state.value.duration = levelDetails.totalduration;
        state.value.liveEdgeTime = levelDetails.totalduration;

        // Track earliest fragment start to avoid seeking into missing media
        const firstFragment = levelDetails.fragments?.[0];
        if (firstFragment && typeof firstFragment.start === 'number') {
          availableStartTime = Math.max(0, firstFragment.start);
        }
      }
    });

    hlsInstance.on(Hls.Events.FRAG_LOADED, () => {
      updateBufferedRanges();
      if (hls?.liveSyncPosition) {
        state.value.liveEdgeTime = hls.liveSyncPosition;
      }
    });

    hlsInstance.on(Hls.Events.FRAG_BUFFERED, () => {
      updateBufferedRanges();
      state.value.isBuffering = false;
    });

    hlsInstance.on(Hls.Events.ERROR, (event, data) => {
      if (isCleaningUp) return;

      // Handle specific error types
      if (data.details === 'bufferStalledError') {
        handleBufferStall();
        return;
      }

      if (data.details === 'bufferSeekOverHole') {
        clearBufferStallRecovery();
        return;
      }

      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            hlsInstance.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hlsInstance.recoverMediaError();
            break;
          default:
            console.error('[HlsPlayback] Fatal error:', data.details);
            state.value.error = `HLS error: ${data.details}`;
            cleanup();
            break;
        }
      } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        hlsInstance.recoverMediaError();
      }
    });
  }

  /**
   * Handle buffer stall with recovery timeout
   */
  function handleBufferStall() {
    state.value.isBuffering = true;

    if (!bufferStallStart) {
      bufferStallStart = Date.now();

      if (bufferStallRecoveryTimeout) {
        clearTimeout(bufferStallRecoveryTimeout);
      }

      bufferStallRecoveryTimeout = window.setTimeout(() => {
        attemptBufferStallRecovery();
      }, BUFFER_STALL_RECOVERY_TIMEOUT);
    }
  }

  /**
   * Attempt to recover from buffer stall
   */
  function attemptBufferStallRecovery() {
    if (isCleaningUp || !hls || !videoElement) return;

    bufferStallRetries++;

    if (bufferStallRetries >= MAX_BUFFER_STALL_RETRIES) {
      const resumeTime = videoElement.currentTime;
      hls.stopLoad();
      hls.startLoad();
      if (!Number.isNaN(resumeTime)) {
        videoElement.currentTime = resumeTime;
      }
      clearBufferStallRecovery();
      return;
    }

    if (bufferStallRetries === 1) {
      const currentTime = videoElement.currentTime;
      const buffered = videoElement.buffered;

      for (let i = 0; i < buffered.length; i++) {
        if (buffered.start(i) > currentTime) {
          videoElement.currentTime = buffered.start(i) + 0.1;
          break;
        }
      }

      if (videoElement.currentTime === currentTime) {
        videoElement.currentTime = currentTime + 0.5;
      }
    } else if (bufferStallRetries === 2) {
      hls.recoverMediaError();
    } else {
      hls.startLoad();
    }

    bufferStallRecoveryTimeout = window.setTimeout(() => {
      if (state.value.isBuffering) {
        attemptBufferStallRecovery();
      }
    }, BUFFER_STALL_RECOVERY_TIMEOUT);
  }

  /**
   * Clear buffer stall recovery state
   */
  function clearBufferStallRecovery() {
    bufferStallStart = null;
    bufferStallRetries = 0;
    if (bufferStallRecoveryTimeout) {
      clearTimeout(bufferStallRecoveryTimeout);
      bufferStallRecoveryTimeout = null;
    }
  }

  /**
   * Set up video element event handlers
   */
  function setupVideoEventHandlers(video: HTMLVideoElement) {
    video.addEventListener('playing', () => {
      if (isCleaningUp) return;
      state.value.isPlaying = true;
      state.value.isPaused = false;
      state.value.isBuffering = false;
      clearBufferStallRecovery();
    });

    video.addEventListener('pause', () => {
      if (isCleaningUp) return;
      state.value.isPlaying = false;
      state.value.isPaused = true;
    });

    video.addEventListener('waiting', () => {
      if (isCleaningUp) return;
      state.value.isBuffering = true;
      handleBufferStall();
    });

    video.addEventListener('canplay', () => {
      if (isCleaningUp) return;
      state.value.isBuffering = false;
      clearBufferStallRecovery();
    });

    video.addEventListener('timeupdate', () => {
      if (isCleaningUp) return;
      state.value.currentTime = video.currentTime;
      state.value.isAtLiveEdge = isAtLiveEdge.value;

      if (state.value.isLive && hls?.liveSyncPosition) {
        state.value.latency = hls.liveSyncPosition - video.currentTime;
      }
    });

    video.addEventListener('seeked', () => {
      if (isCleaningUp) return;
      state.value.currentTime = video.currentTime;
      clearBufferStallRecovery();
    });

    video.addEventListener('error', (event) => {
      if (isCleaningUp) return;
      console.error('[HlsPlayback] Video error:', event);
      state.value.error = 'Video playback error';
    });

    video.addEventListener('durationchange', () => {
      if (isCleaningUp) return;
      if (video.duration && isFinite(video.duration)) {
        state.value.duration = video.duration;
      }
    });
  }

  /**
   * Start periodic state update interval
   */
  function startUpdateInterval() {
    if (updateInterval) clearInterval(updateInterval);

    updateInterval = window.setInterval(() => {
      if (videoElement) {
        state.value.currentTime = videoElement.currentTime;
        updateBufferedRanges();

        // Update live edge from HLS
        if (hls?.liveSyncPosition) {
          state.value.liveEdgeTime = hls.liveSyncPosition;
        }

        state.value.isAtLiveEdge = isAtLiveEdge.value;
      }
    }, 250);
  }

  /**
   * Update buffered ranges from video element
   */
  function updateBufferedRanges() {
    if (!videoElement) return;

    const ranges: Array<{ start: number; end: number }> = [];
    const buffered = videoElement.buffered;

    for (let i = 0; i < buffered.length; i++) {
      ranges.push({
        start: buffered.start(i),
        end: buffered.end(i),
      });
    }

    state.value.bufferedRanges = ranges;
  }

  /**
   * Seek to a specific time
   */
  async function seek(time: number) {
    if (!videoElement || !state.value.isInitialized) return;

    const bufferedStart = state.value.bufferedRanges.length
      ? state.value.bufferedRanges[0].start
      : 0;
    const minAvailable = Math.max(availableStartTime, bufferedStart);
    const safeFloor = minAvailable > 0 ? minAvailable + SAFE_SEEK_PADDING : 0;
    const liveEdge = state.value.liveEdgeTime || state.value.duration || 0;
    const clampedTime = Math.max(safeFloor, Math.min(time, liveEdge));

    videoElement.currentTime = clampedTime;
    state.value.currentTime = clampedTime;
    state.value.isAtLiveEdge = clampedTime >= state.value.liveEdgeTime - LIVE_EDGE_THRESHOLD;
  }

  /**
   * Seek to live edge
   */
  async function seekToLive() {
    if (!videoElement || !state.value.isInitialized) return;

    if (hls?.liveSyncPosition && hls.liveSyncPosition > 0) {
      videoElement.currentTime = hls.liveSyncPosition;
    } else if (state.value.duration > 0) {
      videoElement.currentTime = Math.max(0, state.value.duration - 2);
    }

    state.value.isAtLiveEdge = true;
  }

  /**
   * Force refresh the HLS playlist to get latest segments
   */
  function refreshPlaylist(seekPosition?: number) {
    if (!hls || !state.value.isInitialized) return;
    
    const target = typeof seekPosition === 'number' ? seekPosition : videoElement?.currentTime ?? 0;
    hls.stopLoad();
    hls.startLoad(Math.max(target, 0));
  }

  /**
   * Play
   */
  async function play() {
    if (!videoElement) return;

    try {
      await videoElement.play();
    } catch {
      // Autoplay may be blocked
    }
  }

  /**
   * Pause
   */
  function pause() {
    if (!videoElement) return;
    videoElement.pause();
  }

  /**
   * Toggle play/pause
   */
  async function togglePlayPause() {
    if (state.value.isPlaying) {
      pause();
    } else {
      await play();
    }
  }

  /**
   * Set volume
   */
  function setVolume(volume: number) {
    state.value.volume = Math.max(0, Math.min(1, volume));
    if (videoElement) {
      videoElement.volume = state.value.volume;
    }
  }

  /**
   * Set muted
   */
  function setMuted(muted: boolean) {
    state.value.isMuted = muted;
    if (videoElement) {
      videoElement.muted = muted;
    }
  }

  /**
   * Toggle mute
   */
  function toggleMute() {
    setMuted(!state.value.isMuted);
  }

  /**
   * Clean up resources
   */
  async function cleanup() {
    if (isCleaningUp) return;

    isCleaningUp = true;

    // Clear buffer stall recovery state
    clearBufferStallRecovery();

    // Clear interval
    if (updateInterval) {
      clearInterval(updateInterval);
      updateInterval = null;
    }

    // Destroy HLS instance
    if (hls) {
      hls.destroy();
      hls = null;
    }

    // Clean up video element
    if (videoElement) {
      videoElement.pause();
      videoElement.src = '';
      videoElement.load();
      videoElement = null;
    }

    // Reset state
    hlsUrl = null;
    availableStartTime = 0;

    state.value = {
      isPlaying: false,
      isPaused: false,
      isBuffering: true,
      currentTime: 0,
      duration: 0,
      bufferedRanges: [],
      isInitialized: false,
      liveEdgeTime: 0,
      isAtLiveEdge: true,
      isMuted: false,
      volume: 1,
      error: null,
      isLive: true,
      latency: 0,
    };
  }

  // Cleanup on unmount
  onUnmounted(() => {
    cleanup();
  });

  return {
    // State
    state,

    // Computed
    isAtLiveEdge,

    // Methods
    initialize,
    seek,
    seekToLive,
    play,
    pause,
    togglePlayPause,
    setVolume,
    setMuted,
    toggleMute,
    cleanup,
    refreshPlaylist,

    // Utility
    getHlsUrl,
  };
}
