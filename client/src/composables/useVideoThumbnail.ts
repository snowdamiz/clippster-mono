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
    try {
      console.log(`[Thumbnail] Extracting frame from ${videoUrl} at ${timestamp}s`);

      const result = await invoke<{
        success: boolean;
        data_url?: string;
        error?: string;
      }>('extract_video_frame', {
        videoUrl,
        timestamp,
      });

      if (result.success && result.data_url) {
        console.log('[Thumbnail] Frame extracted successfully');
        return result.data_url;
      } else {
        console.error('[Thumbnail] Frame extraction failed:', result.error);
        return null;
      }
    } catch (error) {
      console.error('[Thumbnail] Error calling extract_video_frame:', error);
      return null;
    }
  }

  // Debounced function to extract thumbnails
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
    150
  ); // 150ms debounce

  /**
   * Show tooltip with thumbnail at specific time
   */
  function showTooltipAtTime(videoUrl: string, x: number, y: number, time: number): void {
    // Update current video URL if different
    if (currentVideoUrl.value !== videoUrl) {
      currentVideoUrl.value = videoUrl;
    }

    // Call debounced function
    debouncedExtractFrame(videoUrl, time, x, y);
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
    hideTooltip();
    currentVideoUrl.value = '';
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

    // Methods
    extractFrame,
    showTooltipAtTime,
    hideTooltip,
    updatePosition,
    formatTime,
    cleanup,
  };
}
