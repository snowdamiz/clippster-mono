import { ref, computed } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { getDatabase, getRawVideoByPath } from '@/services/database';

export interface WaveformPeak {
  min: number;
  max: number;
}

// Simplified single-resolution waveform data structure
// Frontend will downsample as needed for different zoom levels
export interface WaveformData {
  sampleRate: number;
  duration: number;
  channelData?: Float32Array; // Raw data for infinite zoom fidelity (optional)
  peaks?: WaveformPeak[]; // Legacy: kept for compatibility with cached JSON
  peakCount: number;
}

// Downsample peaks for lower zoom levels
// Aggregates peaks in range by taking min of mins and max of maxes
function downsamplePeaks(peaks: WaveformPeak[], targetCount: number): WaveformPeak[] {
  if (peaks.length <= targetCount || targetCount <= 0) {
    return peaks;
  }

  const ratio = peaks.length / targetCount;
  const result: WaveformPeak[] = [];

  for (let i = 0; i < targetCount; i++) {
    const startIdx = Math.floor(i * ratio);
    const endIdx = Math.floor((i + 1) * ratio);

    // Aggregate peaks in range (take min of mins, max of maxes)
    let min = 0;
    let max = 0;
    for (let j = startIdx; j < endIdx && j < peaks.length; j++) {
      min = Math.min(min, peaks[j].min);
      max = Math.max(max, peaks[j].max);
    }
    result.push({ min, max });
  }
  return result;
}

// Calculate peaks from raw channel data for a target pixel count
function calculatePeaksFromRaw(
  data: Float32Array, 
  targetCount: number,
  startTime: number = 0,
  duration: number
): WaveformPeak[] {
  if (!data || data.length === 0 || targetCount <= 0) return [];
  
  const sampleRate = data.length / duration;
  const startSample = Math.floor(startTime * sampleRate);
  
  // Safety check
  if (startSample >= data.length) return [];
  
  // If we want more peaks than samples available, just return all samples
  const samplesAvailable = data.length - startSample;
  if (targetCount >= samplesAvailable) {
    const result: WaveformPeak[] = [];
    for (let i = 0; i < samplesAvailable; i++) {
      const val = data[startSample + i];
      result.push({ min: val, max: val });
    }
    return result;
  }
  
  const step = samplesAvailable / targetCount;
  const result: WaveformPeak[] = [];
  
  for (let i = 0; i < targetCount; i++) {
    const start = startSample + Math.floor(i * step);
    const end = startSample + Math.floor((i + 1) * step);
    
    // Max pooling for audio visualization
    // We want the most prominent feature in this window
    let min = 0;
    let max = 0;
    
    // Scan the window
    for (let j = start; j < end && j < data.length; j++) {
      const val = data[j];
      if (val < min) min = val;
      if (val > max) max = val;
    }
    
    // If we found nothing (e.g. window < 1 sample), take the nearest sample
    if (min === 0 && max === 0 && end > start) {
      const val = data[start];
      min = val;
      max = val;
    }
    
    result.push({ min, max });
  }
  
  return result;
}

