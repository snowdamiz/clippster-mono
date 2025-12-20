import { ref, computed, watch, onUnmounted, type Ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type { DvrChunk } from './useDvrRecording';

// Playback state
export interface DvrPlaybackState {
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
}

// Configuration
const CHUNK_DURATION = 4; // seconds per chunk
const LIVE_EDGE_THRESHOLD = 12; // seconds behind live to consider "at live edge"
const BUFFER_AHEAD_CHUNKS = 4; // number of chunks to buffer ahead (16 seconds)
const MAX_BUFFER_SECONDS = 120; // maximum seconds to keep buffered

// Supported WebM codecs for MSE
// Prefer VP8 to match recording codec order
const WEBM_CODECS = [
  'video/webm; codecs="vp8, opus"',
  'video/webm; codecs="vp9, opus"',
  'video/webm; codecs="vp8, vorbis"',
  'video/webm; codecs="vp9, vorbis"',
  'video/webm; codecs="vp8"',
  'video/webm; codecs="vp9"',
];

/**
 * Get the best supported WebM codec for MSE
 */
function getSupportedCodec(): string | null {
  for (const codec of WEBM_CODECS) {
    if (MediaSource.isTypeSupported(codec)) {
      console.log('[DvrPlayback] Using codec:', codec);
      return codec;
    }
  }
  console.error('[DvrPlayback] No supported WebM codec found');
  return null;
}

export function useDvrPlayback() {
  // State
  const state = ref<DvrPlaybackState>({
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
  });

  // Internal refs
  let videoElement: HTMLVideoElement | null = null;
  let mediaSource: MediaSource | null = null;
  let sourceBuffer: SourceBuffer | null = null;
  let mintId: string | null = null;
  let codec: string | null = null;

  // Chunk tracking
  const loadedChunks = new Set<number>();
  const loadingChunks = new Set<number>(); // Chunks currently being loaded (prevents duplicate loads)
  const appendQueue: Array<{ data: Uint8Array; chunkIndex: number }> = []; // Queue of chunks waiting to be appended
  let isAppending = false;
  let lastAppendedChunkIndex = -1;

  // Available chunks from DVR
  const availableChunks = ref<DvrChunk[]>([]);

  // Update intervals
  let timeUpdateInterval: number | null = null;
  let bufferCheckInterval: number | null = null;

  // Computed
  const isAtLiveEdge = computed(() => {
    if (!state.value.isInitialized) return true;
    return state.value.liveEdgeTime - state.value.currentTime <= LIVE_EDGE_THRESHOLD;
  });

  /**
   * Initialize playback for a mint
   */
  async function initialize(
    video: HTMLVideoElement,
    mint: string,
    chunks: DvrChunk[]
  ): Promise<boolean> {
    console.log('[DvrPlayback] Initializing for mint:', mint, 'with', chunks.length, 'chunks');

    // Skip if already initialized for this mint
    if (mintId === mint && videoElement === video && state.value.isInitialized) {
      console.log('[DvrPlayback] Already initialized for this mint, skipping');
      // Just update chunks if we have new ones
      if (chunks.length > availableChunks.value.length) {
        await updateChunks(chunks);
      }
      return true;
    }

    // Clean up any existing state only if switching to a different mint
    if (mintId && mintId !== mint) {
      await cleanup();
    }

    videoElement = video;
    mintId = mint;
    availableChunks.value = chunks;

    // Check MediaSource support
    if (!('MediaSource' in window)) {
      state.value.error = 'MediaSource API not supported';
      console.error('[DvrPlayback]', state.value.error);
      return false;
    }

    // Get supported codec
    codec = getSupportedCodec();
    if (!codec) {
      state.value.error = 'No supported WebM codec found';
      return false;
    }

    // ALWAYS set up video event handlers immediately so play/pause works
    setupVideoEventHandlers();

    // Wait for at least one chunk - MediaSource will be created when chunks arrive
    if (chunks.length === 0) {
      console.log('[DvrPlayback] No chunks available yet, waiting for DVR to produce chunks...');
      state.value.isBuffering = true;
      // Start time updates to keep UI responsive
      startTimeUpdates();
      return true; // Will initialize MediaSource when chunks arrive via updateChunks
    }

    // We have chunks, create MediaSource immediately
    await createMediaSourceAndStart();
    return true;
  }

  /**
   * Handle MediaSource sourceopen event
   */
  async function handleSourceOpen() {
    console.log('[DvrPlayback] MediaSource opened');

    if (!mediaSource || !codec || !mintId) {
      console.error('[DvrPlayback] Missing required state in sourceopen');
      return;
    }

    try {
      // Create SourceBuffer
      sourceBuffer = mediaSource.addSourceBuffer(codec);
      sourceBuffer.mode = 'sequence'; // Segments are appended in sequence

      // Set up SourceBuffer event handlers
      sourceBuffer.addEventListener('updateend', handleUpdateEnd);
      sourceBuffer.addEventListener('error', handleSourceBufferError);

      console.log('[DvrPlayback] SourceBuffer created with codec:', codec);

      // Load init segment
      await loadInitSegment();

      // Start buffer management
      startBufferManagement();
    } catch (error) {
      console.error('[DvrPlayback] Failed to create SourceBuffer:', error);
      state.value.error = `Failed to create SourceBuffer: ${error}`;
    }
  }

  /**
   * Load the init segment
   */
  async function loadInitSegment() {
    if (!mintId || !sourceBuffer) return;

    console.log('[DvrPlayback] Loading init segment...');
    state.value.isBuffering = true;

    try {
      const initData = await invoke<number[]>('read_dvr_init_segment', { mintId });
      const initBuffer = new Uint8Array(initData);

      console.log('[DvrPlayback] Init segment loaded:', initBuffer.length, 'bytes');

      // Append init segment
      await appendToBuffer(initBuffer);

      state.value.isInitialized = true;

      // Now load initial chunks
      await loadInitialChunks();
    } catch (error) {
      console.error('[DvrPlayback] Failed to load init segment:', error);
      state.value.error = `Failed to load init segment: ${error}`;
      state.value.isBuffering = false;
    }
  }

  /**
   * Load initial chunks to start playback
   */
  async function loadInitialChunks() {
    if (availableChunks.value.length === 0) {
      console.log('[DvrPlayback] No chunks available for initial load');
      return;
    }

    // Load the first few chunks to start playback
    const chunksToLoad = Math.min(BUFFER_AHEAD_CHUNKS + 1, availableChunks.value.length);

    for (let i = 0; i < chunksToLoad; i++) {
      const chunk = availableChunks.value[i];
      if (chunk && !loadedChunks.has(chunk.index)) {
        await loadChunk(chunk.index);
      }
    }

    // Start playback at beginning or live edge
    if (videoElement) {
      state.value.isBuffering = false;

      // Seek to live edge (near the end of available content)
      const livePosition = Math.max(0, state.value.duration - CHUNK_DURATION);
      if (livePosition > 0) {
        videoElement.currentTime = livePosition;
      }

      // Auto-play
      try {
        await videoElement.play();
        state.value.isPlaying = true;
      } catch (error) {
        console.log('[DvrPlayback] Autoplay blocked:', error);
        // User will need to click play
      }
    }
  }

  /**
   * Load a specific chunk by index
   */
  async function loadChunk(chunkIndex: number): Promise<void> {
    // Skip if already loaded or currently loading
    if (!mintId || !sourceBuffer || loadedChunks.has(chunkIndex) || loadingChunks.has(chunkIndex)) {
      return;
    }

    // Mark as loading to prevent duplicate loads
    loadingChunks.add(chunkIndex);
    console.log('[DvrPlayback] Loading chunk:', chunkIndex);

    try {
      // Read cluster data (without init segment since it's already loaded)
      const clusterData = await invoke<number[]>('read_dvr_cluster', {
        mintId,
        chunkIndex,
      });
      const clusterBuffer = new Uint8Array(clusterData);

      console.log('[DvrPlayback] Chunk', chunkIndex, 'loaded:', clusterBuffer.length, 'bytes');

      // Add to append queue
      appendQueue.push({ data: clusterBuffer, chunkIndex });

      // Process the queue
      await processAppendQueue();
    } catch (error) {
      console.error('[DvrPlayback] Failed to load chunk', chunkIndex, ':', error);
      // Remove from loading set on error so it can be retried
      loadingChunks.delete(chunkIndex);
    }
  }

  /**
   * Process the append queue - appends chunks one at a time
   */
  async function processAppendQueue(): Promise<void> {
    // If already appending or no sourceBuffer, the queue will be processed later
    if (isAppending || !sourceBuffer || appendQueue.length === 0) {
      return;
    }

    isAppending = true;

    try {
      // Process all queued chunks in order
      while (appendQueue.length > 0 && sourceBuffer && !sourceBuffer.updating) {
        const item = appendQueue.shift();
        if (!item) break;

        const { data, chunkIndex } = item;

        try {
          await appendToBuffer(data);
          loadedChunks.add(chunkIndex);
          loadingChunks.delete(chunkIndex); // No longer loading
          lastAppendedChunkIndex = Math.max(lastAppendedChunkIndex, chunkIndex);
          console.log('[DvrPlayback] Chunk', chunkIndex, 'appended successfully');

          // Update duration
          updateDuration();
        } catch (appendError) {
          console.error('[DvrPlayback] Failed to append chunk', chunkIndex, ':', appendError);
          // Remove from loading so it can be retried
          loadingChunks.delete(chunkIndex);
          // Don't continue processing on error - might need to recover
          break;
        }
      }
    } catch (error) {
      console.error('[DvrPlayback] Queue processing error:', error);
    } finally {
      isAppending = false;
    }
  }

  /**
   * Append data to the SourceBuffer
   */
  function appendToBuffer(data: Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!sourceBuffer || sourceBuffer.updating) {
        reject(new Error('SourceBuffer not ready'));
        return;
      }

      const onUpdateEnd = () => {
        sourceBuffer?.removeEventListener('updateend', onUpdateEnd);
        sourceBuffer?.removeEventListener('error', onError);
        resolve();
      };

      const onError = (e: Event) => {
        sourceBuffer?.removeEventListener('updateend', onUpdateEnd);
        sourceBuffer?.removeEventListener('error', onError);
        reject(new Error('SourceBuffer error'));
      };

      sourceBuffer.addEventListener('updateend', onUpdateEnd, { once: true });
      sourceBuffer.addEventListener('error', onError, { once: true });

      try {
        sourceBuffer.appendBuffer(data);
      } catch (error) {
        sourceBuffer.removeEventListener('updateend', onUpdateEnd);
        sourceBuffer.removeEventListener('error', onError);

        // Handle QuotaExceededError
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
          console.log('[DvrPlayback] Buffer quota exceeded, removing old data');
          removeOldBufferedData()
            .then(() => {
              sourceBuffer?.appendBuffer(data);
            })
            .catch(reject);
        } else {
          reject(error);
        }
      }
    });
  }

  /**
   * Remove old buffered data to make room for new data
   */
  async function removeOldBufferedData(): Promise<void> {
    if (!sourceBuffer || !videoElement || sourceBuffer.updating) return;

    const currentTime = videoElement.currentTime;
    const removeEnd = Math.max(0, currentTime - MAX_BUFFER_SECONDS);

    if (removeEnd > 0) {
      return new Promise((resolve) => {
        const onUpdateEnd = () => {
          sourceBuffer?.removeEventListener('updateend', onUpdateEnd);
          resolve();
        };
        sourceBuffer?.addEventListener('updateend', onUpdateEnd, { once: true });
        sourceBuffer?.remove(0, removeEnd);
      });
    }
  }

  /**
   * Handle SourceBuffer updateend event
   */
  function handleUpdateEnd() {
    updateBufferedRanges();
  }

  /**
   * Handle SourceBuffer error
   */
  function handleSourceBufferError(event: Event) {
    console.error('[DvrPlayback] SourceBuffer error:', event);
    state.value.error = 'SourceBuffer error';
  }

  /**
   * Handle MediaSource sourceended event
   */
  function handleSourceEnded() {
    console.log('[DvrPlayback] MediaSource ended');
  }

  /**
   * Handle MediaSource error
   */
  function handleMediaSourceError(event: Event) {
    console.error('[DvrPlayback] MediaSource error:', event);
    state.value.error = 'MediaSource error';
  }

  // Track if video event handlers are already set up
  let videoEventHandlersAttached = false;

  /**
   * Set up video element event handlers
   */
  function setupVideoEventHandlers() {
    if (!videoElement || videoEventHandlersAttached) return;
    videoEventHandlersAttached = true;

    console.log('[DvrPlayback] Setting up video event handlers');

    videoElement.addEventListener('playing', () => {
      console.log('[DvrPlayback] Video playing event');
      state.value.isPlaying = true;
      state.value.isPaused = false;
      state.value.isBuffering = false;
    });

    videoElement.addEventListener('pause', () => {
      console.log('[DvrPlayback] Video pause event');
      state.value.isPlaying = false;
      state.value.isPaused = true;
    });

    videoElement.addEventListener('waiting', () => {
      console.log('[DvrPlayback] Video waiting event - triggering chunk load');
      state.value.isBuffering = true;
      // Immediately try to load more chunks when buffering
      checkAndLoadChunks();
    });

    videoElement.addEventListener('canplay', () => {
      console.log('[DvrPlayback] Video canplay event');
      state.value.isBuffering = false;
    });

    videoElement.addEventListener('error', (event) => {
      console.error('[DvrPlayback] Video error:', event);
      state.value.error = 'Video playback error';
    });

    videoElement.addEventListener('timeupdate', () => {
      state.value.currentTime = videoElement?.currentTime || 0;
      state.value.isAtLiveEdge = isAtLiveEdge.value;
    });
  }

  /**
   * Start time update interval
   */
  function startTimeUpdates() {
    if (timeUpdateInterval) clearInterval(timeUpdateInterval);

    timeUpdateInterval = window.setInterval(() => {
      if (videoElement) {
        state.value.currentTime = videoElement.currentTime;
      }
      updateBufferedRanges();
    }, 250);
  }

  /**
   * Start buffer management interval
   */
  function startBufferManagement() {
    if (bufferCheckInterval) clearInterval(bufferCheckInterval);

    // Check every 500ms to be more responsive to playback needs
    bufferCheckInterval = window.setInterval(async () => {
      await checkAndLoadChunks();
    }, 500);
  }

  /**
   * Check and load chunks as needed
   */
  async function checkAndLoadChunks() {
    if (!state.value.isInitialized || !videoElement) return;

    const currentTime = videoElement.currentTime;

    // Find which chunk we're currently in
    const currentChunkIndex = Math.floor(currentTime / CHUNK_DURATION);

    // Load ahead chunks - load all available chunks from current position to buffer ahead
    for (let i = 0; i <= BUFFER_AHEAD_CHUNKS; i++) {
      const chunkIndex = currentChunkIndex + i;
      const chunk = availableChunks.value.find((c) => c.index === chunkIndex);

      // Skip if already loaded or currently loading
      if (chunk && !loadedChunks.has(chunkIndex) && !loadingChunks.has(chunkIndex)) {
        await loadChunk(chunkIndex);
      }
    }

    // Also proactively load any NEW chunks that arrived (even beyond buffer ahead)
    // This ensures we don't miss chunks when at live edge
    const lastLoadedOrLoading = Math.max(lastAppendedChunkIndex, ...Array.from(loadingChunks));
    for (const chunk of availableChunks.value) {
      if (
        chunk.index > lastLoadedOrLoading &&
        !loadedChunks.has(chunk.index) &&
        !loadingChunks.has(chunk.index)
      ) {
        console.log('[DvrPlayback] Proactively loading new chunk:', chunk.index);
        await loadChunk(chunk.index);
      }
    }

    // Remove very old data from buffer if needed
    if (currentTime > MAX_BUFFER_SECONDS) {
      await removeOldBufferedData();
    }
  }

  /**
   * Update buffered ranges state
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
   * Update duration based on available chunks
   */
  function updateDuration() {
    if (availableChunks.value.length === 0) {
      state.value.duration = 0;
      return;
    }

    const lastChunk = availableChunks.value[availableChunks.value.length - 1];
    state.value.duration = lastChunk.endTime;
    state.value.liveEdgeTime = lastChunk.endTime;
  }

  /**
   * Update available chunks (called when new chunks arrive)
   */
  async function updateChunks(chunks: DvrChunk[]) {
    const prevLength = availableChunks.value.length;
    availableChunks.value = chunks;

    // Update duration
    updateDuration();

    // If we weren't initialized (no chunks initially), initialize now
    if (!state.value.isInitialized && chunks.length > 0 && !mediaSource && videoElement && mintId) {
      console.log('[DvrPlayback] Chunks arrived, creating MediaSource now');
      await createMediaSourceAndStart();
      return; // createMediaSourceAndStart will load initial chunks
    }

    // ALWAYS load new chunks when they arrive (don't require isAtLiveEdge)
    // This ensures playback doesn't fall behind
    if (chunks.length > prevLength && state.value.isInitialized) {
      console.log('[DvrPlayback] New chunks available:', chunks.length - prevLength, 'chunks');
      for (let i = prevLength; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (!loadedChunks.has(chunk.index) && !loadingChunks.has(chunk.index)) {
          await loadChunk(chunk.index);
        }
      }
    }
  }

  /**
   * Create MediaSource and start playback (deferred initialization)
   */
  async function createMediaSourceAndStart(): Promise<void> {
    if (!videoElement || !codec) {
      console.error('[DvrPlayback] Cannot create MediaSource - missing video element or codec');
      return;
    }

    try {
      console.log('[DvrPlayback] Creating MediaSource...');

      // Create MediaSource
      mediaSource = new MediaSource();

      // Set up MediaSource event handlers
      mediaSource.addEventListener('sourceopen', handleSourceOpen);
      mediaSource.addEventListener('sourceended', handleSourceEnded);
      mediaSource.addEventListener('error', handleMediaSourceError);

      // Attach to video element
      videoElement.src = URL.createObjectURL(mediaSource);

      // Set up video event handlers
      setupVideoEventHandlers();

      // Start time update interval
      startTimeUpdates();

      console.log('[DvrPlayback] MediaSource created and attached');
    } catch (error) {
      console.error('[DvrPlayback] Failed to create MediaSource:', error);
      state.value.error = `Failed to create MediaSource: ${error}`;
    }
  }

  /**
   * Seek to a specific time
   */
  async function seek(time: number) {
    if (!videoElement || !state.value.isInitialized) return;

    console.log('[DvrPlayback] Seeking to:', time);
    state.value.isBuffering = true;

    // Find which chunk this time is in
    const targetChunkIndex = Math.floor(time / CHUNK_DURATION);

    // Load chunks around the target if not already loaded
    for (
      let i = Math.max(0, targetChunkIndex - 1);
      i <= targetChunkIndex + BUFFER_AHEAD_CHUNKS;
      i++
    ) {
      const chunk = availableChunks.value.find((c) => c.index === i);
      if (chunk && !loadedChunks.has(i)) {
        await loadChunk(i);
      }
    }

    // Perform the seek
    videoElement.currentTime = time;
    state.value.currentTime = time;

    // Update live edge status
    state.value.isAtLiveEdge = time >= state.value.liveEdgeTime - LIVE_EDGE_THRESHOLD;
  }

  /**
   * Seek to live edge
   */
  async function seekToLive() {
    const livePosition = Math.max(0, state.value.liveEdgeTime - CHUNK_DURATION);
    await seek(livePosition);
    state.value.isAtLiveEdge = true;
  }

  /**
   * Play
   */
  async function play() {
    console.log('[DvrPlayback] play() called, videoElement:', !!videoElement);
    if (!videoElement) {
      console.warn('[DvrPlayback] Cannot play - no video element');
      return;
    }

    try {
      await videoElement.play();
      // State will be updated by video 'playing' event handler
    } catch (error) {
      console.error('[DvrPlayback] Play failed:', error);
    }
  }

  /**
   * Pause
   */
  function pause() {
    console.log('[DvrPlayback] pause() called, videoElement:', !!videoElement);
    if (!videoElement) {
      console.warn('[DvrPlayback] Cannot pause - no video element');
      return;
    }
    videoElement.pause();
    // State will be updated by video 'pause' event handler
  }

  /**
   * Toggle play/pause
   */
  async function togglePlayPause() {
    console.log(
      '[DvrPlayback] togglePlayPause() called, isPlaying:',
      state.value.isPlaying,
      'videoElement:',
      !!videoElement
    );
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
    console.log('[DvrPlayback] Cleaning up...');

    // Clear intervals
    if (timeUpdateInterval) {
      clearInterval(timeUpdateInterval);
      timeUpdateInterval = null;
    }
    if (bufferCheckInterval) {
      clearInterval(bufferCheckInterval);
      bufferCheckInterval = null;
    }

    // Clean up MediaSource
    if (mediaSource) {
      if (mediaSource.readyState === 'open') {
        try {
          mediaSource.endOfStream();
        } catch (e) {
          // Ignore
        }
      }
      mediaSource.removeEventListener('sourceopen', handleSourceOpen);
      mediaSource.removeEventListener('sourceended', handleSourceEnded);
      mediaSource.removeEventListener('error', handleMediaSourceError);
      mediaSource = null;
    }

    // Clean up SourceBuffer
    if (sourceBuffer) {
      sourceBuffer.removeEventListener('updateend', handleUpdateEnd);
      sourceBuffer.removeEventListener('error', handleSourceBufferError);
      sourceBuffer = null;
    }

    // Clean up video element
    if (videoElement) {
      videoElement.pause();
      videoElement.src = '';
      videoElement.load();
      videoElement = null;
    }

    // Reset state
    loadedChunks.clear();
    loadingChunks.clear();
    appendQueue.length = 0;
    isAppending = false;
    lastAppendedChunkIndex = -1;
    mintId = null;
    codec = null;
    availableChunks.value = [];
    videoEventHandlersAttached = false;

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
    };
  }

  // Cleanup on unmount
  onUnmounted(() => {
    cleanup();
  });

  return {
    // State
    state,
    availableChunks,

    // Computed
    isAtLiveEdge,

    // Methods
    initialize,
    updateChunks,
    seek,
    seekToLive,
    play,
    pause,
    togglePlayPause,
    setVolume,
    setMuted,
    toggleMute,
    cleanup,
  };
}
