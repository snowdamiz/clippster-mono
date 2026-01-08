/**
 * Web Audio API waveform extraction
 * Extracts audio peaks directly from video/audio files using the browser's native decoder
 * This guarantees perfect sync with video playback since it uses the same decoder
 */

import { invoke, convertFileSrc } from '@tauri-apps/api/core';

export interface WaveformPeak {
  min: number;
  max: number;
}

export interface WebAudioWaveformData {
  // peaks: WaveformPeak[]; // Legacy: removed in favor of raw data
  channelData: Float32Array; // Full raw audio data for high-fidelity rendering
  duration: number;
  sampleRate: number;
  // peakCount: number; // Legacy
}

/**
 * Extract waveform peaks from a video/audio file using Web Audio API
 * This uses the browser's native decoder, guaranteeing sync with video playback
 * 
 * @param videoUrl - URL to the video file (can be blob URL or file URL)
 * @returns Promise<WebAudioWaveformData>
 */
export async function extractWaveformFromUrl(
  videoUrl: string
): Promise<WebAudioWaveformData> {
  console.log('[WebAudioWaveform] Starting extraction from:', videoUrl);
  let arrayBuffer: ArrayBuffer;

  const resolveLocalPath = (url: string): string | null => {
    if (url.startsWith('file://')) {
      return decodeURIComponent(url.replace('file://', ''));
    }
    if (/^[a-zA-Z]:\\/.test(url) || url.startsWith('/')) {
      return url;
    }
    const markers = ['asset://localhost/', 'http://asset.localhost/', 'https://asset.localhost/'];
    for (const marker of markers) {
      const idx = url.indexOf(marker);
      if (idx !== -1) {
        const encoded = url.slice(idx + marker.length);
        try {
          return decodeURIComponent(encoded);
        } catch {
          return null;
        }
      }
    }
    return null;
  };

  const tryReadLocal = async (path: string): Promise<ArrayBuffer | null> => {
    const tauriFs = (window as any).__TAURI__?.fs;
    if (!tauriFs?.readBinaryFile) {
      // Not in Tauri shell (plain Vite/browser)
      return null;
    }
    try {
      const data = await tauriFs.readBinaryFile(path);
      console.log('[WebAudioWaveform] Loaded file via Tauri fs.readBinaryFile:', path, 'size:', data.length);
      return data.buffer;
    } catch (err) {
      console.error('[WebAudioWaveform] Tauri fs.readBinaryFile failed:', err);
      return null;
    }
  };

  const localPath = resolveLocalPath(videoUrl);

  const fetchViaStreamingServer = async (path: string): Promise<ArrayBuffer | null> => {
    const port = await invoke<number>('get_video_server_port');
    const encodedPath = btoa(unescape(encodeURIComponent(path)));
    const streamingUrl = `http://localhost:${port}/video/${encodedPath}`;

    // Download the full file in ranged chunks to avoid server caps (50MB limit per response)
    const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB chunks
    let offset = 0;
    let totalSize: number | null = null;
    const parts: Uint8Array[] = [];

    while (true) {
      if (totalSize !== null && offset >= totalSize) break;
      const end = totalSize !== null ? Math.min(totalSize - 1, offset + CHUNK_SIZE - 1) : offset + CHUNK_SIZE - 1;
      const resp = await fetch(streamingUrl, { headers: { Range: `bytes=${offset}-${end}` } });

      if (resp.status === 416) {
        // Range not satisfiable; assume we've reached the end
        break;
      }
      if (!resp.ok) {
        console.error('[WebAudioWaveform] Streaming server chunk fetch failed:', resp.status, streamingUrl, `range=${offset}-${end}`);
        return null;
      }

      const contentRange = resp.headers.get('content-range');
      if (contentRange && contentRange.startsWith('bytes')) {
        const partsRange = contentRange.replace('bytes', '').trim().split('/');
        if (partsRange.length === 2) {
          const totalStr = partsRange[1];
          const parsedTotal = parseInt(totalStr, 10);
          if (!Number.isNaN(parsedTotal)) {
            totalSize = parsedTotal;
          }
        }
      }

      const buf = new Uint8Array(await resp.arrayBuffer());
      parts.push(buf);
      offset += buf.byteLength;

      if (buf.byteLength < CHUNK_SIZE) break;
    }

    const finalSize = totalSize ?? parts.reduce((sum, p) => sum + p.byteLength, 0);
    const combined = new Uint8Array(finalSize);
    let writeOffset = 0;
    for (const p of parts) {
      combined.set(p, writeOffset);
      writeOffset += p.byteLength;
    }
    console.log('[WebAudioWaveform] Loaded via streaming server (chunked):', streamingUrl, 'size:', combined.byteLength, 'chunks:', parts.length);
    return combined.buffer;
  };

  if (localPath) {
    // 1) Try Tauri fs (only in shell)
    const localBuffer = await tryReadLocal(localPath);
    if (localBuffer) {
      arrayBuffer = localBuffer;
    } else {
      // 2) Try streaming server
      const streamBuffer = await fetchViaStreamingServer(localPath);
      if (streamBuffer) {
        arrayBuffer = streamBuffer;
      } else {
        // 3) Try convertFileSrc + fetch (asset.localhost)
        const url = convertFileSrc(localPath);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
        }
        arrayBuffer = await response.arrayBuffer();
      }
    }
  } else {
    // Non-local URL (http/https/blob)
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
    }
    arrayBuffer = await response.arrayBuffer();
  }
  
  console.log('[WebAudioWaveform] Obtained file buffer, size:', arrayBuffer.byteLength);
  
  // Create audio context and decode
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  try {
    console.log('[WebAudioWaveform] Decoding audio buffer...');
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    console.log('[WebAudioWaveform] Decoded audio:', {
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
      numberOfChannels: audioBuffer.numberOfChannels,
      length: audioBuffer.length,
    });
    
    // Get the audio data (use first channel, or mix down if stereo)
    let channelData: Float32Array;
    if (audioBuffer.numberOfChannels === 1) {
      channelData = audioBuffer.getChannelData(0);
    } else {
      // Mix stereo to mono
      const left = audioBuffer.getChannelData(0);
      const right = audioBuffer.getChannelData(1);
      // We clone the data to ensure we own it and it's not tied to the audio buffer if that gets GC'd
      channelData = new Float32Array(left.length);
      for (let i = 0; i < left.length; i++) {
        channelData[i] = (left[i] + right[i]) / 2;
      }
    }
    
    return {
      channelData,
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate,
    };
  } finally {
    await audioContext.close();
  }
}

/**
 * Extract waveform from a video element by capturing its audio
 * This is an alternative approach that works with already-loaded videos
 */
export async function extractWaveformFromVideoElement(
  videoElement: HTMLVideoElement
): Promise<WebAudioWaveformData> {
  // Get the video source URL
  const videoUrl = videoElement.src || videoElement.currentSrc;
  if (!videoUrl) {
    throw new Error('Video element has no source');
  }
  
  return extractWaveformFromUrl(videoUrl);
}

