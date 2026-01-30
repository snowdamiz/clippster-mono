import { ref, watch, onUnmounted, type Ref } from 'vue';
import * as MP4Box from 'mp4box';
import type { VideoSource } from '../usePlaybackEngine';

interface WebCodecsPlaybackOptions {
  canvasRef: Ref<HTMLCanvasElement | null>;
  currentTime: Ref<number>;
  isPlaying: Ref<boolean>;
  videoSources: Ref<VideoSource[]>;
  getEffectivePathWithOffset?: (sourceId: string, originalPath: string, trimStart?: number) => { path: string; trimOffset: number };
  onError?: (error: string) => void;
}

interface DecoderState {
  decoder: VideoDecoder;
  mp4boxFile: any;
  videoTrack: any;
  sourceId: string;
  videoPath: string;
  isInitialized: boolean;
}

interface CachedFrame {
  frame: VideoFrame;
  timestamp: number;
  sourceId: string;
}

export function useWebCodecsPlayback(options: WebCodecsPlaybackOptions) {
  console.log('[WebCodecsPlayback] ========================================');
  console.log('[WebCodecsPlayback] COMPOSABLE CALLED - MODULE LOADED');
  console.log('[WebCodecsPlayback] ========================================');
  
  const { canvasRef, currentTime, isPlaying, videoSources, getEffectivePathWithOffset, onError } = options;

  // Frame cache - keep decoded frames in memory for instant playback
  const frameCache = new Map<string, CachedFrame>();
  const maxCacheSize = 150; // ~5 seconds at 30fps
  
  // Decoder management
  const decoders = new Map<string, DecoderState>();
  const initializingDecoders = new Map<string, Promise<DecoderState | null>>();
  let currentSourceId: string | null = null;
  
  // Rendering state
  let rafId: number | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let lastRenderedFrame: VideoFrame | null = null;
  
  // Performance metrics
  const isInitialized = ref(false);
  const renderFps = ref(0);
  const cacheSize = ref(0);
  let fpsFrameCount = 0;
  let fpsLastTime = performance.now();

  // Helper to resolve video path with proxy support
  const resolveVideoPath = (source: VideoSource): { path: string; trimOffset: number } => {
    if (getEffectivePathWithOffset) {
      return getEffectivePathWithOffset(source.id, source.file_path, source.trim_start);
    }
    return { path: source.file_path, trimOffset: 0 };
  };

  // Find which source is active at given timeline time
  function findSourceAtTime(time: number): VideoSource | null {
    for (const source of videoSources.value) {
      if (time >= source.start_time && time < source.end_time) {
        return source;
      }
    }
    return null;
  }

  // Convert timeline time to source-relative time
  function getSourceTime(timelineTime: number, source: VideoSource): number {
    const offsetInSource = timelineTime - source.start_time;
    return source.trim_start + offsetInSource;
  }

  // Generate cache key for a frame
  function getCacheKey(sourceId: string, timestamp: number): string {
    return `${sourceId}:${Math.round(timestamp * 1000)}`;
  }

  // Check if WebCodecs is supported
  function checkWebCodecsSupport(): boolean {
    if (typeof VideoDecoder === 'undefined') {
      onError?.('WebCodecs API not supported in this browser');
      return false;
    }
    return true;
  }

  // Initialize decoder for a video source
  async function initializeDecoder(source: VideoSource): Promise<DecoderState | null> {
    const { path: videoPath, trimOffset } = resolveVideoPath(source);
    const cacheKey = `${source.id}:${videoPath}`;

    // Return existing decoder if already initialized
    if (decoders.has(cacheKey)) {
      const existing = decoders.get(cacheKey)!;
      if (existing.isInitialized) {
        return existing;
      }
    }

    const inFlight = initializingDecoders.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    console.log(`[WebCodecsPlayback] Initializing decoder for source ${source.id}`);

    try {
      // In dev: use local video server (port 48276) which handles range requests
      // In production: the video server is bundled and runs on the same port
      // The server is started in lib.rs setup() and runs for the lifetime of the app
      const encodedPath = btoa(videoPath);
      const videoUrl = `http://localhost:48276/video/${encodedPath}`;
      console.log(`[WebCodecsPlayback] Fetching from video server: ${videoUrl}`);
      
      // Create MP4Box file for demuxing
      const mp4boxFile = MP4Box.createFile();
      
      // Use ranged streaming: fetch a small init chunk to trigger onReady,
      // then start extraction and stream remaining ranges so samples are emitted.
      const INITIAL_CHUNK_SIZE = 2 * 1024 * 1024; // 2MB
      const RANGE_CHUNK_SIZE = 50 * 1024 * 1024; // 50MB (server cap)

      const fetchRange = async (start: number, end: number) => {
        const response = await fetch(videoUrl, {
          headers: {
            Range: `bytes=${start}-${end}`,
          },
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch range ${start}-${end}: ${response.status} ${response.statusText}`);
        }

        const contentRange = response.headers.get('content-range');
        let totalSize: number | null = null;
        if (contentRange) {
          const match = /\/(\d+)$/.exec(contentRange);
          if (match?.[1]) {
            totalSize = Number(match[1]);
          }
        }

        const data = await response.arrayBuffer();
        return { data, totalSize, contentRange };
      };

      // Set up MP4Box handlers and process
      const initPromise = new Promise<DecoderState | null>((resolve, reject) => {
        let videoTrack: any = null;
        let decoder: VideoDecoder | null = null;
        let isResolved = false;
        let totalSize: number | null = null;
        let nextOffset = 0;
        let streamingStarted = false;
        let initialBuffer: ArrayBuffer | null = null;
        let hasKeyframe = false;

        const appendBuffer = (data: ArrayBuffer, offset: number) => {
          const buffer = data as ArrayBuffer & { fileStart: number };
          buffer.fileStart = offset;
          mp4boxFile.appendBuffer(buffer);
        };

        const streamRemainingRanges = async () => {
          if (streamingStarted || totalSize === null) {
            return;
          }
          streamingStarted = true;

          try {
            while (nextOffset < totalSize) {
              const end = Math.min(nextOffset + RANGE_CHUNK_SIZE - 1, totalSize - 1);
              const { data, contentRange } = await fetchRange(nextOffset, end);
              appendBuffer(data, nextOffset);
              nextOffset += data.byteLength;
              console.log('[WebCodecsPlayback] Range appended:', {
                contentRange,
                nextOffset,
              });
            }

            mp4boxFile.flush();
            console.log('[WebCodecsPlayback] Finished streaming ranges, MP4Box flushed');
          } catch (error) {
            console.error('[WebCodecsPlayback] Range streaming error:', {
              error,
              message: error instanceof Error ? error.message : String(error),
              nextOffset,
              totalSize,
            });
            throw error;
          }
        };

        mp4boxFile.onError = (e: any) => {
          console.error('[WebCodecsPlayback] MP4Box error:', e);
          if (!isResolved) {
            isResolved = true;
            reject(new Error(`MP4Box error: ${e}`));
          }
        };

        mp4boxFile.onReady = (info: any) => {
          console.log('[WebCodecsPlayback] MP4Box ready, tracks:', info.tracks.length);
          
          // Find video track
          videoTrack = info.tracks.find((t: any) => t.type === 'video');
          if (!videoTrack) {
            if (!isResolved) {
              isResolved = true;
              reject(new Error('No video track found'));
            }
            return;
          }

          console.log('[WebCodecsPlayback] Video track found:', videoTrack.codec || 'unknown');
          console.log('[WebCodecsPlayback] Track details:', {
            width: videoTrack.video?.width,
            height: videoTrack.video?.height,
            hasDescription: !!videoTrack.description,
          });

          // Create VideoDecoder
          decoder = new VideoDecoder({
            output: (frame: VideoFrame) => {
              console.log(`[WebCodecsPlayback] ✅ Frame decoded! timestamp=${(frame.timestamp / 1_000_000).toFixed(3)}s`);
              
              // Clone the frame for caching
              const clonedFrame = new VideoFrame(frame, {
                timestamp: frame.timestamp,
              });

              // Cache the frame
              const frameCacheKey = getCacheKey(source.id, frame.timestamp / 1_000_000);
              frameCache.set(frameCacheKey, {
                frame: clonedFrame,
                timestamp: frame.timestamp / 1_000_000,
                sourceId: source.id,
              });

              // Limit cache size
              if (frameCache.size > maxCacheSize) {
                const firstKey = frameCache.keys().next().value;
                if (firstKey) {
                  const oldFrame = frameCache.get(firstKey);
                  if (oldFrame) {
                    oldFrame.frame.close();
                    frameCache.delete(firstKey);
                  }
                }
              }

              // Close the original frame from decoder
              frame.close();
            },
            error: (e: Error) => {
              console.error('[WebCodecsPlayback] Decoder error:', e);
              onError?.(e.message);
            },
          });

          // Configure decoder with track info
          const config: VideoDecoderConfig = {
            codec: videoTrack.codec || 'avc1.64001f',
            codedWidth: videoTrack.video?.width || 1920,
            codedHeight: videoTrack.video?.height || 1080,
            hardwareAcceleration: 'prefer-hardware', // Use GPU decoding
          };

          // Add description (codec-specific data) if available
          if (videoTrack.description) {
            config.description = videoTrack.description;
          }

          console.log('[WebCodecsPlayback] Checking codec support:', config.codec);
          
          VideoDecoder.isConfigSupported(config).then(({ supported }) => {
            console.log('[WebCodecsPlayback] Codec supported:', supported);
            
            if (!supported) {
              if (!isResolved) {
                isResolved = true;
                reject(new Error(`Codec ${videoTrack.codec} not supported`));
              }
              return;
            }

            console.log('[WebCodecsPlayback] Configuring decoder...');
            decoder!.configure(config);
            console.log('[WebCodecsPlayback] Decoder configured successfully');

            // Set up sample processing - this enables extraction for future data
            console.log('[WebCodecsPlayback] Setting extraction options for track ID:', videoTrack.id);
            console.log('[WebCodecsPlayback] Track info:', JSON.stringify({
              id: videoTrack.id,
              nb_samples: videoTrack.nb_samples,
              duration: videoTrack.duration,
              timescale: videoTrack.timescale,
            }));
            mp4boxFile.setExtractionOptions(videoTrack.id, null, { nbSamples: 1000 });
            
            // Start extraction mode
            mp4boxFile.start();
            console.log('[WebCodecsPlayback] Extraction started');
            
            // Seek to beginning to force sample extraction
            // This is needed because onReady fires during appendBuffer,
            // so samples were already parsed before start() was called
            const seekResult = mp4boxFile.seek(0, true);
            console.log('[WebCodecsPlayback] Seek result:', seekResult);

            const seekOffset = typeof seekResult?.offset === 'number' ? seekResult.offset : 0;
            if (initialBuffer) {
              if (seekOffset < initialBuffer.byteLength) {
                const replayBuffer = initialBuffer.slice(seekOffset);
                appendBuffer(replayBuffer, seekOffset);
                nextOffset = initialBuffer.byteLength;
                console.log('[WebCodecsPlayback] Re-appended initial buffer after seek:', {
                  seekOffset,
                  replaySize: replayBuffer.byteLength,
                  nextOffset,
                });
              } else {
                nextOffset = seekOffset;
                console.log('[WebCodecsPlayback] Seek offset beyond initial buffer, updating nextOffset:', nextOffset);
              }
            }

            // Continue streaming remaining ranges now that extraction is started
            streamRemainingRanges().catch((e) => {
              console.error('[WebCodecsPlayback] Failed to stream ranges:', e);
              if (!isResolved) {
                isResolved = true;
                reject(e);
              }
            });

            const decoderState: DecoderState = {
              decoder: decoder!,
              mp4boxFile,
              videoTrack,
              sourceId: source.id,
              videoPath,
              isInitialized: true,
            };

            decoders.set(cacheKey, decoderState);
            
            if (!isResolved) {
              isResolved = true;
              resolve(decoderState);
            }
          }).catch((err) => {
            console.error('[WebCodecsPlayback] isConfigSupported failed:', err);
            if (!isResolved) {
              isResolved = true;
              reject(err);
            }
          });
        };

        mp4boxFile.onSamples = (trackId: number, _user: unknown, samples: any[]) => {
          console.log(`[WebCodecsPlayback] onSamples called! trackId=${trackId}, samples=${samples.length}`);
          
          // Decode samples into frames
          for (const sample of samples) {
            if (!hasKeyframe) {
              if (!sample.is_sync) {
                continue;
              }
              hasKeyframe = true;
            }
            const chunk = new EncodedVideoChunk({
              type: sample.is_sync ? 'key' : 'delta',
              timestamp: (sample.cts * 1_000_000) / sample.timescale,
              duration: (sample.duration * 1_000_000) / sample.timescale,
              data: sample.data,
            });

            if (decoder && decoder.state !== 'closed') {
              try {
                decoder.decode(chunk);
              } catch (error) {
                console.error('[WebCodecsPlayback] Decoder decode failed:', error);
                onError?.(error instanceof Error ? error.message : String(error));
              }
            }
          }
          
          // Release samples to free memory
          mp4boxFile.releaseUsedSamples(trackId, samples[samples.length - 1].number);
        };

        // Fetch initial chunk to trigger onReady (moov parsing)
        console.log('[WebCodecsPlayback] Fetching initial range...');
        fetchRange(0, INITIAL_CHUNK_SIZE - 1)
          .then(({ data, totalSize: responseTotalSize, contentRange }) => {
            if (responseTotalSize !== null) {
              totalSize = responseTotalSize;
            }

            console.log('[WebCodecsPlayback] Initial range loaded, size:', data.byteLength, 'contentRange:', contentRange);
            initialBuffer = data;
            appendBuffer(data, 0);
            nextOffset = data.byteLength;

            if (totalSize !== null && nextOffset >= totalSize) {
              mp4boxFile.flush();
            }
          })
          .catch((e) => {
            console.error('[WebCodecsPlayback] Failed to fetch initial range:', e);
            if (!isResolved) {
              isResolved = true;
              reject(e);
            }
          });
      });

      initializingDecoders.set(cacheKey, initPromise);
      initPromise.finally(() => initializingDecoders.delete(cacheKey));
      return initPromise;
    } catch (error) {
      console.error('[WebCodecsPlayback] Failed to initialize decoder:', error);
      onError?.(String(error));
      return null;
    }
  }

  // Prefetch frames ahead of playhead
  async function prefetchFrames(source: VideoSource, startTime: number) {
    const decoderState = await initializeDecoder(source);
    if (!decoderState) return;

    // Frames are automatically decoded and cached by the onSamples callback
    // The MP4Box demuxer handles the prefetching
  }

  // Render a frame to canvas
  function renderFrame(timestamp: number) {
    if (!ctx || !canvasRef.value) return;

    const source = findSourceAtTime(timestamp);
    
    // Handle source transitions
    if (source && currentSourceId !== source.id) {
      console.log(`[WebCodecsPlayback] Source transition: ${currentSourceId || 'none'} -> ${source.id}`);
      currentSourceId = source.id;
      
      // Clear last rendered frame on source change
      if (lastRenderedFrame) {
        lastRenderedFrame.close();
        lastRenderedFrame = null;
      }
      
      // Initialize decoder for new source
      initializeDecoder(source);
    }

    if (!source) {
      // No source at this time - render black
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvasRef.value.width, canvasRef.value.height);
      return;
    }

    const sourceTime = getSourceTime(timestamp, source);
    const { trimOffset } = resolveVideoPath(source);
    const adjustedTime = trimOffset > 0 ? sourceTime - trimOffset : sourceTime;
    
    // Look for cached frame
    const cacheKey = getCacheKey(source.id, adjustedTime);
    const cachedFrame = frameCache.get(cacheKey);

    if (cachedFrame) {
      // Render cached frame
      const frame = cachedFrame.frame;
      
      // Resize canvas if needed
      if (canvasRef.value.width !== frame.displayWidth || 
          canvasRef.value.height !== frame.displayHeight) {
        canvasRef.value.width = frame.displayWidth;
        canvasRef.value.height = frame.displayHeight;
      }

      // Draw frame to canvas
      ctx.drawImage(frame, 0, 0);
      
      // Update last rendered frame
      if (lastRenderedFrame && lastRenderedFrame !== frame) {
        lastRenderedFrame.close();
      }
      lastRenderedFrame = frame;
    } else {
      // Frame not in cache - hold last frame or show black
      if (lastRenderedFrame) {
        // Keep showing last frame while waiting for new one
        ctx.drawImage(lastRenderedFrame, 0, 0);
      } else {
        // No frame available - show black
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvasRef.value.width, canvasRef.value.height);
      }

      // Trigger prefetch for this source
      prefetchFrames(source, adjustedTime);
    }
  }

  // RAF rendering loop
  function tick(timestamp: number) {
    if (!isPlaying.value) {
      rafId = null;
      return;
    }

    renderFrame(currentTime.value);

    // Update FPS counter
    fpsFrameCount++;
    if (timestamp - fpsLastTime >= 1000) {
      renderFps.value = Math.round(fpsFrameCount * 1000 / (timestamp - fpsLastTime));
      fpsFrameCount = 0;
      fpsLastTime = timestamp;
    }

    rafId = requestAnimationFrame(tick);
  }

  // Start rendering loop
  function startRendering() {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(tick);
  }

  // Stop rendering loop
  function stopRendering() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  // Initialize canvas context
  function initialize(): boolean {
    if (!canvasRef.value) {
      console.warn('[WebCodecsPlayback] Cannot initialize: canvas ref is null');
      return false;
    }

    if (!checkWebCodecsSupport()) {
      return false;
    }

    ctx = canvasRef.value.getContext('2d', {
      alpha: false,
      desynchronized: true,
    });

    if (!ctx) {
      console.error('[WebCodecsPlayback] Failed to get 2D context');
      return false;
    }

    console.log('[WebCodecsPlayback] Initialized successfully with WebCodecs support');
    isInitialized.value = true;
    return true;
  }

  // Clear all caches and decoders
  function clearCache() {
    // Close all cached frames
    for (const cached of frameCache.values()) {
      cached.frame.close();
    }
    frameCache.clear();
    cacheSize.value = 0;

    // Close all decoders
    for (const decoderState of decoders.values()) {
      if (decoderState.decoder.state !== 'closed') {
        decoderState.decoder.close();
      }
    }
    decoders.clear();
    currentSourceId = null;

    if (lastRenderedFrame) {
      lastRenderedFrame.close();
      lastRenderedFrame = null;
    }
  }

  // Watch for play/pause changes
  watch(isPlaying, (playing) => {
    if (playing) {
      if (!isInitialized.value) {
        initialize();
      }
      startRendering();
    } else {
      stopRendering();
    }
  });

  // Watch for scrubbing (time changes while paused)
  watch(currentTime, (time) => {
    if (!isPlaying.value && isInitialized.value) {
      renderFrame(time);
    }
  });

  // Watch for canvas ref changes
  watch(canvasRef, (canvas) => {
    if (canvas && !isInitialized.value) {
      initialize();
      renderFrame(currentTime.value);
    }
  });

  // Watch for video sources changes - initialize decoder for current source
  watch(videoSources, (sources) => {
    if (!sources || sources.length === 0 || !isInitialized.value) return;
    
    const source = findSourceAtTime(currentTime.value);
    if (source && !decoders.has(source.id)) {
      console.log(`[WebCodecsPlayback] Video sources loaded, initializing decoder for source ${source.id}`);
      initializeDecoder(source);
      // Render initial frame
      renderFrame(currentTime.value);
    }
  }, { immediate: true });

  // Cleanup on unmount
  onUnmounted(() => {
    stopRendering();
    clearCache();
  });

  return {
    isInitialized,
    renderFps,
    cacheSize,
    initialize,
    clearCache,
    renderFrame,
  };
}
