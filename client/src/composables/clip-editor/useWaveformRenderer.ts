import { ref, watch, computed, type Ref, type ComputedRef } from 'vue';
import { waveformService } from '@/services/waveformService';

// Debounce helper for zoom changes
function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

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
  /** Get dynamic bar width based on zoom level */
  getBarWidth: () => string;
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
      // console.log('[useWaveformRenderer] No video source path provided');
      return;
    }

    // Check if already loaded
    if (waveformService.isLoaded(path)) {
      // console.log('[useWaveformRenderer] Waveform already loaded');
      isLoaded.value = true;
      peaksCache.value.clear(); // Clear cache to regenerate with new data
      return;
    }

    // Skip if already loading
    if (isLoading.value) {
      // console.log('[useWaveformRenderer] Waveform already loading');
      return;
    }

    try {
      isLoading.value = true;
      // console.log('[useWaveformRenderer] Loading waveform for:', path);

      await waveformService.loadAudio(path);

      isLoaded.value = true;
      peaksCache.value.clear(); // Clear cache to force regeneration with real data

      // console.log('[useWaveformRenderer] Waveform loaded successfully');
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
    // Calculate based on available pixels: 1 bar per 3 pixels
    // This ensures bars scale with zoom - more zoom = more pixels = more bars = more detail
    const segmentWidthPx = segmentDuration * pixelsPerSecond.value;
    const barsPerPixel = 1 / 3; // 1 bar every 3 pixels
    const barCount = Math.floor(segmentWidthPx * barsPerPixel);
    
    // Cap at 5000 bars max to prevent overlap and performance issues
    // For a 72-min video at high zoom, this prevents 20k+ bars from overlapping
    const cappedCount = Math.min(barCount, 5000);
    
    // Minimum 50 bars for very short segments
    const finalCount = Math.max(50, cappedCount);
    
    // console.log('[getWaveformBars]', {
    //   segmentDuration,
    //   pixelsPerSecond: pixelsPerSecond.value,
    //   segmentWidthPx,
    //   barCount,
    //   cappedCount,
    //   finalCount
    // });
    return finalCount;
  }

  /**
   * Get dynamic bar width based on zoom level
   * Returns CSS width value (e.g., "2px", "1px")
   */
  function getBarWidth(): string {
    // At low zoom (< 1), use wider bars
    // At high zoom (> 2), use thinner bars for more detail
    let width: string;
    if (pixelsPerSecond.value < 100) {
      width = '3px';
    } else if (pixelsPerSecond.value < 200) {
      width = '2px';
    } else {
      width = '1px';
    }
    // console.log('[getBarWidth]', {
    //   pixelsPerSecond: pixelsPerSecond.value,
    //   width
    // });
    return width;
  }

  /**
   * Get waveform peaks for a segment (with async caching)
   * Returns cached peaks immediately if available, otherwise returns empty array
   * and fetches peaks asynchronously to update cache
   */
  function getSegmentPeaks(startTime: number, segmentDuration: number): Array<{ min: number; max: number }> {
    const path = videoSourcePath.value;
    // Include pixelWidth in cache key for proper zoom handling
    const numBars = getWaveformBars(segmentDuration);
    const cacheKey = `${path}:${startTime.toFixed(3)}:${(startTime + segmentDuration).toFixed(3)}:${numBars}`;

    // Check cache first
    if (peaksCache.value.has(cacheKey)) {
      const cached = peaksCache.value.get(cacheKey)!;
      // console.log('[getSegmentPeaks] Cache HIT', { cacheKey, peakCount: cached.length });
      return cached;
    }

    // If waveform not loaded yet, return empty array (will use placeholder)
    if (!isLoaded.value || !path) {
      // console.log('[getSegmentPeaks] Not loaded or no path', { isLoaded: isLoaded.value, path });
      return [];
    }

    // Check if service has cached peaks for this exact request
    const servicePeaks = waveformService.getCachedPeaks?.(path, {
      startTime,
      endTime: startTime + segmentDuration,
      pixelWidth: numBars,
    });

    if (servicePeaks) {
      // console.log('[getSegmentPeaks] Service cache HIT', { cacheKey, peakCount: servicePeaks.length });
      peaksCache.value.set(cacheKey, servicePeaks);
      return servicePeaks;
    }

    // console.log('[getSegmentPeaks] Cache MISS - queueing fetch', { cacheKey, numBars });
    // Trigger async fetch (don't await - return placeholder for now)
    // Use requestAnimationFrame to batch multiple fetches in same render cycle
    queuePeakFetch(path, startTime, segmentDuration, numBars, cacheKey);

    return [];
  }

  // Queue of pending peak fetches to batch process
  const pendingFetches = ref<Set<string>>(new Set());
  let fetchQueued = false;

  function queuePeakFetch(
    path: string,
    startTime: number,
    segmentDuration: number,
    numBars: number,
    cacheKey: string
  ): void {
    // Mark this key as pending
    pendingFetches.value.add(cacheKey);

    if (!fetchQueued) {
      fetchQueued = true;
      requestAnimationFrame(async () => {
        fetchQueued = false;
        const fetches = Array.from(pendingFetches.value);
        pendingFetches.value.clear();

        // Process all queued fetches
        await Promise.all(
          fetches.map(async (key) => {
            // Parse key to extract parameters (path:start:end:bars)
            const parts = key.split(':');
            if (parts.length < 4) return;

            const fetchPath = parts[0];
            const fetchStart = parseFloat(parts[1]);
            const fetchEnd = parseFloat(parts[2]);
            const fetchBars = parseInt(parts[3], 10);

            try {
              const peaks = await waveformService.getPeaksForRange(fetchPath, {
                startTime: fetchStart,
                endTime: fetchEnd,
                pixelWidth: fetchBars,
              });

              if (peaks.length > 0) {
                peaksCache.value.set(key, peaks);
              }
            } catch (error) {
              console.error('[useWaveformRenderer] Peak fetch failed:', error);
            }
          })
        );
      });
    }
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
      if (index === 0) {
        // console.log('[getWaveformHeight] No peaks or out of range - using placeholder', {
        //   index,
        //   peakCount: peaks.length,
        //   startTime,
        //   segmentDuration
        // });
      }
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

    if (index === 0) {
      // console.log('[getWaveformHeight] First bar with real peak', {
      //   index,
      //   startTime,
      //   segmentDuration,
      //   peakCount: peaks.length,
      //   peak,
      //   amplitude,
      //   heightPercent
      // });
    }

    return `${heightPercent}%`;
  }

  /**
   * Generate waveform height for audio tracks (uses audio file path)
   * Returns cached peaks or placeholder - never triggers async fetch during render
   */
  function getAudioWaveformHeight(audioFilePath: string, index: number, startTime: number, segmentDuration: number): string {
    // Check if waveform is loaded for this audio file
    if (waveformService.isLoaded(audioFilePath)) {
      const numBars = getWaveformBars(segmentDuration);
      const cacheKey = `${audioFilePath}:${startTime.toFixed(3)}:${(startTime + segmentDuration).toFixed(3)}:${numBars}`;

      // Check local cache first
      if (peaksCache.value.has(cacheKey)) {
        const cached = peaksCache.value.get(cacheKey)!;
        if (cached.length > 0 && index < cached.length) {
          const peak = cached[index];
          const amplitude = Math.max(Math.abs(peak.min), Math.abs(peak.max));
          const heightPercent = Math.max(10, amplitude * 100);
          return `${heightPercent}%`;
        }
      }

      // For cached mode, try sync peaks
      const syncPeaks = waveformService.getPeaksSync(audioFilePath, {
        startTime,
        endTime: startTime + segmentDuration,
        pixelWidth: numBars,
      });

      if (syncPeaks && syncPeaks.length > 0 && index < syncPeaks.length) {
        const peak = syncPeaks[index];
        const amplitude = Math.max(Math.abs(peak.min), Math.abs(peak.max));
        const heightPercent = Math.max(10, amplitude * 100);
        // console.log('[getAudioWaveformHeight] Sync peak', {
        //   index,
        //   audioFilePath,
        //   startTime,
        //   segmentDuration,
        //   peakCount: syncPeaks.length,
        //   peak,
        //   amplitude,
        //   heightPercent
        // });
        return `${heightPercent}%`;
      }

      // console.log('[getAudioWaveformHeight] No cached or sync peaks', {
      //   index,
      //   audioFilePath,
      //   startTime,
      //   segmentDuration,
      //   numBars
      // });
      // Queue async fetch for next frame
      queuePeakFetch(audioFilePath, startTime, segmentDuration, numBars, cacheKey);
    }

    // Fallback to procedural waveform pattern
    // console.log('[getAudioWaveformHeight] Fallback to placeholder', {
    //   index,
    //   audioFilePath,
    //   startTime,
    //   segmentDuration
    // });
    return getPlaceholderHeight(index, 'audio');
  }

  // Watch for video source changes
  watch(videoSourcePath, (newPath) => {
    if (newPath) {
      isLoaded.value = false;
      peaksCache.value.clear();
      pendingFetches.value.clear();
      loadWaveform();
    }
  }, { immediate: true });

  // Watch for zoom level changes with debounce to reduce cache invalidation
  const debouncedInvalidateCache = debounce(() => {
    // console.log('[useWaveformRenderer] Debounced zoom cache clear');
    peaksCache.value.clear();
    pendingFetches.value.clear();
  }, 150); // 150ms debounce

  watch(zoomLevel, () => {
    debouncedInvalidateCache();
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
    getBarWidth,
    getWaveformHeight,
    getAudioWaveformHeight,
    loadWaveform,
    getPeaksForRange,
    invalidateCache,
  };
}
