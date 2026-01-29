import { ref, computed, watch, onUnmounted, type Ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type { VideoSource } from '../usePlaybackEngine';

interface FrameData {
  width: number;
  height: number;
  rgb_data: number[];
  timestamp: number;
}

interface CachedFrame {
  imageData: ImageData;
  timestamp: number;
}

interface CanvasPlaybackEngineOptions {
  canvasRef: Ref<HTMLCanvasElement | null>;
  currentTime: Ref<number>;
  isPlaying: Ref<boolean>;
  videoSources: Ref<VideoSource[]>;
  onError?: (error: string) => void;
}

export function useCanvasPlaybackEngine(options: CanvasPlaybackEngineOptions) {
  const { canvasRef, currentTime, isPlaying, videoSources, onError } = options;

  const frameCache = new Map<string, CachedFrame>();
  const maxCacheSize = 120; // 4 seconds at 30fps - reduce FFmpeg file access
  const prefetchAheadSeconds = 5.0; // Aggressive prefetching to stay ahead
  let fetchInFlight = false;
  
  let rafId: number | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let lastRenderTime = 0;
  let lastSuccessfulFrame: CachedFrame | null = null; // Hold last good frame

  const isInitialized = ref(false);
  const currentFrameTimestamp = ref(0);
  const cacheSize = ref(0);
  const renderFps = ref(0);
  let fpsFrameCount = 0;
  let fpsLastTime = performance.now();

  function getCacheKey(sourceId: string, timestamp: number): string {
    const timestampMs = Math.round(timestamp * 1000);
    return `${sourceId}:${timestampMs}`;
  }

  function findSourceAtTime(time: number): VideoSource | null {
    for (const source of videoSources.value) {
      if (time >= source.start_time && time < source.end_time) {
        return source;
      }
    }
    return null;
  }

  function getSourceTime(timelineTime: number, source: VideoSource): number {
    const offsetInSource = timelineTime - source.start_time;
    return source.trim_start + offsetInSource;
  }

  function rgbToRgba(rgbData: number[], width: number, height: number): Uint8ClampedArray {
    const pixelCount = width * height;
    const rgbaData = new Uint8ClampedArray(pixelCount * 4);
    
    let rgbIndex = 0;
    let rgbaIndex = 0;
    
    for (let i = 0; i < pixelCount; i++) {
      rgbaData[rgbaIndex++] = rgbData[rgbIndex++];
      rgbaData[rgbaIndex++] = rgbData[rgbIndex++];
      rgbaData[rgbaIndex++] = rgbData[rgbIndex++];
      rgbaData[rgbaIndex++] = 255;
    }
    
    return rgbaData;
  }

  async function fetchFrame(sourceId: string, videoPath: string, timestamp: number): Promise<CachedFrame | null> {
    const cacheKey = getCacheKey(sourceId, timestamp);
    
    const cached = frameCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const frameData = await Promise.race([
        invoke<FrameData>('get_video_frame_with_dimensions', {
          sourceId,
          videoPath,
          timestamp,
        }),
        new Promise<FrameData>((_, reject) => {
          setTimeout(() => reject(new Error('Frame fetch timeout')), 5000);
        }),
      ]);

      console.log('[CanvasPlaybackEngine] Frame data received:', {
        sourceId,
        timestamp,
        width: frameData.width,
        height: frameData.height,
        rgbLength: frameData.rgb_data.length,
        frameTimestamp: frameData.timestamp,
      });

      const rgbaData = rgbToRgba(frameData.rgb_data, frameData.width, frameData.height);
      const imageData = new ImageData(new Uint8ClampedArray(rgbaData), frameData.width, frameData.height);

      const cachedFrame: CachedFrame = {
        imageData,
        timestamp: frameData.timestamp,
      };

      frameCache.set(cacheKey, cachedFrame);
      cacheSize.value = frameCache.size;

      if (frameCache.size > maxCacheSize) {
        const firstKey = frameCache.keys().next().value;
        if (firstKey) {
          frameCache.delete(firstKey);
          cacheSize.value = frameCache.size;
        }
      }

      return cachedFrame;
    } catch (error) {
      const message = String(error);
      console.error(`[CanvasPlaybackEngine] Failed to fetch frame at ${timestamp}:`, error);
      if (!message.includes('Frame fetch timeout')) {
        onError?.(message);
      }
      return null;
    }
  }

  async function prefetchFrames(sourceId: string, videoPath: string, startTime: number, fps: number) {
    const frameCount = Math.ceil(prefetchAheadSeconds * fps);
    
    try {
      await invoke('prefetch_video_frames', {
        sourceId,
        videoPath,
        startTime,
        count: frameCount,
        fps,
      });
    } catch (error) {
      console.error('[CanvasPlaybackEngine] Prefetch failed:', error);
    }
  }

  async function renderFrame(timestamp: number) {
    if (!ctx || !canvasRef.value) {
      console.log('[CanvasPlaybackEngine] renderFrame called but no context:', { ctx: !!ctx, canvas: !!canvasRef.value });
      return;
    }

    const source = findSourceAtTime(timestamp);
    
    if (!source) {
      // No source at this time - render black (gap in timeline)
      console.log('[CanvasPlaybackEngine] No source at time:', timestamp);
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvasRef.value.width, canvasRef.value.height);
      return;
    }

    const sourceTime = getSourceTime(timestamp, source);
    console.log('[CanvasPlaybackEngine] Rendering frame:', { timestamp, sourceId: source.id, sourceTime, filePath: source.file_path });

    if (fetchInFlight) {
      if (lastSuccessfulFrame && ctx && canvasRef.value) {
        if (canvasRef.value.width !== lastSuccessfulFrame.imageData.width || 
            canvasRef.value.height !== lastSuccessfulFrame.imageData.height) {
          canvasRef.value.width = lastSuccessfulFrame.imageData.width;
          canvasRef.value.height = lastSuccessfulFrame.imageData.height;
        }
        ctx.putImageData(lastSuccessfulFrame.imageData, 0, 0);
      }
      return;
    }

    fetchInFlight = true;
    let frame: CachedFrame | null = null;
    try {
      frame = await fetchFrame(source.id, source.file_path, sourceTime);
    } finally {
      fetchInFlight = false;
    }

    if (frame && ctx) {
      // Successfully decoded frame
      if (canvasRef.value.width !== frame.imageData.width || 
          canvasRef.value.height !== frame.imageData.height) {
        canvasRef.value.width = frame.imageData.width;
        canvasRef.value.height = frame.imageData.height;
      }

      ctx.putImageData(frame.imageData, 0, 0);
      currentFrameTimestamp.value = frame.timestamp;
      lastSuccessfulFrame = frame; // Store for frame holding

      // Temporarily pause prefetching to avoid decoder contention/timeouts
    } else if (!frame && lastSuccessfulFrame && ctx && canvasRef.value) {
      // Frame decode failed - hold/repeat last successful frame (professional behavior)
      // This prevents black flashes and maintains visual continuity
      if (canvasRef.value.width !== lastSuccessfulFrame.imageData.width || 
          canvasRef.value.height !== lastSuccessfulFrame.imageData.height) {
        canvasRef.value.width = lastSuccessfulFrame.imageData.width;
        canvasRef.value.height = lastSuccessfulFrame.imageData.height;
      }
      ctx.putImageData(lastSuccessfulFrame.imageData, 0, 0);
    } else if (!frame) {
      console.warn('[CanvasPlaybackEngine] No frame available to render', {
        timestamp,
        sourceId: source.id,
        sourceTime,
        hasLastFrame: !!lastSuccessfulFrame,
      });
    }
  }

  function tick(timestamp: number) {
    if (!isPlaying.value) {
      rafId = null;
      return;
    }

    const deltaMs = timestamp - lastRenderTime;
    
    if (deltaMs >= 16) {
      renderFrame(currentTime.value);
      lastRenderTime = timestamp;

      fpsFrameCount++;
      if (timestamp - fpsLastTime >= 1000) {
        renderFps.value = Math.round(fpsFrameCount * 1000 / (timestamp - fpsLastTime));
        fpsFrameCount = 0;
        fpsLastTime = timestamp;
      }
    }

    rafId = requestAnimationFrame(tick);
  }

  function startRendering() {
    if (rafId !== null) {
      console.log('[CanvasPlaybackEngine] startRendering called but already running');
      return;
    }
    
    console.log('[CanvasPlaybackEngine] Starting RAF loop');
    lastRenderTime = performance.now();
    rafId = requestAnimationFrame(tick);
  }

  function stopRendering() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function initialize() {
    if (!canvasRef.value) {
      console.warn('[CanvasPlaybackEngine] Canvas ref not available');
      return false;
    }

    ctx = canvasRef.value.getContext('2d', {
      alpha: false,
      desynchronized: true,
    });

    if (!ctx) {
      console.error('[CanvasPlaybackEngine] Failed to get 2D context');
      return false;
    }

    isInitialized.value = true;
    console.log('[CanvasPlaybackEngine] Initialized');
    return true;
  }

  function clearCache() {
    frameCache.clear();
    cacheSize.value = 0;
    
    invoke('clear_frame_cache').catch(err => {
      console.error('[CanvasPlaybackEngine] Failed to clear Rust cache:', err);
    });
  }

  watch(isPlaying, (playing) => {
    console.log('[CanvasPlaybackEngine] isPlaying changed:', playing, 'initialized:', isInitialized.value);
    if (playing) {
      if (!isInitialized.value) {
        console.log('[CanvasPlaybackEngine] Initializing before starting rendering');
        initialize();
      }
      startRendering();
    } else {
      stopRendering();
    }
  });

  watch(currentTime, async (time) => {
    if (!isPlaying.value && isInitialized.value) {
      await renderFrame(time);
    }
  });

  watch(canvasRef, (canvas) => {
    if (canvas && !isInitialized.value) {
      initialize();
      if (currentTime.value > 0) {
        renderFrame(currentTime.value);
      }
    }
  });

  onUnmounted(() => {
    stopRendering();
    clearCache();
  });

  return {
    isInitialized,
    currentFrameTimestamp,
    cacheSize,
    renderFps,
    initialize,
    clearCache,
    renderFrame,
  };
}
