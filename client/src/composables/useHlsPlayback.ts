import { ref, computed, onUnmounted } from 'vue';
import Hls from 'hls.js';

// Constants for playlist polling
const PLAYLIST_POLL_INTERVAL = 1000; // 1 second between checks
const PLAYLIST_POLL_MAX_ATTEMPTS = 60; // Max 60 seconds waiting for playlist
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
    // Base64 encode the output directory path
    const encodedDir = btoa(outputDir);
    return `http://127.0.0.1:${VIDEO_SERVER_PORT}/hls/${encodedDir}/playlist.m3u8`;
  }

  /**
   * Wait for the HLS playlist to become available
   * The recorder needs time to create the first segment before the playlist exists
   */
  async function waitForPlaylist(url: string): Promise<boolean> {
    console.log('[HlsPlayback] Waiting for playlist to be available...');

    for (let attempt = 0; attempt < PLAYLIST_POLL_MAX_ATTEMPTS; attempt++) {
      if (isCleaningUp) {
        console.log('[HlsPlayback] Cleanup requested while waiting for playlist');
        return false;
      }

      try {
        const response = await fetch(url, { method: 'HEAD' });
        if (response.ok) {
          console.log(`[HlsPlayback] Playlist available after ${attempt + 1} attempts`);
          return true;
        }
      } catch (e) {
        // Ignore fetch errors, keep polling
      }

      // Wait before next attempt
      await new Promise((resolve) => setTimeout(resolve, PLAYLIST_POLL_INTERVAL));

      // Log progress every 5 seconds
      if ((attempt + 1) % 5 === 0) {
        console.log(`[HlsPlayback] Still waiting for playlist... (${attempt + 1}s)`);
      }
    }

    console.error('[HlsPlayback] Playlist not available after maximum wait time');
    return false;
  }

  /**
   * Initialize HLS playback
   */
  async function initialize(video: HTMLVideoElement, outputDir: string): Promise<boolean> {
    console.log('[HlsPlayback] Initializing for directory:', outputDir);

    // Reset cleanup flag when starting new initialization
    isCleaningUp = false;

    // Skip if already initialized for this URL
    const newUrl = getHlsUrl(outputDir);
    if (hlsUrl === newUrl && videoElement === video && state.value.isInitialized) {
      console.log('[HlsPlayback] Already initialized for this stream, skipping');
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
        console.log('[HlsPlayback] Using native HLS support');
        return initializeNative(video, hlsUrl);
      }

      state.value.error = 'HLS playback not supported in this browser';
      console.error('[HlsPlayback]', state.value.error);
      return false;
    }

    // Wait for the playlist to be available (recorder needs time to create first segment)
    const playlistReady = await waitForPlaylist(hlsUrl);
    if (!playlistReady) {
      if (!isCleaningUp) {
        state.value.error = 'Playlist not available - recording may not have started';
      }
      return false;
    }

    try {
      // Create HLS instance with live streaming config optimized for 4-second segments
      hls = new Hls({
        // Live streaming optimizations for 4-second segments
        // With 4s segments, 3 segments = 12 seconds buffer for stable playback
        liveSyncDurationCount: 3, // Stay 3 segments (12s) behind live edge
        liveMaxLatencyDurationCount: 5, // Max 5 segments (20s) behind before catching up
        liveDurationInfinity: true, // Enable DVR mode (infinite duration)
        liveBackBufferLength: 300, // Keep 5 minutes of back buffer for seeking

        // Standard latency mode for reliability
        lowLatencyMode: false, // Standard latency mode (more reliable)
        backBufferLength: 300, // 5 minutes back buffer
        maxBufferLength: 20, // Buffer 20 seconds ahead (5 segments)
        maxMaxBufferLength: 40, // Max buffer when bandwidth allows

        // Gap handling - critical for resolution changes that create gaps
        maxBufferHole: 2, // Allow up to 2 second gaps in buffer
        maxSeekHole: 5, // Seek over gaps up to 5 seconds
        nudgeMaxRetry: 5, // Retry nudging past stalls up to 5 times
        maxStarvationDelay: 4, // Wait max 4s before seeking when starved
        highBufferWatchdogPeriod: 2, // Check for stalls every 2s when buffer is full

        // Performance - optimized for local playback
        enableWorker: true,
        fragLoadingTimeOut: 10000, // 10s timeout (local files load fast)
        fragLoadingMaxRetry: 3, // Fewer retries needed for local
        levelLoadingTimeOut: 5000,
        levelLoadingMaxRetry: 3,

        // Manifest loading - poll for live updates
        manifestLoadingTimeOut: 5000,
        manifestLoadingMaxRetry: 4,
        manifestLoadingRetryDelay: 1000, // 1s retry delay

        // Playlist refresh - poll for new segments
        levelLoadingRetryDelay: 1000,

        // Start at live edge but allow seeking back
        startPosition: -1, // -1 means start at live edge
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

      console.log('[HlsPlayback] HLS.js initialized');
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
      console.log('[HlsPlayback] Native HLS initialized');
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
    hlsInstance.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
      console.log('[HlsPlayback] Manifest parsed, levels:', data.levels.length);
      state.value.isInitialized = true;
      state.value.isBuffering = false;

      // Auto-play when manifest is ready
      if (videoElement) {
        videoElement.play().catch((e) => {
          console.log('[HlsPlayback] Autoplay blocked:', e);
        });
      }
    });

    hlsInstance.on(Hls.Events.LEVEL_LOADED, (event, data) => {
      const levelDetails = data.details;
      if (levelDetails) {
        // Update duration and live edge
        state.value.isLive = levelDetails.live;

        if (levelDetails.live) {
          // For live streams, duration grows as segments arrive
          state.value.duration = levelDetails.totalduration;
          state.value.liveEdgeTime = levelDetails.totalduration;
        } else {
          state.value.duration = levelDetails.totalduration;
          state.value.liveEdgeTime = levelDetails.totalduration;
        }
      }
    });

    hlsInstance.on(Hls.Events.FRAG_LOADED, (event, data) => {
      // Update buffered state when fragment loads
      updateBufferedRanges();

      // Update live edge time
      if (hls?.liveSyncPosition) {
        state.value.liveEdgeTime = hls.liveSyncPosition;
      }
    });

    hlsInstance.on(Hls.Events.FRAG_BUFFERED, (event, data) => {
      updateBufferedRanges();
      state.value.isBuffering = false;
    });

    hlsInstance.on(Hls.Events.ERROR, (event, data) => {
      if (isCleaningUp) return;

      console.warn('[HlsPlayback] HLS error:', data.type, data.details);

      // Handle specific error types
      if (data.details === 'bufferStalledError') {
        handleBufferStall();
        return;
      }

      if (data.details === 'bufferSeekOverHole') {
        console.log(
          '[HlsPlayback] Seeking over buffer hole - this is normal during resolution changes'
        );
        // Clear stall state since we're making progress
        clearBufferStallRecovery();
        return;
      }

      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            console.log('[HlsPlayback] Network error, attempting recovery...');
            hlsInstance.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.log('[HlsPlayback] Media error, attempting recovery...');
            hlsInstance.recoverMediaError();
            break;
          default:
            console.error('[HlsPlayback] Fatal error, cannot recover');
            state.value.error = `HLS error: ${data.details}`;
            cleanup();
            break;
        }
      } else {
        // Non-fatal media errors can often be recovered by seeking
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          console.log('[HlsPlayback] Non-fatal media error, attempting recovery...');
          hlsInstance.recoverMediaError();
        }
      }
    });

    // Buffer stall events
    hlsInstance.on(Hls.Events.BUFFER_STALLED_ERROR, () => {
      if (isCleaningUp) return;
      handleBufferStall();
    });
  }

  /**
   * Handle buffer stall with recovery timeout
   */
  function handleBufferStall() {
    console.log('[HlsPlayback] Buffer stalled');
    state.value.isBuffering = true;

    // Start tracking stall time if not already
    if (!bufferStallStart) {
      bufferStallStart = Date.now();

      // Set recovery timeout
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
    const stallDuration = bufferStallStart ? Date.now() - bufferStallStart : 0;
    console.log(
      `[HlsPlayback] Attempting buffer stall recovery (attempt ${bufferStallRetries}, stalled for ${stallDuration}ms)`
    );

    if (bufferStallRetries >= MAX_BUFFER_STALL_RETRIES) {
      // Max retries reached, seek to live edge
      console.log('[HlsPlayback] Max stall retries reached, seeking to live edge');
      seekToLive();
      clearBufferStallRecovery();
      return;
    }

    // Try different recovery strategies
    if (bufferStallRetries === 1) {
      // First attempt: Try to nudge playback forward by a small amount
      const currentTime = videoElement.currentTime;
      const buffered = videoElement.buffered;

      // Find the next buffered range
      for (let i = 0; i < buffered.length; i++) {
        if (buffered.start(i) > currentTime) {
          // Seek to the start of the next buffered range
          console.log(`[HlsPlayback] Seeking to next buffered range at ${buffered.start(i)}`);
          videoElement.currentTime = buffered.start(i) + 0.1;
          break;
        }
      }

      // If we're in a buffered range but stalled, try nudging forward
      if (videoElement.currentTime === currentTime) {
        videoElement.currentTime = currentTime + 0.5;
      }
    } else if (bufferStallRetries === 2) {
      // Second attempt: Recover media error
      console.log('[HlsPlayback] Recovery: recoverMediaError()');
      hls.recoverMediaError();
    } else {
      // Third attempt: Restart loading
      console.log('[HlsPlayback] Recovery: startLoad()');
      hls.startLoad();
    }

    // Schedule another recovery attempt if this one doesn't work
    bufferStallRecoveryTimeout = window.setTimeout(() => {
      // Check if still stalled
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
      console.log('[HlsPlayback] Video playing');
      state.value.isPlaying = true;
      state.value.isPaused = false;
      state.value.isBuffering = false;
      // Clear stall recovery state when playback resumes
      clearBufferStallRecovery();
    });

    video.addEventListener('pause', () => {
      if (isCleaningUp) return;
      console.log('[HlsPlayback] Video paused');
      state.value.isPlaying = false;
      state.value.isPaused = true;
    });

    video.addEventListener('waiting', () => {
      if (isCleaningUp) return;
      console.log('[HlsPlayback] Video waiting (buffering)');
      state.value.isBuffering = true;
      // Start stall tracking when video enters waiting state
      handleBufferStall();
    });

    video.addEventListener('canplay', () => {
      if (isCleaningUp) return;
      console.log('[HlsPlayback] Video can play');
      state.value.isBuffering = false;
      // Clear stall recovery state when video can play
      clearBufferStallRecovery();
    });

    video.addEventListener('timeupdate', () => {
      if (isCleaningUp) return;
      state.value.currentTime = video.currentTime;
      state.value.isAtLiveEdge = isAtLiveEdge.value;

      // Update latency for live streams
      if (state.value.isLive && hls?.liveSyncPosition) {
        state.value.latency = hls.liveSyncPosition - video.currentTime;
      }
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
    if (!videoElement || !state.value.isInitialized) {
      console.log('[HlsPlayback] Cannot seek - not initialized');
      return;
    }

    console.log('[HlsPlayback] Seeking to:', time);

    // Clamp time to valid range
    const clampedTime = Math.max(0, Math.min(time, state.value.liveEdgeTime));

    videoElement.currentTime = clampedTime;
    state.value.currentTime = clampedTime;
    state.value.isAtLiveEdge = clampedTime >= state.value.liveEdgeTime - LIVE_EDGE_THRESHOLD;
  }

  /**
   * Seek to live edge
   */
  async function seekToLive() {
    if (!videoElement || !state.value.isInitialized) return;

    console.log('[HlsPlayback] Seeking to live edge');

    // Use HLS.js liveSyncPosition if available
    if (hls?.liveSyncPosition) {
      videoElement.currentTime = hls.liveSyncPosition;
    } else if (state.value.liveEdgeTime > 0) {
      // Fallback to computed live edge with minimal buffer (1 segment = 4s)
      videoElement.currentTime = Math.max(0, state.value.liveEdgeTime - 2);
    }

    state.value.isAtLiveEdge = true;

    // Also restart loading to ensure we have fresh data
    if (hls) {
      hls.startLoad();
    }
  }

  /**
   * Play
   */
  async function play() {
    console.log('[HlsPlayback] play() called');
    if (!videoElement) return;

    try {
      await videoElement.play();
    } catch (error) {
      console.error('[HlsPlayback] Play failed:', error);
    }
  }

  /**
   * Pause
   */
  function pause() {
    console.log('[HlsPlayback] pause() called');
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
    if (isCleaningUp) {
      console.log('[HlsPlayback] Already cleaning up, skipping...');
      return;
    }

    console.log('[HlsPlayback] Cleaning up...');
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

    // Utility
    getHlsUrl,
  };
}
