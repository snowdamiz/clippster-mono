/**
 * Waveform Service - Single source of truth for audio waveform data
 * 
 * Uses Web Audio API for extraction (browser's native decoder = guaranteed sync with video)
 * Stores raw Float32Array channel data and computes peaks on-demand for maximum accuracy
 * One peak per pixel = highest possible fidelity
 */

import { invoke, convertFileSrc } from '@tauri-apps/api/core';

// ============================================================================
// Types
// ============================================================================

export interface WaveformPeak {
  min: number;
  max: number;
}

export interface AudioData {
  channelData: Float32Array;
  sampleRate: number;
  duration: number;
}

export interface WaveformRenderOptions {
  startTime: number;
  endTime: number;
  pixelWidth: number;
  gainMultiplier?: number;
}

// ============================================================================
// IndexedDB Cache
// ============================================================================

const DB_NAME = 'waveform-cache';
const DB_VERSION = 1;
const STORE_NAME = 'audio-data';

interface CachedAudioData {
  path: string;
  channelData: ArrayBuffer; // Store as ArrayBuffer for IndexedDB
  sampleRate: number;
  duration: number;
  fileSize: number;
  cachedAt: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[WaveformService] Failed to open IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'path' });
        store.createIndex('cachedAt', 'cachedAt', { unique: false });
      }
    };
  });

  return dbPromise;
}

async function getCachedAudio(path: string): Promise<AudioData | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(path);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cached = request.result as CachedAudioData | undefined;
        if (cached) {
          // Convert ArrayBuffer back to Float32Array
          const channelData = new Float32Array(cached.channelData);
          resolve({
            channelData,
            sampleRate: cached.sampleRate,
            duration: cached.duration,
          });
        } else {
          resolve(null);
        }
      };
    });
  } catch (error) {
    console.error('[WaveformService] Cache read error:', error);
    return null;
  }
}

async function setCachedAudio(path: string, data: AudioData, fileSize: number): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      // Create a new ArrayBuffer and copy data to ensure we own it
      const buffer = new ArrayBuffer(data.channelData.byteLength);
      new Float32Array(buffer).set(data.channelData);

      const cached: CachedAudioData = {
        path,
        channelData: buffer,
        sampleRate: data.sampleRate,
        duration: data.duration,
        fileSize,
        cachedAt: Date.now(),
      };

      const request = store.put(cached);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('[WaveformService] Cache write error:', error);
  }
}

async function deleteCachedAudio(path: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(path);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('[WaveformService] Cache delete error:', error);
  }
}

async function clearAllCache(): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('[WaveformService] Cache clear error:', error);
  }
}

// ============================================================================
// Audio Extraction (Web Audio API)
// ============================================================================

/**
 * Resolve various URL formats to a local file path
 */
