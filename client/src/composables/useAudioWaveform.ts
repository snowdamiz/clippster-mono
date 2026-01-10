/**
 * Audio Waveform Composable
 * 
 * @deprecated This composable is deprecated. Use the new waveformService instead:
 * ```typescript
 * import { waveformService, useWaveform } from '@/services/waveformService';
 * ```
 * 
 * This file is kept for backwards compatibility and re-exports from the new service.
 */

import { useWaveform, type WaveformPeak, type AudioData } from '@/services/waveformService';
import { computed } from 'vue';

// Re-export types for backwards compatibility
export type { WaveformPeak };

// Legacy interface - kept for compatibility
export interface WaveformData {
  sampleRate: number;
  duration: number;
  channelData?: Float32Array;
  peaks?: WaveformPeak[];
  peakCount: number;
}

/**
 * @deprecated Use useWaveform from '@/services/waveformService' instead
 */
export function useAudioWaveform() {
  console.warn('[useAudioWaveform] This composable is deprecated. Use useWaveform from @/services/waveformService instead.');
  
  const waveform = useWaveform();

  // Convert to legacy WaveformData format
  const waveformData = computed<WaveformData | null>(() => {
    const data = waveform.audioData.value;
    if (!data) return null;
    
    return {
      sampleRate: data.sampleRate,
      duration: data.duration,
      channelData: data.channelData,
      peaks: [], // Legacy format - not used in new system
      peakCount: data.channelData.length,
    };
  });

  return {
    // State (legacy format)
    waveformData,
    isLoading: waveform.isLoading,
    error: waveform.error,
    hasWaveform: computed(() => waveform.isLoaded.value),
    isLoaded: waveform.isLoaded,

    // Methods
    loadWaveformFromVideo: waveform.load,
    getWaveformForTimeRange: waveform.getPeaks,
    getNormalizedWaveform: (width: number, _height: number, _zoomLevel: number = 1) => {
      const data = waveform.audioData.value;
      if (!data) return { peaks: [], barWidth: 1, resolution: 'high' };
      
      const peaks = waveform.getPeaks({
        startTime: 0,
        endTime: data.duration,
        pixelWidth: width,
      });
      
      return {
        peaks,
        barWidth: 1,
        resolution: 'maximum',
      };
    },
    clearCachedWaveform: waveform.clearCache,
    clearAllCachedWaveforms: async () => {
      const { waveformService } = await import('@/services/waveformService');
      await waveformService.clearAllCache();
    },
    forceRegenerateWaveform: async (videoSrc: string | null) => {
      if (videoSrc) {
        await waveform.clearCache();
        await waveform.load(videoSrc, true);
      }
    },
    reset: waveform.reset,
  };
}
