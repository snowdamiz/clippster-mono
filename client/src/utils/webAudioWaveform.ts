/**
 * Web Audio API waveform extraction
 * 
 * @deprecated This module is deprecated. Use waveformService instead:
 * ```typescript
 * import { waveformService, useWaveform } from '@/services/waveformService';
 * ```
 * 
 * This file is kept for backwards compatibility with existing code.
 * It re-exports types and provides thin wrappers around the new waveformService.
 */

import { waveformService, type AudioData } from '@/services/waveformService';

// Re-export types for backwards compatibility
export type { WaveformPeak } from '@/services/waveformService';

export interface WebAudioWaveformData {
  channelData: Float32Array;
  duration: number;
  sampleRate: number;
}

/**
 * Extract waveform data from a video/audio file using Web Audio API
 * 
 * @deprecated Use waveformService.loadAudio() instead
 */
export async function extractWaveformFromUrl(
  videoUrl: string
): Promise<WebAudioWaveformData> {
  console.warn('[WebAudioWaveform] extractWaveformFromUrl is deprecated. Use waveformService.loadAudio() instead.');
  
  const data = await waveformService.loadAudio(videoUrl);
  
  return {
    channelData: data.channelData,
    duration: data.duration,
    sampleRate: data.sampleRate,
  };
}

/**
 * Extract waveform from a video element
 * 
 * @deprecated Use waveformService.loadAudio(videoElement.src) instead
 */
export async function extractWaveformFromVideoElement(
  videoElement: HTMLVideoElement
): Promise<WebAudioWaveformData> {
  const videoUrl = videoElement.src || videoElement.currentSrc;
  if (!videoUrl) {
    throw new Error('Video element has no source');
  }
  
  return extractWaveformFromUrl(videoUrl);
}
