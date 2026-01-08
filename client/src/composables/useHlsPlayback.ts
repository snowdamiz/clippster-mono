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

// Network error recovery constants
const MAX_NETWORK_ERROR_RETRIES = 10; // Max retries for network errors before full reinit
const NETWORK_ERROR_RETRY_DELAY = 2000; // 2 seconds between network error retries

// Playback health monitoring constants
const PLAYBACK_HEALTH_CHECK_INTERVAL = 5000; // Check every 5 seconds
const PLAYBACK_STALL_THRESHOLD = 15000; // 15 seconds without progress = stalled
const MAX_REINIT_ATTEMPTS = 3; // Max full reinitialization attempts

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
  let timelineOffset: number | null = null; // Normalize timeline so 0 = first playable second; set once

  // Buffer stall recovery state
  let bufferStallStart: number | null = null;
  let bufferStallRetries = 0;
  let bufferStallRecoveryTimeout: number | null = null;

  // Network error recovery state
  let networkErrorRetries = 0;
  let networkErrorRetryTimeout: number | null = null;

  // Playback health monitoring state
  let healthCheckInterval: number | null = null;
  let lastProgressTime: number = Date.now();
  let lastProgressPosition: number = 0;
  let reinitAttempts = 0;
  let cachedOutputDirOrUrl: string | null = null;

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
    // Use the temp playlist for latest updates; server falls back to the stable file if tmp is missing
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
   * @param video - The video element to attach to
   * @param outputDirOrUrl - Either a local output directory path OR a direct HLS URL (starting with http)
   */
  async function initialize(video: HTMLVideoElement, outputDirOrUrl: string): Promise<boolean> {
    // Reset cleanup flag when starting new initialization
    isCleaningUp = false;

    // Detect if this is a direct URL or a local directory path
    const isDirectUrl = outputDirOrUrl.startsWith('http://') || outputDirOrUrl.startsWith('https://');
    const newUrl = isDirectUrl ? outputDirOrUrl : getHlsUrl(outputDirOrUrl);
    
    // Skip if already initialized for this URL
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

    // For direct URLs (like Kick proxy), skip the playlist polling - just try to load directly
    // For local recordings, wait for the playlist to be available
    if (!isDirectUrl) {
      const playlistReady = await waitForPlaylist(hlsUrl);
      if (!playlistReady) {
        if (!isCleaningUp) {
          state.value.error = 'Playlist not available - recording may not have started';
        }
        return false;
      }

      // Ensure at least one segment exists
      await waitForFirstSegment(hlsUrl);
    }

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

      // Cache the output dir/URL for potential reinitialization
      cachedOutputDirOrUrl = outputDirOrUrl;

      // Set up HLS event handlers
      setupHlsEventHandlers(hls);

      // Set up video event handlers
      setupVideoEventHandlers(video);

      // Load source
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      // Start update interval
      startUpdateInterval();

      // Start health monitoring for long-running streams
      startHealthCheck();

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
        // Normalize timeline so 0 is the earliest playable second; set offset once to avoid UI jumps
        const firstFragment = levelDetails.fragments?.[0];
        if (timelineOffset === null && firstFragment && typeof firstFragment.start === 'number') {
          timelineOffset = Math.max(0, firstFragment.start);
        }

        // Track earliest fragment start to avoid seeking into missing media (can advance as window slides)
        if (firstFragment && typeof firstFragment.start === 'number') {
          availableStartTime = Math.max(0, firstFragment.start);
        }

        const offset = timelineOffset ?? 0;
        state.value.duration = Math.max(0, levelDetails.totalduration - offset);
        state.value.liveEdgeTime = state.value.duration;
      }
    });

    hlsInstance.on(Hls.Events.FRAG_LOADED, () => {
      updateBufferedRanges();
      if (hls?.liveSyncPosition) {
        const offset = timelineOffset ?? 0;
        state.value.liveEdgeTime = Math.max(0, hls.liveSyncPosition - offset);
      }
    });

    hlsInstance.on(Hls.Events.FRAG_BUFFERED, () => {
      updateBufferedRanges();
      state.value.isBuffering = false;
    });

    hlsInstance.on(Hls.Events.ERROR, (event, data) => {
      if (isCleaningUp) return;

      console.log('[HlsPlayback] Error:', data.type, data.details, 'fatal:', data.fatal);

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
            handleNetworkError(hlsInstance);
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.log('[HlsPlayback] Attempting media error recovery');
            hlsInstance.recoverMediaError();
            break;
          default:
            console.error('[HlsPlayback] Fatal error:', data.details);
            // Try to reinitialize instead of giving up
            attemptReinitialize();
            break;
        }
      } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        hlsInstance.recoverMediaError();
      } else if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        // Non-fatal network error - still try to recover
        handleNetworkError(hlsInstance);
      }
    });
  }

  /**
   * Handle network errors with retry logic
   */
  function handleNetworkError(hlsInstance: Hls) {
    if (isCleaningUp) return;

    networkErrorRetries++;
    console.log(`[HlsPlayback] Network error, retry ${networkErrorRetries}/${MAX_NETWORK_ERROR_RETRIES}`);

    if (networkErrorRetries >= MAX_NETWORK_ERROR_RETRIES) {
      console.log('[HlsPlayback] Max network retries reached, attempting full reinitialize');
      networkErrorRetries = 0;
      attemptReinitialize();
      return;
    }

    // Clear any existing retry timeout
    if (networkErrorRetryTimeout) {
      clearTimeout(networkErrorRetryTimeout);
    }

    // Retry with exponential backoff
    const delay = Math.min(NETWORK_ERROR_RETRY_DELAY * Math.pow(1.5, networkErrorRetries - 1), 10000);
    networkErrorRetryTimeout = window.setTimeout(() => {
      if (!isCleaningUp && hls) {
        console.log('[HlsPlayback] Retrying load after network error');
        hls.startLoad();
      }
    }, delay);
  }

  /**
   * Attempt to fully reinitialize HLS playback
   */
  async function attemptReinitialize() {
    if (isCleaningUp || !videoElement || !cachedOutputDirOrUrl) return;

    reinitAttempts++;
    console.log(`[HlsPlayback] Attempting reinitialize ${reinitAttempts}/${MAX_REINIT_ATTEMPTS}`);

    if (reinitAttempts > MAX_REINIT_ATTEMPTS) {
      console.error('[HlsPlayback] Max reinit attempts reached, giving up');
      state.value.error = 'Stream playback failed after multiple recovery attempts';
      return;
    }

    // Store current position to resume from
    const resumePosition = videoElement.currentTime;
    const wasPlaying = state.value.isPlaying;

    // Clean up current instance without resetting cachedOutputDirOrUrl
    const savedUrl = cachedOutputDirOrUrl;
    await cleanupInternal(false);

    // Wait a moment before reinitializing
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (isCleaningUp) return;

    // Reinitialize
    cachedOutputDirOrUrl = savedUrl;
    const success = await initialize(videoElement!, savedUrl);

    if (success) {
      console.log('[HlsPlayback] Reinitialize successful');
      // Try to resume from previous position
      if (resumePosition > 0 && hls) {
        hls.startLoad(resumePosition);
        videoElement!.currentTime = resumePosition;
      }
      if (wasPlaying) {
        play();
      }
      // Reset retry counters on successful recovery
      networkErrorRetries = 0;
      reinitAttempts = 0;
    }
  }

  /**
   * Start playback health monitoring
   */
  function startHealthCheck() {
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
    }

    lastProgressTime = Date.now();
    lastProgressPosition = videoElement?.currentTime ?? 0;

    healthCheckInterval = window.setInterval(() => {
      if (isCleaningUp || !videoElement || !state.value.isInitialized) return;

      const currentPosition = videoElement.currentTime;
      const now = Date.now();

      // Check if playback is progressing (only when supposed to be playing)
      if (state.value.isPlaying && !state.value.isPaused) {
        const positionDelta = Math.abs(currentPosition - lastProgressPosition);
        const timeDelta = now - lastProgressTime;

        // If position hasn't changed significantly in PLAYBACK_STALL_THRESHOLD ms
        if (positionDelta < 0.5 && timeDelta > PLAYBACK_STALL_THRESHOLD) {
          console.warn(`[HlsPlayback] Playback stalled for ${timeDelta}ms, attempting recovery`);
          
          // Try progressive recovery steps
          if (hls) {
            // First try: just restart loading
            hls.startLoad();
            
            // If still stalled after a few checks, try more aggressive recovery
            if (timeDelta > PLAYBACK_STALL_THRESHOLD * 2) {
              console.log('[HlsPlayback] Extended stall, attempting media error recovery');
              hls.recoverMediaError();
            }
            
            if (timeDelta > PLAYBACK_STALL_THRESHOLD * 3) {
              console.log('[HlsPlayback] Severe stall, attempting full reinitialize');
              attemptReinitialize();
            }
          }
        } else if (positionDelta >= 0.5) {
          // Playback is progressing, update tracking
          lastProgressTime = now;
          lastProgressPosition = currentPosition;
          // Reset error state if we were recovering
          if (state.value.error) {
            state.value.error = null;
          }
        }
      } else {
        // Not playing, just update tracking
        lastProgressTime = now;
        lastProgressPosition = currentPosition;
      }
    }, PLAYBACK_HEALTH_CHECK_INTERVAL);
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
      const offset = timelineOffset ?? 0;
      state.value.currentTime = Math.max(0, video.currentTime - offset);
      state.value.isAtLiveEdge = isAtLiveEdge.value;

      if (state.value.isLive && hls?.liveSyncPosition) {
        state.value.latency = hls.liveSyncPosition - video.currentTime;
      }
    });

    video.addEventListener('seeked', () => {
      if (isCleaningUp) return;
      const offset = timelineOffset ?? 0;
      state.value.currentTime = Math.max(0, video.currentTime - offset);
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
        const offset = timelineOffset ?? 0;
        state.value.currentTime = Math.max(0, videoElement.currentTime - offset);
        updateBufferedRanges();

        // Update live edge from HLS
        if (hls?.liveSyncPosition) {
          state.value.liveEdgeTime = Math.max(0, hls.liveSyncPosition - offset);
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
      const offset = timelineOffset ?? 0;
      ranges.push({
        start: Math.max(0, buffered.start(i) - offset),
        end: Math.max(0, buffered.end(i) - offset),
      });
    }

    state.value.bufferedRanges = ranges;
  }

  /**
   * Seek to a specific time
   */
  async function seek(time: number) {
    if (!videoElement || !state.value.isInitialized) return;

    const offset = timelineOffset ?? 0;
    // Only limit seeking to what's available in the playlist (availableStartTime),
    // NOT what's currently buffered. HLS.js will load necessary segments when seeking.
    const minAvailableOffset = Math.max(0, availableStartTime - offset);
    const safeFloor = minAvailableOffset > 0 ? minAvailableOffset + SAFE_SEEK_PADDING : 0;
    const liveEdge = state.value.liveEdgeTime || state.value.duration || 0;
    const clampedTime = Math.max(safeFloor, Math.min(time, liveEdge));

    // Map back to absolute player time
    const targetAbsolute = clampedTime + offset;

    // Tell HLS.js to load from the seek position (handles unbuffered seeks)
    if (hls) {
      hls.startLoad(targetAbsolute);
    }

    videoElement.currentTime = targetAbsolute;
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
      const offset = timelineOffset ?? 0;
      videoElement.currentTime = Math.max(0, state.value.duration - 2 + offset);
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
   * Internal cleanup that can optionally preserve state for reinitialization
   */
  async function cleanupInternal(fullCleanup: boolean = true) {
    // Clear buffer stall recovery state
    clearBufferStallRecovery();

    // Clear network error retry timeout
    if (networkErrorRetryTimeout) {
      clearTimeout(networkErrorRetryTimeout);
      networkErrorRetryTimeout = null;
    }

    // Clear health check interval
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
      healthCheckInterval = null;
    }

    // Clear update interval
    if (updateInterval) {
      clearInterval(updateInterval);
      updateInterval = null;
    }

    // Destroy HLS instance
    if (hls) {
      hls.destroy();
      hls = null;
    }

    // Clean up video element (but don't null it if we're reinitializing)
    if (videoElement) {
      videoElement.pause();
      videoElement.src = '';
      videoElement.load();
      if (fullCleanup) {
        videoElement = null;
      }
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
      isMuted: state.value.isMuted, // Preserve audio settings
      volume: state.value.volume,
      error: null,
      isLive: true,
      latency: 0,
    };
    timelineOffset = null;

    if (fullCleanup) {
      cachedOutputDirOrUrl = null;
      networkErrorRetries = 0;
      reinitAttempts = 0;
    }
  }

  /**
   * Clean up resources
   */
  async function cleanup() {
    if (isCleaningUp) return;

    isCleaningUp = true;
    await cleanupInternal(true);
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
