import { ref, computed } from 'vue';
import { invoke } from '@tauri-apps/api/core';

// Custom debounce implementation for async functions
function debounceAsync<T extends (...args: any[]) => Promise<any>>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number | null = null;

  return (...args: Parameters<T>) => {
    if (timeout !== null) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(async () => {
      await func(...args);
      timeout = null;
    }, wait);
  };
}

export interface PreFetchStrategy {
  interval: number; // seconds between frames
  maxFrames: number; // maximum frames to pre-fetch
  immediateFrames: number; // frames to pre-fetch immediately
  hotspots?: number[]; // specific timestamps to always pre-fetch
}

export interface VideoThumbnailState {
  show: boolean;
  x: number;
  y: number;
  thumbnailUrl: string | null;
  time: number;
  loading: boolean;
  error: string | null;
}

export function useVideoThumbnail() {
  // State
  const state = ref<VideoThumbnailState>({
    show: false,
    x: 0,
    y: 0,
    thumbnailUrl: null,
    time: 0,
    loading: false,
    error: null,
  });

  // Track current video URL
  const currentVideoUrl = ref<string>('');

  // Track ongoing extractions to prevent duplicates
  const ongoingExtractions = ref<Set<string>>(new Set());

  // Computed properties
  const showTooltip = computed(() => state.value.show);
  const tooltipPosition = computed(() => ({ x: state.value.x, y: state.value.y }));
  const thumbnailUrl = computed(() => state.value.thumbnailUrl);
  const tooltipTime = computed(() => state.value.time);
  const isLoading = computed(() => state.value.loading);
  const hasError = computed(() => !!state.value.error);

  /**
   * Extract a thumbnail frame using the Tauri backend
   */
  async function extractFrame(videoUrl: string, timestamp: number): Promise<string | null> {
    // Create a unique key for this extraction request
    const extractionKey = `${videoUrl}_${timestamp}`;

    // Check if this exact extraction is already in progress
    if (ongoingExtractions.value.has(extractionKey)) {
      // Wait for the existing extraction to complete
      let attempts = 0;
      while (ongoingExtractions.value.has(extractionKey) && attempts < 50) {
        // Wait up to 5 seconds
        await new Promise((resolve) => setTimeout(resolve, 100));
        attempts++;
      }

      // If it's still in progress after timeout, return null
      if (ongoingExtractions.value.has(extractionKey)) {
        return null;
      }
    }

    // Mark this extraction as in progress
    ongoingExtractions.value.add(extractionKey);

    try {
      const result = await invoke<{
        success: boolean;
        data_url?: string;
        error?: string;
      }>('extract_video_frame', {
        videoUrl,
        timestamp,
      });

      // Check if result exists and has the expected structure
      if (result && typeof result === 'object' && 'success' in result) {
        if (result.success && result.data_url) {
          return result.data_url;
        } else {
          return null;
        }
      } else {
        return null;
      }
    } catch (error) {
      return null;
    } finally {
      // Always remove from ongoing extractions when done
      ongoingExtractions.value.delete(extractionKey);
    }
  }

  /**
   * Extract multiple frames in batch for efficiency
   */
  async function extractFramesBatch(
    videoUrl: string,
    timestamps: number[]
  ): Promise<Map<number, string | null>> {
    try {
      const results = await invoke<
        Array<{
          success: boolean;
          data_url?: string;
          error?: string;
        }>
      >('extract_video_frames_batch', {
        videoUrl,
        timestamps,
      });

      // Check if results is valid and is an array
      if (!results || !Array.isArray(results)) {
        return new Map();
      }

      const resultMap = new Map<number, string | null>();
      timestamps.forEach((timestamp, index) => {
        const result = results[index];
        // Check if result exists and has the expected structure
        if (result && typeof result === 'object' && 'success' in result) {
          if (result.success && result.data_url) {
            resultMap.set(timestamp, result.data_url);
          } else {
            resultMap.set(timestamp, null);
          }
        } else {
          resultMap.set(timestamp, null);
        }
      });

      return resultMap;
    } catch (error) {
      return new Map();
    }
  }

  /**
   * Determine pre-fetch strategy based on video duration
   */
  function getPreFetchStrategy(duration: number): PreFetchStrategy {
    if (duration < 1800) {
      // Short videos (<30 min): every 10 seconds
      return {
        interval: 10,
        maxFrames: Math.min(duration / 10, 180),
        immediateFrames: 12, // First 2 minutes
        hotspots: [0, 30, 60, 120, 300, 600, 900, 1200], // Key positions
      };
    } else if (duration < 7200) {
      // Medium videos (30 min - 2 hrs): every 30 seconds
      return {
        interval: 30,
        maxFrames: Math.min(duration / 30, 240),
        immediateFrames: 8, // First 4 minutes
        hotspots: [0, 60, 300, 600, 1800, 3600], // Key positions
      };
    } else {
      // Long videos (>2 hrs): every 1 minute
      return {
        interval: 60,
        maxFrames: Math.min(duration / 60, 180),
        immediateFrames: 6, // First 6 minutes
        hotspots: [0, 60, 300, 600, 1800, 3600, 7200], // Key positions
      };
    }
  }

  /**
   * Generate timestamps for pre-fetching based on strategy
   */
  function generatePreFetchTimestamps(duration: number, strategy: PreFetchStrategy): number[] {
    const timestamps = new Set<number>();

    // Add hotspots first (always pre-fetch these)
    if (strategy.hotspots) {
      strategy.hotspots.forEach((time) => {
        if (time <= duration) timestamps.add(time);
      });
    }

    // Add immediate frames (first X seconds)
    for (let i = 0; i < strategy.immediateFrames; i++) {
      const time = i * strategy.interval;
      if (time <= duration) timestamps.add(time);
    }

    // Add regular intervals
    for (
      let time = strategy.immediateFrames * strategy.interval;
      time <= duration;
      time += strategy.interval
    ) {
      timestamps.add(time);
    }

    // Convert to array and limit by maxFrames
    const result = Array.from(timestamps).sort((a, b) => a - b);
    return result.slice(0, strategy.maxFrames);
  }

  /**
   * Smart pre-fetching based on video duration
   */
  async function smartPreFetch(videoUrl: string, duration: number): Promise<void> {
    if (!videoUrl || duration <= 0) return;

    // Additional check to prevent pre-fetching during cleanup
    if (isPreFetching.value) {
      return;
    }

    const strategy = getPreFetchStrategy(duration);
    const timestamps = generatePreFetchTimestamps(duration, strategy);

    isPreFetching.value = true;

    // Split into batches to avoid overwhelming the system
    const batchSize = 10;
    const promises: Promise<void>[] = [];

    for (let i = 0; i < timestamps.length; i += batchSize) {
      const batch = timestamps.slice(i, i + batchSize);

      const batchPromise = new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Batch timeout'));
        }, 30000); // 30 second timeout per batch

        extractFramesBatch(videoUrl, batch)
          .then(() => {
            clearTimeout(timeoutId);
            resolve();
          })
          .catch((error) => {
            clearTimeout(timeoutId);
            reject(error);
          });
      });

      promises.push(batchPromise);
    }

    try {
      await Promise.all(promises);
      if (isPreFetching.value) {
        // Only log if not interrupted by cleanup
        console.log(`[Thumbnail] Smart pre-fetch completed for ${timestamps.length} frames`);
      }
    } catch (error) {
      if (isPreFetching.value) {
        // Only log if not interrupted by cleanup
        console.error('[Thumbnail] Pre-fetching interrupted:', error);
      }
    } finally {
      isPreFetching.value = false;
    }
  }

  /**
   * Stop all pre-fetching operations and cleanup
   */
  function stopPreFetching() {
    // Mark as not pre-fetching
    isPreFetching.value = false;

    // Clear any active batch operations
    activeBatchOperations.value.forEach((cleanup) => {
      try {
        cleanup();
      } catch (error) {
        console.warn('[Thumbnail] Error during cleanup:', error);
      }
    });
    activeBatchOperations.value = [];

    // Clear pre-fetched videos cache (optional - keep if you want to reuse when re-opening)
    // preFetchedVideos.value.clear();
  }

  // Debounced function to extract thumbnails (minimum debounce for instant response)
  const debouncedExtractFrame = debounceAsync(
    async (videoUrl: string, timestamp: number, x: number, y: number) => {
      // Don't extract if video URL is empty
      if (!videoUrl) {
        hideTooltip();
        return;
      }

      // Update state to show loading
      state.value = {
        show: true,
        x,
        y,
        thumbnailUrl: null,
        time: timestamp,
        loading: true,
        error: null,
      };

      // Extract the frame
      const thumbnailDataUrl = await extractFrame(videoUrl, timestamp);

      // Update state with result
      state.value = {
        ...state.value,
        thumbnailUrl: thumbnailDataUrl,
        loading: false,
        error: thumbnailDataUrl ? null : 'Failed to extract frame',
      };
    },
    50
  ); // Reduced to 50ms for near-instant response

  // Track pre-fetching state
  const isPreFetching = ref(false);
  const preFetchedVideos = ref<Set<string>>(new Set());

  // Track active batch operations for cleanup
  const activeBatchOperations = ref<Array<() => void>>([]);

  /**
   * Show tooltip with thumbnail at specific time
   */
  function showTooltipAtTime(videoUrl: string, x: number, y: number, time: number): void {
    // Update current video URL if different
    if (currentVideoUrl.value !== videoUrl) {
      currentVideoUrl.value = videoUrl;

      // Start smart pre-fetching if this video hasn't been pre-fetched yet
      if (!preFetchedVideos.value.has(videoUrl)) {
        // Estimate video duration for pre-fetching strategy
        // This is a rough estimate - in a real implementation you'd get the actual duration
        const estimatedDuration = estimateVideoDuration(videoUrl);

        // Start pre-fetching in background (don't await)
        smartPreFetch(videoUrl, estimatedDuration).finally(() => {
          preFetchedVideos.value.add(videoUrl);
        });
      }
    }

    // Call debounced function
    debouncedExtractFrame(videoUrl, time, x, y);
  }

  /**
   * Estimate video duration based on URL or use default
   */
  function estimateVideoDuration(_videoUrl: string): number {
    // Try to extract duration info from URL if possible
    // For PumpFun, most streams are 10-60 minutes, so use a reasonable default
    return 1800; // 30 minutes default
  }

  /**
   * Hide tooltip immediately
   */
  function hideTooltip(): void {
    state.value.show = false;
    state.value.thumbnailUrl = null;
    state.value.loading = false;
    state.value.error = null;
  }

  /**
   * Update tooltip position without extracting new frame
   */
  function updatePosition(x: number, y: number): void {
    if (state.value.show) {
      state.value.x = x;
      state.value.y = y;
    }
  }

  /**
   * Format time for display
   */
  function formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    } else {
      return `${m}:${s.toString().padStart(2, '0')}`;
    }
  }

  /**
   * Cleanup resources
   */
  function cleanup(): void {
    stopPreFetching();
    hideTooltip();
    currentVideoUrl.value = '';
    // Clear ongoing extractions
    ongoingExtractions.value.clear();
  }

  return {
    // State
    state,
    showTooltip,
    tooltipPosition,
    thumbnailUrl,
    tooltipTime,
    isLoading,
    hasError,
    currentVideoUrl,
    isPreFetching,

    // Methods
    extractFrame,
    extractFramesBatch,
    smartPreFetch,
    stopPreFetching,
    showTooltipAtTime,
    hideTooltip,
    updatePosition,
    formatTime,
    cleanup,
  };
}