function resolveLocalPath(url: string): string | null {
  if (url.startsWith('file://')) {
    return decodeURIComponent(url.replace('file://', ''));
  }
  // Match Windows paths with either forward or backward slashes (e.g., C:\ or c:/)
  if (/^[a-zA-Z]:[/\\]/.test(url) || url.startsWith('/')) {
    return url;
  }
  
  // Check for streaming server URL: http://localhost:PORT/video/BASE64
  const streamingMatch = url.match(/^http:\/\/localhost:\d+\/video\/([A-Za-z0-9+/=]+)$/);
  if (streamingMatch) {
    try {
      const decoded = decodeURIComponent(escape(atob(streamingMatch[1])));
      return decoded;
    } catch {
      // Invalid base64, continue to other checks
    }
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
}

/**
 * Fetch file via Tauri's streaming server with chunked downloads
 */
async function fetchViaStreamingServer(path: string): Promise<ArrayBuffer | null> {
  try {
    const port = await invoke<number>('get_video_server_port');
    const encodedPath = btoa(unescape(encodeURIComponent(path)));
    const streamingUrl = `http://localhost:${port}/video/${encodedPath}`;

    const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB chunks
    let offset = 0;
    let totalSize: number | null = null;
    const parts: Uint8Array[] = [];

    while (true) {
      if (totalSize !== null && offset >= totalSize) break;
      const end = totalSize !== null 
        ? Math.min(totalSize - 1, offset + CHUNK_SIZE - 1) 
        : offset + CHUNK_SIZE - 1;
      
      const resp = await fetch(streamingUrl, { headers: { Range: `bytes=${offset}-${end}` } });

      if (resp.status === 416) break; // Range not satisfiable
      if (!resp.ok) return null;

      const contentRange = resp.headers.get('content-range');
      if (contentRange && contentRange.startsWith('bytes')) {
        const partsRange = contentRange.replace('bytes', '').trim().split('/');
        if (partsRange.length === 2) {
          const parsedTotal = parseInt(partsRange[1], 10);
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
    
    return combined.buffer;
  } catch (error) {
    console.error('[WaveformService] Streaming server fetch failed:', error);
    return null;
  }
}

/**
 * Extract raw audio data from a video/audio file using Web Audio API
 */
async function extractAudioFromFile(filePath: string): Promise<{ data: AudioData; fileSize: number }> {
  let arrayBuffer: ArrayBuffer;
  let fileSize = 0;

  const localPath = resolveLocalPath(filePath);

  if (localPath) {
    // Try streaming server first (most reliable for Tauri)
    const streamBuffer = await fetchViaStreamingServer(localPath);
    if (streamBuffer) {
      arrayBuffer = streamBuffer;
      fileSize = streamBuffer.byteLength;
    } else {
      // Fallback to convertFileSrc
      const url = convertFileSrc(localPath);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
      }
      arrayBuffer = await response.arrayBuffer();
      fileSize = arrayBuffer.byteLength;
    }
  } else {
    // Non-local URL (http/https/blob)
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
    }
    arrayBuffer = await response.arrayBuffer();
    fileSize = arrayBuffer.byteLength;
  }

  // Decode audio using Web Audio API
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Get channel data (mono or mixed stereo)
    let channelData: Float32Array;
    if (audioBuffer.numberOfChannels === 1) {
      // Clone to ensure we own the data
      channelData = new Float32Array(audioBuffer.getChannelData(0));
    } else {
      // Mix stereo to mono
      const left = audioBuffer.getChannelData(0);
      const right = audioBuffer.getChannelData(1);
      channelData = new Float32Array(left.length);
      for (let i = 0; i < left.length; i++) {
        channelData[i] = (left[i] + right[i]) / 2;
      }
    }

    return {
      data: {
        channelData,
        sampleRate: audioBuffer.sampleRate,
        duration: audioBuffer.duration,
      },
      fileSize,
    };
  } finally {
    await audioContext.close();
  }
}

// ============================================================================
// Peak Calculation
// ============================================================================

/**
 * Calculate peaks for a time range at specified pixel width
 * This is the core algorithm - one peak per pixel for maximum accuracy
 */
export function calculatePeaks(
  channelData: Float32Array,
  sampleRate: number,
  startTime: number,
  endTime: number,
  pixelWidth: number,
  gainMultiplier: number = 1.0
): WaveformPeak[] {
  if (!channelData || channelData.length === 0 || pixelWidth <= 0) {
    return [];
  }

  // Clamp time range to valid bounds
  const duration = channelData.length / sampleRate;
  const clampedStart = Math.max(0, Math.min(startTime, duration));
  const clampedEnd = Math.max(clampedStart, Math.min(endTime, duration));

  if (clampedEnd <= clampedStart) {
    return [];
  }

  const startSample = Math.floor(clampedStart * sampleRate);
  const endSample = Math.ceil(clampedEnd * sampleRate);
  const sampleRange = endSample - startSample;

  // One peak per pixel for maximum fidelity
  const numPeaks = Math.min(pixelWidth, sampleRange);
  const samplesPerPeak = sampleRange / numPeaks;

  const peaks: WaveformPeak[] = new Array(numPeaks);

  for (let i = 0; i < numPeaks; i++) {
    const windowStart = startSample + Math.floor(i * samplesPerPeak);
    const windowEnd = startSample + Math.floor((i + 1) * samplesPerPeak);

    let min = 0;
    let max = 0;

    for (let j = windowStart; j < windowEnd && j < channelData.length; j++) {
      const sample = channelData[j];
      if (sample < min) min = sample;
      if (sample > max) max = sample;
    }

    // Apply gain and clamp to prevent overdrive
    peaks[i] = {
      min: Math.max(-1, min * gainMultiplier),
      max: Math.min(1, max * gainMultiplier),
    };
  }

  return peaks;
}

// ============================================================================
// Waveform Service Class
// ============================================================================

class WaveformServiceImpl {
  private audioCache = new Map<string, AudioData>();
  private loadingPromises = new Map<string, Promise<AudioData>>();

  /**
   * Load audio data for a video/audio file
   * Uses IndexedDB cache for persistence
   */
  async loadAudio(filePath: string, forceReload: boolean = false): Promise<AudioData> {
    // Normalize path for caching
    const normalizedPath = this.normalizePath(filePath);

    // Check in-memory cache first
    if (!forceReload && this.audioCache.has(normalizedPath)) {
      return this.audioCache.get(normalizedPath)!;
    }

    // Check if already loading
    if (this.loadingPromises.has(normalizedPath)) {
      return this.loadingPromises.get(normalizedPath)!;
    }

    // Start loading
    const loadPromise = this.doLoadAudio(normalizedPath, forceReload);
    this.loadingPromises.set(normalizedPath, loadPromise);

    try {
      const data = await loadPromise;
      this.audioCache.set(normalizedPath, data);
      return data;
    } finally {
      this.loadingPromises.delete(normalizedPath);
    }
  }

  private async doLoadAudio(normalizedPath: string, forceReload: boolean): Promise<AudioData> {
    // Check IndexedDB cache (unless force reload)
    if (!forceReload) {
      const cached = await getCachedAudio(normalizedPath);
      if (cached) {
        console.log('[WaveformService] Loaded from cache:', normalizedPath);
        return cached;
      }
    }

    // Extract fresh audio data
    console.log('[WaveformService] Extracting audio:', normalizedPath);
    const { data, fileSize } = await extractAudioFromFile(normalizedPath);

    // Cache to IndexedDB
    await setCachedAudio(normalizedPath, data, fileSize);
    console.log('[WaveformService] Cached audio data:', {
      path: normalizedPath,
      duration: data.duration.toFixed(2) + 's',
      sampleRate: data.sampleRate,
      samples: data.channelData.length,
    });

    return data;
  }

  /**
   * Get peaks for a time range at specified pixel width
   * This is the main method for rendering - call this per render frame
   */
  getPeaksForRange(
    filePath: string,
    options: WaveformRenderOptions
  ): WaveformPeak[] {
    const normalizedPath = this.normalizePath(filePath);
    const data = this.audioCache.get(normalizedPath);

    if (!data) {
      return [];
    }

    return calculatePeaks(
      data.channelData,
      data.sampleRate,
      options.startTime,
      options.endTime,
      options.pixelWidth,
      options.gainMultiplier ?? 1.0
    );
  }

  /**
   * Get peaks synchronously if data is already loaded
   * Returns null if data not loaded yet
   */
  getPeaksSync(
    filePath: string,
    options: WaveformRenderOptions
  ): WaveformPeak[] | null {
    const normalizedPath = this.normalizePath(filePath);
    const data = this.audioCache.get(normalizedPath);

    if (!data) {
      return null;
    }

    return calculatePeaks(
      data.channelData,
      data.sampleRate,
      options.startTime,
      options.endTime,
      options.pixelWidth,
      options.gainMultiplier ?? 1.0
    );
  }

  /**
   * Get the raw audio data if loaded
   */
  getAudioData(filePath: string): AudioData | null {
    const normalizedPath = this.normalizePath(filePath);
    return this.audioCache.get(normalizedPath) ?? null;
  }

  /**
   * Check if audio data is loaded for a file
   */
  isLoaded(filePath: string): boolean {
    const normalizedPath = this.normalizePath(filePath);
    return this.audioCache.has(normalizedPath);
  }

  /**
   * Check if audio data is currently loading
   */
  isLoading(filePath: string): boolean {
    const normalizedPath = this.normalizePath(filePath);
    return this.loadingPromises.has(normalizedPath);
  }

  /**
   * Clear cache for a specific file
   */
  async clearCache(filePath: string): Promise<void> {
    const normalizedPath = this.normalizePath(filePath);
    this.audioCache.delete(normalizedPath);
    await deleteCachedAudio(normalizedPath);
    console.log('[WaveformService] Cleared cache for:', normalizedPath);
  }

  /**
   * Clear all cached data
   */
  async clearAllCache(): Promise<void> {
    this.audioCache.clear();
    await clearAllCache();
    console.log('[WaveformService] Cleared all cache');
  }

  /**
   * Normalize file path for consistent cache keys
   */
  private normalizePath(filePath: string): string {
    // Extract local path from URL if needed
    const localPath = resolveLocalPath(filePath);
    if (localPath) {
      // Normalize Windows paths (lowercase for case-insensitivity)
      return localPath.replace(/\\/g, '/').toLowerCase();
    }
    // For URLs we can't resolve to local paths, keep as-is
    // Do NOT lowercase URLs as they may contain case-sensitive parts (base64, etc.)
    return filePath;
  }
}

// Singleton instance
export const waveformService = new WaveformServiceImpl();

// ============================================================================
// Vue Composable Wrapper
// ============================================================================

import { ref, computed, onUnmounted } from 'vue';

export interface UseWaveformOptions {
  autoLoad?: boolean;
}

export function useWaveform(initialPath?: string, options: UseWaveformOptions = {}) {
  const filePath = ref<string | null>(initialPath ?? null);
  const isLoading = ref(false);
  const isLoaded = ref(false);
  const error = ref<string | null>(null);
  const audioData = ref<AudioData | null>(null);

  const duration = computed(() => audioData.value?.duration ?? 0);
  const sampleRate = computed(() => audioData.value?.sampleRate ?? 0);

  async function load(path?: string, forceReload: boolean = false): Promise<void> {
    const targetPath = path ?? filePath.value;
    if (!targetPath) {
      error.value = 'No file path specified';
      return;
    }

    filePath.value = targetPath;
    isLoading.value = true;
    error.value = null;

    try {
      const data = await waveformService.loadAudio(targetPath, forceReload);
      audioData.value = data;
      isLoaded.value = true;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load audio';
      isLoaded.value = false;
      console.error('[useWaveform] Load error:', e);
    } finally {
      isLoading.value = false;
    }
  }

  function getPeaks(options: WaveformRenderOptions): WaveformPeak[] {
    if (!filePath.value || !audioData.value) {
      return [];
    }
    return waveformService.getPeaksForRange(filePath.value, options);
  }

  async function clearCache(): Promise<void> {
    if (filePath.value) {
      await waveformService.clearCache(filePath.value);
      audioData.value = null;
      isLoaded.value = false;
    }
  }

  function reset(): void {
    filePath.value = null;
    audioData.value = null;
    isLoading.value = false;
    isLoaded.value = false;
    error.value = null;
  }

  // Auto-load if path provided and autoLoad enabled
  if (initialPath && options.autoLoad !== false) {
    load(initialPath);
  }

  return {
    // State
    filePath: computed(() => filePath.value),
    isLoading: computed(() => isLoading.value),
    isLoaded: computed(() => isLoaded.value),
    error: computed(() => error.value),
    duration,
    sampleRate,
    audioData: computed(() => audioData.value),

    // Methods
    load,
    getPeaks,
    clearCache,
    reset,
  };
}
