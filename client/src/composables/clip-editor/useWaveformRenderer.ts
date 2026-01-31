import { ref, watch, computed, type Ref, type ComputedRef } from 'vue';
import { waveformService } from '@/services/waveformService';

/**
 * Options for useWaveformRenderer
 */
export interface WaveformRendererOptions {
  /** Path to the video/audio source */
  videoSourcePath: ComputedRef<string | null | undefined>;
  /** Zoom level for the timeline */
  zoomLevel: ComputedRef<number>;
  /** Pixels per second (for bar calculation) */
  pixelsPerSecond: ComputedRef<number>;
}

/**
 * Waveform peak data
 */
export interface WaveformPeak {
  min: number;
  max: number;
}

/**
 * Return type for useWaveformRenderer
 */
export interface WaveformRendererReturn {
  /** Whether waveform is currently loading */
  isLoading: Ref<boolean>;
  /** Whether waveform is loaded and ready */
  isLoaded: Ref<boolean>;
  /** Get number of waveform bars for a segment duration */
  getWaveformBars: (segmentDuration: number) => number;
  /** Get waveform height for a specific bar in a video segment */
  getWaveformHeight: (index: number, startTime: number, segmentDuration: number) => string;
  /** Get waveform height for an audio track segment */
  getAudioWaveformHeight: (audioFilePath: string, index: number, startTime: number, segmentDuration: number) => string;
  /** Load waveform data for the video source */
  loadWaveform: () => Promise<void>;
  /** Get peaks for a specific time range */
  getPeaksForRange: (startTime: number, segmentDuration: number) => WaveformPeak[];
  /** Invalidate the peak cache (e.g., on zoom change) */
  invalidateCache: () => void;
}

/**
 * useWaveformRenderer - Waveform visualization logic for timeline
 *
 * Extracts waveform rendering logic from ClipEditorTimeline:
 * - loadWaveformData()
 * - getWaveformBars()
 * - getSegmentPeaks()
 * - getWaveformHeight()
 * - getAudioWaveformHeight()
 *
 * Usage:
 * ```ts
 * const {
 *   isLoading,
 *   isLoaded,
 *   getWaveformBars,
 *   getWaveformHeight,
 *   getAudioWaveformHeight,
 * } = useWaveformRenderer({
 *   videoSourcePath: computed(() => props.videoSourcePath),
 *   zoomLevel: computed(() => props.zoomLevel),
 *   pixelsPerSecond,
 * });
 * ```
 */