export function useAudioWaveform() {
  const waveformData = ref<WaveformData | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Computed properties
  const hasWaveform = computed(() => waveformData.value !== null);
  const isLoaded = computed(() => !isLoading.value && hasWaveform.value);

  // Generate cache key from video source
  function getCacheKey(videoSrc: string | null): string | null {
    if (!videoSrc) return null;

    // Create a simple hash of the full path for unique identification
    let hash = 0;
    const str = videoSrc;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString();
  }

  // Get cached waveform data from database
  async function getCachedWaveform(cacheKey: string): Promise<WaveformData | null> {
    try {
      console.log('[useAudioWaveform] Checking cache for key:', cacheKey);
      const db = await getDatabase();

      // Try to get from cache first
      const result = await db.select<
        {
          id: string;
          sample_rate: number;
          duration: number;
          resolutions: string;
          file_size: number;
          file_modified_time: number;
        }[]
      >(
        `SELECT id, sample_rate, duration, resolutions, file_size, file_modified_time
         FROM waveform_data
         WHERE video_path_hash = ?1`,
        [cacheKey]
      );

      console.log('[useAudioWaveform] Cache query result count:', result.length);

      if (result.length === 0) {
        console.log('[useAudioWaveform] No cached waveform found for key:', cacheKey);
        return null;
      }

      const cached = result[0];
      console.log(
        '[useAudioWaveform] Found cached waveform:',
        cached.id,
        'duration:',
        cached.duration
      );

      // Parse peaks from JSON - handle both old multi-resolution and new single-array format
      const parsed = JSON.parse(cached.resolutions);

      let waveform: WaveformData;

      // Check if it's old format (has resolutions object) or new format (has peaks array)
      if (Array.isArray(parsed)) {
        // New format: direct peaks array
        waveform = {
          sampleRate: cached.sample_rate,
          duration: cached.duration,
          peaks: parsed,
          peakCount: parsed.length,
        };
      } else if (parsed.peaks && Array.isArray(parsed.peaks)) {
        // New format with wrapper object
        waveform = {
          sampleRate: cached.sample_rate,
          duration: cached.duration,
          peaks: parsed.peaks,
          peakCount: parsed.peakCount || parsed.peaks.length,
        };
      } else {
        // Old multi-resolution format - extract highest resolution available
        const resolutionOrder = ['maximum', 'extreme', 'ultra', 'high', 'medium', 'low'];
        let bestPeaks: WaveformPeak[] = [];

        for (const level of resolutionOrder) {
          if (parsed[level]?.peaks) {
            bestPeaks = parsed[level].peaks.map((p: any) => ({ min: p.min, max: p.max }));
            console.log(`[useAudioWaveform] Using ${level} resolution from old cache format`);
            break;
          }
        }

        if (bestPeaks.length === 0) {
          // Fallback: use first available resolution
          const firstKey = Object.keys(parsed)[0];
          if (firstKey && parsed[firstKey]?.peaks) {
            bestPeaks = parsed[firstKey].peaks.map((p: any) => ({ min: p.min, max: p.max }));
          }
        }

        waveform = {
          sampleRate: cached.sample_rate,
          duration: cached.duration,
          peaks: bestPeaks,
          peakCount: bestPeaks.length,
        };
      }

      console.log(
        '[useAudioWaveform] Successfully loaded waveform from database cache, peaks:',
        waveform.peakCount
      );
      return waveform;
    } catch (err) {
      console.error('[useAudioWaveform] Error loading from cache:', err);
      return null;
    }
  }

  // Save waveform data to database
  async function setCachedWaveform(videoSrc: string, data: WaveformData): Promise<void> {
    try {
      const db = await getDatabase();

      // Generate metadata
      const videoPathHash = getCacheKey(videoSrc);
      if (!videoPathHash) return;

      // For file size and modified time, we'll use the current timestamp
      const now = Date.now();

      // Try to find any existing raw video record - we don't need exact path match
      console.log('[useAudioWaveform] Looking for any raw video to associate with waveform');

      // First try the exact path match
      let existingRawVideo = await getRawVideoByPath(videoSrc);
      let rawVideoId = null;

      if (!existingRawVideo) {
        // If exact match fails, just get any raw video record as a fallback
        // The important thing is to cache the waveform, not perfect association
        const { getAllRawVideos } = await import('@/services/database');
        const allRawVideos = await getAllRawVideos();

        if (allRawVideos.length > 0) {
          console.log('[useAudioWaveform] Using first available raw video as fallback for caching');
          existingRawVideo = allRawVideos[0];
        }
      }

      if (existingRawVideo) {
        console.log(
          '[useAudioWaveform] Found raw video for waveform cache:',
          existingRawVideo.id,
          'with file_path:',
          existingRawVideo.file_path
        );
        rawVideoId = existingRawVideo.id;
      } else {
        console.error(
          '[useAudioWaveform] No raw videos found in database at all - cannot cache waveform'
        );
        return; // Exit early to prevent NOT NULL constraint error
      }

      // Save to database - store peaks directly as JSON
      await db.execute(
        `INSERT OR REPLACE INTO waveform_data (
          id, raw_video_id, video_path_hash, sample_rate, duration,
          resolutions, file_size, file_modified_time, created_at, accessed_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
        [
          `waveform_${videoPathHash}`,
          rawVideoId,
          videoPathHash,
          data.sampleRate,
          data.duration,
          JSON.stringify({ peaks: data.peaks, peakCount: data.peakCount }),
          0, // file_size - will be updated later
          now, // file_modified_time
          now,
          now,
        ]
      );

      console.log(
        '[useAudioWaveform] Saved waveform to database cache with raw_video_id:',
        rawVideoId || 'null (fallback caching)'
      );
    } catch (err) {
      console.error('[useAudioWaveform] Error saving to cache:', err);
    }
  }

  // Load and process audio from video file
  async function loadWaveformFromVideo(videoSrc: string | null, skipCache: boolean = false): Promise<void> {
    if (!videoSrc) {
      waveformData.value = null;
      return;
    }

    const cacheKey = getCacheKey(videoSrc);
    console.log('[useAudioWaveform] Generated cache key for video:', videoSrc, '=>', cacheKey);
    if (!cacheKey) {
      error.value = 'Invalid video source';
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      // IMPORTANT: Skip frontend database cache entirely
      // The database cache has been causing waveform accuracy issues because:
      // 1. Old incorrect waveforms were cached before the FFmpeg path fix
      // 2. The cache key doesn't match between frontend and Rust backend
      // 
      // The Rust backend has its own file-based cache that is reliable.
      // Let Rust handle all caching - it will return cached data if available.
      console.log('[useAudioWaveform] Requesting waveform from Rust backend (Rust handles caching)...');

      // Use Rust backend for real audio analysis - it has its own cache
      await loadWaveformWithRust(videoSrc, cacheKey);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load waveform';
      error.value = errorMessage;
      console.error('[useAudioWaveform] Error loading waveform:', err);
    } finally {
      isLoading.value = false;
    }
  }

  // Load audio using Rust backend (primary approach)
  async function loadWaveformWithRust(videoSrc: string, cacheKey: string): Promise<void> {
    try {
      console.log('[useAudioWaveform] Loading waveform using Rust backend');

      // Call Rust function to extract real audio waveform
      // Force regenerate to bypass any stale Rust file cache
      const rustWaveform = await invoke<any>('extract_audio_waveform', {
        videoPath: videoSrc,
        forceRegenerate: true, // Always regenerate to ensure accuracy
      });

      console.log('[useAudioWaveform] Received waveform data from Rust:', {
        peakCount: rustWaveform.peak_count,
        sampleRate: rustWaveform.sample_rate,
        duration: rustWaveform.duration,
      });

      // Convert Rust data structure to our TypeScript interface
      const data: WaveformData = {
        sampleRate: rustWaveform.sample_rate,
        duration: rustWaveform.duration,
        peaks: rustWaveform.peaks.map((peak: any) => ({
          min: peak.min,
          max: peak.max,
        })),
        peakCount: rustWaveform.peak_count,
      };

      // Skip frontend database caching - Rust backend handles its own file cache
      // This avoids cache key mismatches and stale data issues
      waveformData.value = data;

      console.log('[useAudioWaveform] Real waveform loaded successfully from Rust backend');
    } catch (err) {
      // Don't use fake fallback - just report the error
      // Fake waveforms cause more confusion than showing nothing
      console.error('[useAudioWaveform] Rust backend failed to extract waveform:', err);
      error.value = `Failed to extract audio waveform: ${err instanceof Error ? err.message : 'Unknown error'}`;
      throw err;
    }
  }

  // Clear cached waveform data for a video (forces regeneration)
  async function clearCachedWaveform(videoSrc: string): Promise<void> {
    const cacheKey = getCacheKey(videoSrc);
    if (!cacheKey) return;

    try {
      console.log('[useAudioWaveform] Clearing cached waveform for:', videoSrc);
      const db = await getDatabase();
      
      // Delete from database cache
      await db.execute(
        `DELETE FROM waveform_data WHERE video_path_hash = ?1`,
        [cacheKey]
      );
      
      // Also try to clear Rust file cache
      try {
        await invoke('clear_waveform_cache', { videoPath: videoSrc });
      } catch (e) {
        // Rust cache clear is optional, ignore errors
        console.log('[useAudioWaveform] Rust cache clear not available or failed:', e);
      }
      
      console.log('[useAudioWaveform] Cache cleared successfully');
    } catch (err) {
      console.error('[useAudioWaveform] Error clearing cache:', err);
    }
  }

  // Clear ALL cached waveforms from database
  async function clearAllCachedWaveforms(): Promise<void> {
    try {
      console.log('[useAudioWaveform] Clearing ALL cached waveforms from database');
      const db = await getDatabase();
      
      // Delete all waveform data from database
      await db.execute(`DELETE FROM waveform_data`);
      
      console.log('[useAudioWaveform] All waveform caches cleared successfully');
    } catch (err) {
      console.error('[useAudioWaveform] Error clearing all caches:', err);
    }
  }

  // Force regenerate waveform (clears cache and reloads)
  async function forceRegenerateWaveform(videoSrc: string | null): Promise<void> {
    if (!videoSrc) return;
    
    // Clear existing cache from both database and Rust file cache
    await clearCachedWaveform(videoSrc);
    
    // Reset state
    waveformData.value = null;
    isLoading.value = true;
    error.value = null;
    
    try {
      // Call Rust directly, bypassing all caches
      console.log('[useAudioWaveform] Force regenerating waveform from Rust backend');
      
      // First clear the Rust file cache
      try {
        await invoke('clear_waveform_cache', { videoPath: videoSrc });
      } catch (e) {
        console.log('[useAudioWaveform] Rust cache clear failed:', e);
      }
      
      // Now extract fresh waveform with force_regenerate flag
      const rustWaveform = await invoke<any>('extract_audio_waveform', {
        videoPath: videoSrc,
        forceRegenerate: true,
      });

      console.log('[useAudioWaveform] Fresh waveform data from Rust:', {
        peakCount: rustWaveform.peak_count,
        sampleRate: rustWaveform.sample_rate,
        duration: rustWaveform.duration,
      });

      // Convert Rust data structure to our TypeScript interface
      const data: WaveformData = {
        sampleRate: rustWaveform.sample_rate,
        duration: rustWaveform.duration,
        peaks: rustWaveform.peaks.map((peak: any) => ({
          min: peak.min,
          max: peak.max,
        })),
        peakCount: rustWaveform.peak_count,
      };

      // Cache the fresh result to database
      await setCachedWaveform(videoSrc, data);
      waveformData.value = data;

      console.log('[useAudioWaveform] Fresh waveform loaded and cached successfully');
    } catch (err) {
      console.error('[useAudioWaveform] Force regeneration failed:', err);
      error.value = `Failed to regenerate waveform: ${err instanceof Error ? err.message : 'Unknown error'}`;
    } finally {
      isLoading.value = false;
    }
  }

  // Get waveform peaks for rendering in a specific time range
  function getWaveformForTimeRange(
    startTime: number,
    endTime: number,
    width: number,
    _zoomLevel: number = 1
  ): WaveformPeak[] {
    if (!waveformData.value || !hasWaveform.value) {
      return [];
    }

    const { duration, peaks, channelData } = waveformData.value;

    // Prefer raw channel data for highest fidelity
    if (channelData && channelData.length > 0) {
      const startSample = Math.floor((startTime / duration) * channelData.length);
      // Ensure we have at least some width to calculate
      const targetWidth = Math.max(1, Math.floor(width));
      return calculatePeaksFromRaw(channelData, targetWidth, startTime, endTime - startTime);
    }

    // Fallback to pre-computed peaks
    if (!peaks || peaks.length === 0) {
      return [];
    }

    const startRatio = startTime / duration;
    const endRatio = endTime / duration;

    const startIndex = Math.floor(startRatio * peaks.length);
    const endIndex = Math.ceil(endRatio * peaks.length);

    const slicedPeaks = peaks.slice(startIndex, endIndex);

    // Downsample if we have more peaks than pixels
    if (slicedPeaks.length > width) {
      return downsamplePeaks(slicedPeaks, Math.floor(width));
    }

    return slicedPeaks;
  }

  // Get normalized waveform data for canvas rendering
  // Dynamically downsamples from the single high-resolution source
  function getNormalizedWaveform(
    width: number,
    _height: number,
    zoomLevel: number = 1
  ): { peaks: WaveformPeak[]; barWidth: number; resolution: string } {
    if (!waveformData.value || !hasWaveform.value) {
      return { peaks: [], barWidth: 1, resolution: 'high' };
    }

    const { peaks, channelData, duration } = waveformData.value;

    // Prefer raw channel data
    if (channelData && channelData.length > 0) {
      const effectiveWidth = width * zoomLevel;
      // Use the raw data to calculate exactly the peaks we need
      const calculatedPeaks = calculatePeaksFromRaw(channelData, Math.floor(effectiveWidth), 0, duration);
      
      const barWidth = Math.max(1, width / calculatedPeaks.length);
      
      return {
        peaks: calculatedPeaks,
        barWidth,
        resolution: 'maximum' // Raw data is always maximum resolution
      };
    }

    if (!peaks || peaks.length === 0) {
      return { peaks: [], barWidth: 1, resolution: 'high' };
    }

    // Calculate target peak count based on canvas width and zoom level
    const effectiveWidth = width * zoomLevel;
    const targetPeakCount = Math.min(Math.floor(effectiveWidth), peaks.length);

    // Downsample if necessary
    const displayPeaks =
      targetPeakCount < peaks.length ? downsamplePeaks(peaks, targetPeakCount) : peaks;

    // Calculate bar width to fill the canvas
    const barWidth = Math.max(1, width / displayPeaks.length);

    // Determine a resolution label for debugging/display
    let resolution = 'high';
    if (displayPeaks.length >= 16000) {
      resolution = 'maximum';
    } else if (displayPeaks.length >= 8000) {
      resolution = 'extreme';
    } else if (displayPeaks.length >= 4000) {
      resolution = 'ultra';
    } else if (displayPeaks.length >= 2000) {
      resolution = 'high';
    } else if (displayPeaks.length >= 1000) {
      resolution = 'medium';
    } else {
      resolution = 'low';
    }

    return {
      peaks: displayPeaks,
      barWidth,
      resolution,
    };
  }

  // Reset the composable state
  function reset(): void {
    waveformData.value = null;
    isLoading.value = false;
    error.value = null;
  }

  return {
    // State
    waveformData: computed(() => waveformData.value),
    isLoading: computed(() => isLoading.value),
    error: computed(() => error.value),
    hasWaveform,
    isLoaded,

    // Methods
    loadWaveformFromVideo,
    getWaveformForTimeRange,
    getNormalizedWaveform,
    clearCachedWaveform,
    clearAllCachedWaveforms,
    forceRegenerateWaveform,
    reset,
  };
}
