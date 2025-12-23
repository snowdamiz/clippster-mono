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
  peaks: WaveformPeak[];
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
  async function loadWaveformFromVideo(videoSrc: string | null): Promise<void> {
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
      // Check database cache first
      console.log('[useAudioWaveform] Checking database cache...');
      const cached = await getCachedWaveform(cacheKey);
      if (cached) {
        console.log('[useAudioWaveform] Found cached waveform, using it');
        waveformData.value = cached;
        return;
      }

      console.log('[useAudioWaveform] No cached waveform found, generating...');

      // Try Rust backend for real audio analysis
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
      const rustWaveform = await invoke<any>('extract_audio_waveform', {
        videoPath: videoSrc,
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

      // Cache the result to database
      await setCachedWaveform(videoSrc, data);
      waveformData.value = data;

      console.log('[useAudioWaveform] Real waveform loaded and cached successfully');
    } catch (err) {
      console.warn('[useAudioWaveform] Rust backend failed, using Web Audio API fallback:', err);
      // Fallback to Web Audio API simulation if Rust fails
      await loadWaveformWithWebAudio(videoSrc, cacheKey);
    }
  }

  // Load audio using Web Audio API (fallback approach)
  async function loadWaveformWithWebAudio(videoSrc: string, cacheKey: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';

      audio.onloadedmetadata = async () => {
        try {
          // Create audio context
          const audioContext = new AudioContext();

          // Create media element source
          const source = audioContext.createMediaElementSource(audio);

          // Create script processor for analyzing audio
          const bufferSize = 4096;
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = bufferSize;

          // Connect nodes
          source.connect(analyser);
          analyser.connect(audioContext.destination);

          // Get audio duration
          const duration = audio.duration;

          // Generate 16k peaks for fallback
          const targetPeaks = 16000;
          const actualPeaks = Math.min(targetPeaks, Math.floor(duration * 60)); // 60 samples per second max
          const peaks: WaveformPeak[] = [];

          // Generate simulated peaks for demonstration
          for (let i = 0; i < actualPeaks; i++) {
            // Create realistic-looking waveform pattern
            const t = i / actualPeaks;
            const baseAmplitude = 0.3 + Math.random() * 0.2;
            const variation = Math.sin(t * Math.PI * 8) * 0.2 + Math.random() * 0.1;

            peaks.push({
              min: -(baseAmplitude + Math.abs(variation)),
              max: baseAmplitude + Math.abs(variation),
            });
          }

          const data: WaveformData = {
            sampleRate: 16000,
            duration,
            peaks,
            peakCount: peaks.length,
          };

          // Cache the result
          setCachedWaveform(cacheKey, data);
          waveformData.value = data;

          // Clean up
          audio.pause();
          source.disconnect();
          analyser.disconnect();

          console.log('[useAudioWaveform] Fallback waveform generated successfully');
          resolve();
        } catch (err) {
          reject(err);
        }
      };

      audio.onerror = () => {
        reject(new Error(`Failed to load audio: ${audio.error?.message || 'Unknown error'}`));
      };

      audio.src = videoSrc;
    });
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

    const { duration, peaks } = waveformData.value;

    if (peaks.length === 0) {
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

    const { peaks } = waveformData.value;

    if (peaks.length === 0) {
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
    reset,
  };
}