export function useWaveformRenderer(options: WaveformRendererOptions): WaveformRendererReturn {
  const { videoSourcePath, zoomLevel, pixelsPerSecond } = options;

  const isLoading = ref(false);
  const isLoaded = ref(false);
  const peaksCache = ref<Map<string, Array<{ min: number; max: number }>>>(new Map());

  /**
   * Load waveform data for the video source
   */
  async function loadWaveform(): Promise<void> {
    const path = videoSourcePath.value;
    if (!path) {
      console.log('[useWaveformRenderer] No video source path provided');
      return;
    }

    // Check if already loaded
    if (waveformService.isLoaded(path)) {
      console.log('[useWaveformRenderer] Waveform already loaded');
      isLoaded.value = true;
      peaksCache.value.clear(); // Clear cache to regenerate with new data
      return;
    }

    // Skip if already loading
    if (isLoading.value) {
      console.log('[useWaveformRenderer] Waveform already loading');
      return;
    }

    try {
      isLoading.value = true;
      console.log('[useWaveformRenderer] Loading waveform for:', path);

      await waveformService.loadAudio(path);

      isLoaded.value = true;
      peaksCache.value.clear(); // Clear cache to force regeneration with real data

      console.log('[useWaveformRenderer] Waveform loaded successfully');
    } catch (error) {
      console.error('[useWaveformRenderer] Failed to load waveform:', error);
      isLoaded.value = false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Get number of waveform bars based on segment duration and zoom
   */
  function getWaveformBars(segmentDuration: number): number {
    // More bars for longer segments and higher zoom levels
    const baseBarCount = 50;
    const scaledCount = Math.max(baseBarCount, Math.floor(segmentDuration * pixelsPerSecond.value / 4));
    return Math.min(scaledCount, 500); // Cap at 500 bars for performance
  }

  /**
   * Get waveform peaks for a segment (with caching)
   */
  function getSegmentPeaks(startTime: number, segmentDuration: number): Array<{ min: number; max: number }> {
    const path = videoSourcePath.value;
    const cacheKey = `${startTime}-${segmentDuration}`;

    // Check cache first
    if (peaksCache.value.has(cacheKey)) {
      return peaksCache.value.get(cacheKey)!;
    }

    // If waveform not loaded yet, return empty array
    if (!isLoaded.value || !path) {
      return [];
    }

    // Get peaks from waveform service (sync for render path)
    const numBars = getWaveformBars(segmentDuration);
    const peaks = waveformService.getPeaksSync(path, {
      startTime,
      endTime: startTime + segmentDuration,
      pixelWidth: numBars,
    });

    if (!peaks) {
      return [];
    }

    // Cache the result
    peaksCache.value.set(cacheKey, peaks);

    return peaks;
  }

  /**
   * Generate a placeholder waveform pattern (used when real data not loaded)
   */
  function getPlaceholderHeight(index: number, variant: 'video' | 'audio' = 'video'): string {
    const time = index / 10;
    let height: number;

    if (variant === 'video') {
      height =
        Math.abs(Math.sin(time * 0.5) * 0.6) +
        Math.abs(Math.sin(time * 1.2) * 0.3) +
        Math.abs(Math.sin(time * 2.8) * 0.1);
    } else {
      height =
        Math.abs(Math.sin(time * 0.7) * 0.5) +
        Math.abs(Math.sin(time * 1.5) * 0.3) +
        Math.abs(Math.sin(time * 3.2) * 0.2);
    }

    return `${Math.max(variant === 'video' ? 10 : 15, height * 100)}%`;
  }

  /**
   * Generate waveform height from real peak data (for video segments)
   */
  function getWaveformHeight(index: number, startTime: number, segmentDuration: number): string {
    const peaks = getSegmentPeaks(startTime, segmentDuration);

    if (peaks.length === 0 || index >= peaks.length) {
      // Fallback to placeholder pattern if no data
      return getPlaceholderHeight(index, 'video');
    }

    const peak = peaks[index];
    // Safety check: if peak is undefined, use placeholder
    if (!peak || typeof peak.min !== 'number' || typeof peak.max !== 'number') {
      return getPlaceholderHeight(index, 'video');
    }
    
    // Calculate amplitude from min/max (use the larger absolute value)
    const amplitude = Math.max(Math.abs(peak.min), Math.abs(peak.max));

    // Scale to percentage (with minimum height for visibility)
    const heightPercent = Math.max(10, amplitude * 100);

    return `${heightPercent}%`;
  }

  /**
   * Generate waveform height for audio tracks (uses audio file path)
   */
  function getAudioWaveformHeight(audioFilePath: string, index: number, startTime: number, segmentDuration: number): string {
    // Check if waveform is loaded for this audio file
    if (waveformService.isLoaded(audioFilePath)) {
      const numBars = getWaveformBars(segmentDuration);
      const peaks = waveformService.getPeaksSync(audioFilePath, {
        startTime,
        endTime: startTime + segmentDuration,
        pixelWidth: numBars,
      });

      if (peaks && peaks.length > 0 && index < peaks.length) {
        const peak = peaks[index];
        const amplitude = Math.max(Math.abs(peak.min), Math.abs(peak.max));
        const heightPercent = Math.max(10, amplitude * 100);
        return `${heightPercent}%`;
      }
    }

    // Fallback to procedural waveform pattern
    return getPlaceholderHeight(index, 'audio');
  }

  // Watch for video source changes
  watch(videoSourcePath, (newPath) => {
    if (newPath) {
      isLoaded.value = false;
      peaksCache.value.clear();
      loadWaveform();
    }
  }, { immediate: true });

  // Watch for zoom level changes to invalidate peak cache
  watch(zoomLevel, () => {
    peaksCache.value.clear();
  });

  /**
   * Invalidate the peak cache (e.g., on zoom change)
   */
  function invalidateCache(): void {
    peaksCache.value.clear();
  }

  /**
   * Get peaks for a specific time range (public API for getSegmentPeaks)
   */
  function getPeaksForRange(startTime: number, segmentDuration: number): WaveformPeak[] {
    return getSegmentPeaks(startTime, segmentDuration);
  }

  return {
    isLoading,
    isLoaded,
    getWaveformBars,
    getWaveformHeight,
    getAudioWaveformHeight,
    loadWaveform,
    getPeaksForRange,
    invalidateCache,
  };
}
