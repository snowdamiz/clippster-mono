import { ref, computed, onUnmounted } from 'vue';
import Hls from 'hls.js';
import { TauriHlsLoader, getTauriHlsUrl, checkPlaylistExists } from './useTauriHlsLoader';
import { invoke } from '@tauri-apps/api/core';

// Constants for playlist polling
const PLAYLIST_POLL_INTERVAL = 1000; // 1 second between checks
const PLAYLIST_POLL_MAX_ATTEMPTS = 60; // Max 60 seconds waiting for playlist
const PLAYLIST_SEGMENT_POLL_INTERVAL = 1000; // Wait for first segment after playlist exists
const PLAYLIST_SEGMENT_POLL_MAX_ATTEMPTS = 20; // Up to ~20s after playlist appears
const MIN_VALID_SEGMENT_BYTES = 5 * 1024; // Ignore tiny/empty startup segments
const MIN_VALID_SEGMENT_DURATION_SEC = 0.5; // Ignore near-zero startup fragments
const MIN_READY_SEGMENT_COUNT = 2; // Require at least 2 good segments before playback init
const TS_PACKET_SIZE = 188;

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
const APPEND_ERROR_WINDOW_MS = 10000; // Sliding window for append error bursts
const APPEND_ERROR_RECOVERY_THRESHOLD = 3; // Escalate after N append errors in window

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
const LIVE_EDGE_THRESHOLD = 15; // seconds behind live to consider "at live edge" (allows ~3-4 segments buffer)
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

  // Stream end state
  let streamHasEnded = false;
  let appendErrorCount = 0;
  let appendErrorWindowStart = 0;

  // Computed
  const isAtLiveEdge = computed(() => {
    if (!state.value.isInitialized) return true;
    return state.value.liveEdgeTime - state.value.currentTime <= LIVE_EDGE_THRESHOLD;
  });

  function isLikelyValidTsSegment(bytes: number[]): boolean {
    if (!Array.isArray(bytes) || bytes.length < TS_PACKET_SIZE * 2) return false;
    if (bytes.length < MIN_VALID_SEGMENT_BYTES) return false;
    if (bytes.length % TS_PACKET_SIZE !== 0) return false;

    const packetChecks = Math.min(10, Math.floor(bytes.length / TS_PACKET_SIZE));
    for (let i = 0; i < packetChecks; i++) {
      if (bytes[i * TS_PACKET_SIZE] !== 0x47) {
        return false;
      }
    }

    return true;
  }

  function parsePlaylistSegmentCandidates(
    content: string
  ): Array<{ filename: string; duration: number }> {
    const lines = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const candidates: Array<{ filename: string; duration: number }> = [];
    let pendingDuration: number | null = null;

    for (const line of lines) {
      if (line.startsWith('#EXTINF:')) {
        const raw = line.slice('#EXTINF:'.length).split(',')[0]?.trim() ?? '0';
        const duration = Number.parseFloat(raw);
        pendingDuration = Number.isFinite(duration) ? duration : 0;
        continue;
      }

      if (line.startsWith('#')) {
        continue;
      }

      if (pendingDuration !== null) {
        candidates.push({
          filename: line,
          duration: pendingDuration ?? 0,
        });
        pendingDuration = null;
      }
    }

    return candidates;
  }

  /**
   * Generate HLS URL using Tauri protocol (no HTTP server needed)
   */
  function getHlsUrl(outputDir: string): string {
    // Use Tauri protocol instead of HTTP to avoid CORS/PNA issues
    return getTauriHlsUrl(outputDir, 'playlist.m3u8');
  }

  /**
   * Extract output directory from asset:// URL
   * Format: asset://hls/{base64EncodedDir}/playlist.m3u8
   */
  function extractOutputDirFromAssetUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      if (urlObj.protocol !== 'asset:' && urlObj.protocol !== 'tauri:') {
        return null;
      }

      // asset://hls/{encodedDir}/{filename} → hostname='hls', pathname='/{encodedDir}/{filename}'
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      if (pathParts.length < 1) return null;

      const encodedDir = pathParts[0];
      // Decode base64 to get original directory path
      return atob(encodedDir);
    } catch {
      return null;
    }
  }

  /**
   * Wait for the HLS playlist to become available.
   * If expectedUrl is provided, abort when the active target changes.
   */
  async function waitForPlaylist(
    url: string,
    expectedUrl?: string,
    outputDir?: string
  ): Promise<boolean> {
    for (let attempt = 0; attempt < PLAYLIST_POLL_MAX_ATTEMPTS; attempt++) {
      if (isCleaningUp) return false;
      // Skip URL mismatch check if outputDir is provided (standalone check for new directory)
      if (!outputDir && expectedUrl && hlsUrl && hlsUrl !== expectedUrl) return false;

      try {
        // For Tauri asset URLs, use checkPlaylistExists command (fetch can't handle asset:// scheme)
        if (url.startsWith('asset://') || url.startsWith('tauri://')) {
          // Extract outputDir from URL if not provided
          const dirToUse = outputDir || extractOutputDirFromAssetUrl(url);
          if (dirToUse) {
            const exists = await checkPlaylistExists(dirToUse, 'playlist.m3u8');
            if (exists) return true;
          }
        } else {
          // Fallback to fetch for direct URLs (e.g., Kick proxy)
          const response = await fetch(url, { method: 'GET', mode: 'cors' });
          if (response.ok) return true;
        }
      } catch {
        // Error - continue polling
      }

      await new Promise((resolve) => setTimeout(resolve, PLAYLIST_POLL_INTERVAL));
    }

    console.warn('[HlsPlayback] Playlist not available after max wait time');
    return false;
  }

  /**
   * Wait for the first segment to appear in the playlist.
   * If expectedUrl is provided, abort when the active target changes.
   */
  async function waitForFirstSegment(
    url: string,
    expectedUrl?: string,
    outputDir?: string
  ): Promise<boolean> {
    for (let attempt = 0; attempt < PLAYLIST_SEGMENT_POLL_MAX_ATTEMPTS; attempt++) {
      if (isCleaningUp) return false;
      // Skip URL mismatch check if outputDir is provided (standalone check for new directory)
      if (!outputDir && expectedUrl && hlsUrl && hlsUrl !== expectedUrl) return false;

      try {
        // For Tauri asset URLs, use invoke to read playlist content (fetch can't handle asset:// scheme)
        if (url.startsWith('asset://') || url.startsWith('tauri://')) {
          // Extract outputDir from URL if not provided
          const dirToUse = outputDir || extractOutputDirFromAssetUrl(url);
          if (dirToUse) {
            const encodedDir = btoa(dirToUse);
            const content = await invoke<string>('read_hls_playlist', {
              encodedDir,
              filename: 'playlist.m3u8',
            });
            const segmentCandidates = parsePlaylistSegmentCandidates(content);
            let validSegmentCount = 0;

            // Require multiple valid segments before init to avoid startup races on partial fragments.
            // Startup playlists can briefly contain near-zero-duration entries with invalid files.
            for (const { filename, duration } of segmentCandidates.slice(-6).reverse()) {
              if (duration < MIN_VALID_SEGMENT_DURATION_SEC) {
                continue;
              }

              try {
                const bytes = await invoke<number[]>('read_hls_segment', {
                  encodedDir,
                  filename,
                });
                if (isLikelyValidTsSegment(bytes)) {
                  validSegmentCount += 1;
                }
                if (validSegmentCount >= MIN_READY_SEGMENT_COUNT) {
                  return true;
                }
              } catch {
                // Segment may not exist yet; keep polling.
              }
            }
          }
        } else {
          const response = await fetch(url, { method: 'GET', cache: 'no-store', mode: 'cors' });
          if (response.ok) {
            const text = await response.text();
            const validDurationCount = parsePlaylistSegmentCandidates(text).filter(
              ({ duration }) => duration >= MIN_VALID_SEGMENT_DURATION_SEC
            ).length;
            if (validDurationCount >= MIN_READY_SEGMENT_COUNT) return true;
          }
        }
      } catch {
        // Error - continue polling
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
    const isDirectUrl =
      outputDirOrUrl.startsWith('http://') || outputDirOrUrl.startsWith('https://');
    const newUrl = isDirectUrl ? outputDirOrUrl : getHlsUrl(outputDirOrUrl);
    const expectedUrl = newUrl;

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
      const playlistReady = await waitForPlaylist(hlsUrl, expectedUrl, outputDirOrUrl);
      if (!playlistReady) {
        if (!isCleaningUp) {
          state.value.error = 'Playlist not available - recording may not have started';
        }
        return false;
      }

      // Ensure enough valid startup segments exist
      const segmentReady = await waitForFirstSegment(
        hlsUrl,
        expectedUrl,
        isDirectUrl ? undefined : outputDirOrUrl
      );
      if (!segmentReady) {
        if (!isCleaningUp) {
          state.value.error = 'No segments produced for recording';
        }
        return false;
      }
    }

    try {
      // Create HLS instance with live streaming config optimized for DVR playback
      hls = new Hls({
        // Use custom Tauri loader to avoid CORS/PNA issues
        loader: TauriHlsLoader,

        // Live streaming optimizations for 4-second segments
        // CRITICAL: Stay far enough behind live edge to ensure smooth playback
        // With 4-second segments, we need at least 6 segments (24s) of buffer
        liveSyncDurationCount: 6, // Stay 6 segments (24s) behind live edge
        // CRITICAL: Prevent catch-up speed adjustments - always play at 1.0x speed
        maxLiveSyncPlaybackRate: 1.0, // Never speed up to catch up to live edge
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

        // Calculate TRUE live edge from the last fragment's end time
        // This is the actual end of available content, not the target playback position
        const lastFragment = levelDetails.fragments?.[levelDetails.fragments.length - 1];
        if (
          lastFragment &&
          typeof lastFragment.start === 'number' &&
          typeof lastFragment.duration === 'number'
        ) {
          const trueLiveEdge = lastFragment.start + lastFragment.duration;
          state.value.liveEdgeTime = Math.max(0, trueLiveEdge - offset);
        } else {
          state.value.liveEdgeTime = state.value.duration;
        }
      }
    });

    hlsInstance.on(Hls.Events.FRAG_LOADED, (event, data) => {
      updateBufferedRanges();
      // Update live edge from the loaded fragment
      // Use the fragment's end time as the live edge, not liveSyncPosition
      if (
        data.frag &&
        typeof data.frag.start === 'number' &&
        typeof data.frag.duration === 'number'
      ) {
        const offset = timelineOffset ?? 0;
        const fragEnd = data.frag.start + data.frag.duration;
        state.value.liveEdgeTime = Math.max(state.value.liveEdgeTime, fragEnd - offset);
      }
    });

    hlsInstance.on(Hls.Events.FRAG_BUFFERED, () => {
      updateBufferedRanges();
      state.value.isBuffering = false;
      // Fragment append succeeded - clear burst counters.
      appendErrorCount = 0;
      appendErrorWindowStart = 0;
    });

    hlsInstance.on(Hls.Events.ERROR, (event, data) => {
      if (isCleaningUp) return;

      // Enhanced error logging with buffer state
      let bufferAhead = 0;
      if (videoElement && videoElement.buffered.length > 0) {
        const currentTime = videoElement.currentTime;
        for (let i = 0; i < videoElement.buffered.length; i++) {
          if (
            currentTime >= videoElement.buffered.start(i) &&
            currentTime <= videoElement.buffered.end(i)
          ) {
            bufferAhead = videoElement.buffered.end(i) - currentTime;
            break;
          }
        }
      }
      console.log(
        '[HlsPlayback] Error:',
        data.type,
        data.details,
        'fatal:',
        data.fatal,
        videoElement
          ? `| Buffer ahead: ${bufferAhead.toFixed(1)}s, currentTime: ${videoElement.currentTime.toFixed(1)}s, liveEdge: ${state.value.liveEdgeTime.toFixed(1)}s`
          : ''
      );

      // Handle specific error types
      if (data.details === 'bufferStalledError') {
        // Log detailed buffer state on stall
        if (videoElement) {
          const buffered = videoElement.buffered;
          const ranges: string[] = [];
          for (let i = 0; i < buffered.length; i++) {
            ranges.push(`[${buffered.start(i).toFixed(1)}-${buffered.end(i).toFixed(1)}]`);
          }
          console.warn(
            `[HlsPlayback] ⚠️ BUFFER STALL at ${videoElement.currentTime.toFixed(1)}s | Buffered ranges: ${ranges.join(', ') || 'none'} | Live edge: ${state.value.liveEdgeTime.toFixed(1)}s`
          );
        }
        handleBufferStall();
        return;
      }

      if (data.details === 'bufferSeekOverHole') {
        // Log the hole that was skipped
        if (data.frag) {
          console.warn(
            `[HlsPlayback] ⚠️ BUFFER HOLE detected, skipped from ${(data as any).previousTime?.toFixed(1) || '?'}s to frag at ${data.frag.start?.toFixed(1) || '?'}s`
          );
        }
        clearBufferStallRecovery();
        return;
      }

      // Append errors are often transient MSE state issues. Calling recoverMediaError()
      // on every non-fatal append error can thrash playback and freeze currentTime.
      if (
        data.details === 'bufferAppendError' ||
        data.details === 'bufferAppendingError' ||
        data.details === 'bufferFullError'
      ) {
        const now = Date.now();
        if (!appendErrorWindowStart || now - appendErrorWindowStart > APPEND_ERROR_WINDOW_MS) {
          appendErrorWindowStart = now;
          appendErrorCount = 1;
        } else {
          appendErrorCount += 1;
        }

        const errorMsg =
          data.error instanceof Error
            ? `${data.error.name}: ${data.error.message}`
            : data.reason || '';
        console.warn(
          `[HlsPlayback] Append error burst ${appendErrorCount}/${APPEND_ERROR_RECOVERY_THRESHOLD}`,
          data.details,
          errorMsg
        );

        if (
          appendErrorCount >= APPEND_ERROR_RECOVERY_THRESHOLD &&
          videoElement &&
          !Number.isNaN(videoElement.currentTime)
        ) {
          const currentTime = videoElement.currentTime;
          const target = state.value.liveEdgeTime
            ? Math.max(currentTime + 1, state.value.liveEdgeTime - 8)
            : currentTime + 1;
          console.warn(
            `[HlsPlayback] Escalating append-error recovery: reload from ${target.toFixed(1)}s`
          );
          hlsInstance.stopLoad();
          hlsInstance.startLoad(target);
          videoElement.currentTime = target;
          appendErrorCount = 0;
          appendErrorWindowStart = 0;
        }
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
        // Avoid aggressive decoder resets for non-fatal media noise.
        // Let hls.js continue unless we detect specific recoverable cases.
        if (data.details === 'fragParsingError' || data.details === 'fragGap') {
          hlsInstance.startLoad();
        }
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
    console.log(
      `[HlsPlayback] Network error, retry ${networkErrorRetries}/${MAX_NETWORK_ERROR_RETRIES}`
    );

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
    const delay = Math.min(
      NETWORK_ERROR_RETRY_DELAY * Math.pow(1.5, networkErrorRetries - 1),
      10000
    );
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
    await new Promise((resolve) => setTimeout(resolve, 2000));

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
    // Don't attempt recovery if stream has ended - just let it finish playing
    if (streamHasEnded) {
      console.log('[HlsPlayback] Stream ended, skipping buffer stall recovery');
      return;
    }
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
    console.log(
      `[HlsPlayback] Buffer stall recovery attempt ${bufferStallRetries}/${MAX_BUFFER_STALL_RETRIES}`
    );

    // Check if we're near the live edge - if so, seek back to give more buffer room
    const currentTime = videoElement.currentTime;
    const liveEdge = state.value.liveEdgeTime;
    const isNearLiveEdge = liveEdge > 0 && liveEdge - currentTime < 8; // Within 8 seconds of live edge

    if (isNearLiveEdge && bufferStallRetries === 1) {
      // First attempt near live edge: seek back 8 seconds to give buffer room
      const seekBackTarget = Math.max(0, currentTime - 8);
      console.log(
        `[HlsPlayback] Near live edge stall, seeking back from ${currentTime.toFixed(1)}s to ${seekBackTarget.toFixed(1)}s`
      );
      videoElement.currentTime = seekBackTarget;
      hls.startLoad();
      clearBufferStallRecovery();
      return;
    }

    if (bufferStallRetries >= MAX_BUFFER_STALL_RETRIES) {
      // Max retries reached - do a full reload and seek back if near live edge
      console.log('[HlsPlayback] Max buffer stall retries, reloading');
      const resumeTime = isNearLiveEdge ? Math.max(0, currentTime - 8) : currentTime;
      hls.stopLoad();
      hls.startLoad();
      if (!Number.isNaN(resumeTime)) {
        videoElement.currentTime = resumeTime;
      }
      clearBufferStallRecovery();
      return;
    }

    if (bufferStallRetries === 1) {
      // First attempt: try to skip over any gap in buffer
      const buffered = videoElement.buffered;

      for (let i = 0; i < buffered.length; i++) {
        if (buffered.start(i) > currentTime) {
          console.log(`[HlsPlayback] Skipping buffer gap to ${buffered.start(i).toFixed(1)}s`);
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
   * Set stream ended flag to disable buffer recovery
   */
  function setStreamEnded(ended: boolean) {
    streamHasEnded = ended;
    if (ended) {
      console.log('[HlsPlayback] Stream ended - disabling buffer recovery');
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

      // Calculate latency from true live edge, not liveSyncPosition
      if (state.value.isLive && state.value.liveEdgeTime > 0) {
        state.value.latency = state.value.liveEdgeTime - state.value.currentTime;
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

        // Live edge is updated via LEVEL_LOADED and FRAG_LOADED events
        // Don't overwrite it here with liveSyncPosition (which is the target playback position, not live edge)

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

    const target =
      typeof seekPosition === 'number' ? seekPosition : (videoElement?.currentTime ?? 0);
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
    appendErrorCount = 0;
    appendErrorWindowStart = 0;

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

  /**
   * Wait for playlist + first segment readiness without attaching a player.
   * Useful for gating before initializing playback.
   */
  async function waitForPlaylistReady(outputDirOrUrl: string): Promise<boolean> {
    const isDirectUrl =
      outputDirOrUrl.startsWith('http://') || outputDirOrUrl.startsWith('https://');
    const targetUrl = isDirectUrl ? outputDirOrUrl : getHlsUrl(outputDirOrUrl);

    // Pass outputDir to bypass hlsUrl mismatch check - this is called standalone, not during active playback
    const playlistReady = await waitForPlaylist(
      targetUrl,
      targetUrl,
      isDirectUrl ? undefined : outputDirOrUrl
    );
    if (!playlistReady) return false;
    return waitForFirstSegment(targetUrl, targetUrl, isDirectUrl ? undefined : outputDirOrUrl);
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
    waitForPlaylistReady,
    setStreamEnded,

    // Utility
    getHlsUrl,
  };
}
