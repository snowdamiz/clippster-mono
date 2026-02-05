import { ref, watch, onUnmounted, reactive, computed, type Ref } from 'vue';
import { WebDemuxer } from 'web-demuxer';
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
  isDecoding?: boolean;
  durationSec?: number;
  fullDecodeComplete?: boolean;
}

interface CachedFrame {
  bitmap: ImageBitmap;
  timestamp: number;
  sourceId: string;
}

export function useWebCodecsPlayback(options: WebCodecsPlaybackOptions) {
  console.log('[WebCodecsPlayback] ========================================');
  console.log('[WebCodecsPlayback] COMPOSABLE CALLED - MODULE LOADED');
  console.log('[WebCodecsPlayback] ========================================');
  
  const { canvasRef, currentTime, isPlaying, videoSources, getEffectivePathWithOffset, onError } = options;

  // Frame cache - keep decoded frames in memory for instant playback
  // Eviction is time-based: keep frames within [playhead - 0.5s, playhead + 2.0s]
  const frameCache = new Map<string, CachedFrame>();
  const MAX_BEHIND_S = 0.5;   // Keep frames 0.5s behind playhead
  const MAX_AHEAD_S = 2.0;    // Keep frames up to 2s ahead of playhead
  
  // Helper: evict frames that are too far from playhead
  function pruneCache(playheadTime: number, sourceId?: string) {
    // During prefill (not playing), don't prune ahead based on playhead=0
    // Otherwise we'd delete all future frames before playback starts
    if (!isPlaying.value) {
      // Optionally prune only extreme behind (probably none yet during prefill)
      return;
    }
    
    const minTime = playheadTime - MAX_BEHIND_S;
    const maxTime = playheadTime + MAX_AHEAD_S;
    const keysToDelete: string[] = [];
    
    for (const [key, frame] of frameCache.entries()) {
      // Only prune frames for the specified source (or all if not specified)
      if (sourceId && frame.sourceId !== sourceId) continue;
      
      // Evict if too far behind or too far ahead
      if (frame.timestamp < minTime || frame.timestamp > maxTime) {
        keysToDelete.push(key);
      }
    }
    
    if (keysToDelete.length > 0) {
      console.log(`[WebCodecsPlayback] 🗑️ pruneCache: Evicting ${keysToDelete.length} frames (playhead=${playheadTime.toFixed(3)}s, window=[${minTime.toFixed(3)}s→${maxTime.toFixed(3)}s], sourceId=${sourceId || 'all'})`);
    }
    
    for (const key of keysToDelete) {
      const frame = frameCache.get(key);
      if (frame) {
        // Clear lastRenderedFrame if it's this bitmap
        if (lastRenderedFrame === frame.bitmap) {
          lastRenderedFrame = null;
        }
        frame.bitmap.close();
        frameCache.delete(key);
      }
    }
  }

  // Decoder management
  const decoders = new Map<string, DecoderState>();
  const initializingDecoders = new Map<string, Promise<DecoderState | null>>();
  let currentSourceId: string | null = null;
  let cacheDebugCounter = 0;
  let outputFrameCount = 0;
  let rafDebugCounter = 0;
  
  // Chunk queue for controlled decoding (prevents backpressure deadlock)
  const pendingChunks: EncodedVideoChunk[] = [];
  const MAX_QUEUE = 6;
  let isPumping = false;
  let pumpDecoder: (() => void) | null = null;
  
  // Pending encoded samples buffer - store samples to decode on-demand as playhead moves
  type PendingSample = {
    timeSec: number;
    timestampUs: number;
    durationUs: number;
    isKey: boolean;
    data: Uint8Array;
  };
  const pendingSamples: PendingSample[] = [];
  const KEEP_AHEAD_SEC = 2.0;
  const KEEP_BEHIND_SEC = 0.5;
  
  // Base CTS per source for timestamp normalization (proxies may start at non-zero)
  const baseCtsBySource = new Map<string, number>(); // in track timescale units
  
  // Rendering state
  let rafId: number | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let lastRenderedFrame: ImageBitmap | null = null;
  let lastRenderTime = 0;
  let lastRenderSourceId: string | null = null;
  
  // Performance metrics
  const isInitialized = ref(false);
  
  // Source-specific loading states
  const loadingStates = reactive<Record<string, {
    isLoading: boolean;
    progress: number;
    message: string;
  }>>({});

  // Computed global loading state based on current source
  const currentSource = computed(() => findSourceAtTime(currentTime.value));
  
  const isLoading = computed(() => {
    if (!currentSource.value) return false;
    return loadingStates[currentSource.value.id]?.isLoading || false;
  });

  const loadingProgress = computed(() => {
    if (!currentSource.value) return 0;
    return loadingStates[currentSource.value.id]?.progress || 0;
  });

  const loadingMessage = computed(() => {
    if (!currentSource.value) return '';
    return loadingStates[currentSource.value.id]?.message || '';
  });

  const renderFps = ref(0);
  const cacheSize = ref(0);
  let fpsFrameCount = 0;
  let fpsLastTime = performance.now();

  // Helper to update loading state for a source
  const updateSourceLoading = (sourceId: string, state: Partial<{ isLoading: boolean; progress: number; message: string }>) => {
    if (!loadingStates[sourceId]) {
      loadingStates[sourceId] = { isLoading: false, progress: 0, message: '' };
    }
    Object.assign(loadingStates[sourceId], state);
  };

  const normalizeCodecDescription = (description: unknown): ArrayBuffer | undefined => {
    if (!description) return undefined;
    if (description instanceof ArrayBuffer) return description;
    if (ArrayBuffer.isView(description)) {
      return new Uint8Array(description.buffer, description.byteOffset, description.byteLength).slice().buffer;
    }
    if (Array.isArray(description)) {
      return new Uint8Array(description).buffer;
    }
    if (typeof description === 'object') {
      const record = description as Record<string, unknown>;
      // Handle rawData from extradata
      const wrapped = record.rawData ?? record.data ?? record.bytes ?? record.buffer;
      if (wrapped) {
        return normalizeCodecDescription(wrapped);
      }
    }
    return undefined;
  };

  const normalizeUint8Array = (value: unknown): Uint8Array | null => {
    if (!value) return null;
    if (value instanceof Uint8Array) return value;
    if (ArrayBuffer.isView(value)) {
      return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (Array.isArray(value)) return new Uint8Array(value);
    return null;
  };

  const buildAvcConfigRecord = (options: {
    spsList: Uint8Array[];
    ppsList: Uint8Array[];
    profile?: number;
    compatibility?: number;
    level?: number;
    lengthSizeMinusOne?: number;
  }): ArrayBuffer | undefined => {
    const { spsList, ppsList } = options;
    if (!spsList.length || !ppsList.length) {
      return undefined;
    }

    const configurationVersion = 1;
    const profile = options.profile ?? 0;
    const compatibility = options.compatibility ?? 0;
    const level = options.level ?? 0;
    const lengthSizeMinusOne = options.lengthSizeMinusOne ?? 3;

    const totalSize =
      7 +
      spsList.reduce((sum, sps) => sum + 2 + sps.byteLength, 0) +
      1 +
      ppsList.reduce((sum, pps) => sum + 2 + pps.byteLength, 0);

    const buffer = new Uint8Array(totalSize);
    let offset = 0;
    buffer[offset++] = configurationVersion & 0xff;
    buffer[offset++] = profile & 0xff;
    buffer[offset++] = compatibility & 0xff;
    buffer[offset++] = level & 0xff;
    buffer[offset++] = 0xfc | (lengthSizeMinusOne & 0x03);
    buffer[offset++] = 0xe0 | (spsList.length & 0x1f);

    for (const sps of spsList) {
      buffer[offset++] = (sps.byteLength >> 8) & 0xff;
      buffer[offset++] = sps.byteLength & 0xff;
      buffer.set(sps, offset);
      offset += sps.byteLength;
    }

    buffer[offset++] = ppsList.length & 0xff;
    for (const pps of ppsList) {
      buffer[offset++] = (pps.byteLength >> 8) & 0xff;
      buffer[offset++] = pps.byteLength & 0xff;
      buffer.set(pps, offset);
      offset += pps.byteLength;
    }

    return buffer.buffer;
  };

  const extractNaluArray = (arr: any[]): Uint8Array[] => {
    if (!Array.isArray(arr)) return [];
    return arr.map((item) => {
      // Handle MP4Box format where SPS/PPS are objects with nalu property
      if (item?.nalu) return normalizeUint8Array(item.nalu);
      if (item?.data) return normalizeUint8Array(item.data);
      return normalizeUint8Array(item);
    }).filter(Boolean) as Uint8Array[];
  };

  const buildAvcConfig = (trackOrAvcC: any): ArrayBuffer | undefined => {
    const avcC = trackOrAvcC?.avcC ?? trackOrAvcC?.avcc ?? trackOrAvcC;
    if (!avcC) return undefined;
    const spsList = extractNaluArray(avcC.SPS ?? avcC.sps ?? []);
    const ppsList = extractNaluArray(avcC.PPS ?? avcC.pps ?? []);
    const profile = avcC.AVCProfileIndication ?? avcC.profile ?? spsList[0]?.[1] ?? 0;
    const compatibility = avcC.profile_compatibility ?? avcC.compatibility ?? spsList[0]?.[2] ?? 0;
    const level = avcC.AVCLevelIndication ?? avcC.level ?? spsList[0]?.[3] ?? 0;
    const lengthSizeMinusOne = avcC.lengthSizeMinusOne ?? 3;
    
    console.log('[WebCodecsPlayback] buildAvcConfig input:', {
      hasAvcC: !!avcC,
      avcCKeys: avcC ? Object.keys(avcC) : [],
      spsCount: spsList.length,
      ppsCount: ppsList.length,
      profile,
      level,
    });
    
    return buildAvcConfigRecord({ spsList, ppsList, profile, compatibility, level, lengthSizeMinusOne });
  };

  const extractAvcParameterSets = (data: Uint8Array): { sps: Uint8Array[]; pps: Uint8Array[] } | null => {
    const sps: Uint8Array[] = [];
    const pps: Uint8Array[] = [];

    const pushNal = (nal: Uint8Array) => {
      if (!nal.length) return;
      const nalType = nal[0] & 0x1f;
      if (nalType === 7) sps.push(nal);
      if (nalType === 8) pps.push(nal);
    };

    const startIndices: number[] = [];
    for (let i = 0; i < data.length - 3; i += 1) {
      if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 1) {
        startIndices.push(i);
        i += 2;
        continue;
      }
      if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0 && data[i + 3] === 1) {
        startIndices.push(i);
        i += 3;
      }
    }

    if (startIndices.length) {
      for (let i = 0; i < startIndices.length; i += 1) {
        const startIndex = startIndices[i];
        const startCodeLength = data[startIndex + 2] === 1 ? 3 : 4;
        const nalStart = startIndex + startCodeLength;
        const nextStart = i + 1 < startIndices.length ? startIndices[i + 1] : data.length;
        if (nextStart > nalStart) {
          pushNal(data.subarray(nalStart, nextStart));
        }
      }
    } else {
      let offset = 0;
      while (offset + 4 <= data.length) {
        const size =
          (data[offset] << 24) |
          (data[offset + 1] << 16) |
          (data[offset + 2] << 8) |
          data[offset + 3];
        offset += 4;
        if (size <= 0 || offset + size > data.length) {
          break;
        }
        pushNal(data.subarray(offset, offset + size));
        offset += size;
      }
    }

    if (!sps.length || !pps.length) {
      return null;
    }

    return { sps, pps };
  };

  const getAvcCFromTrackBoxes = (mp4boxFile: any, trackId: number): any => {
    try {
      // Try multiple paths to find avcC in MP4Box structure
      // Path 1: via getTrackById
      const trackById = mp4boxFile?.getTrackById?.(trackId);
      const entry1 = trackById?.trak?.mdia?.minf?.stbl?.stsd?.entries?.[0];
      if (entry1?.avcC || entry1?.avcc) {
        console.log('[WebCodecsPlayback] Found avcC via getTrackById path');
        return entry1.avcC ?? entry1.avcc;
      }

      // Path 2: via moov.traks array
      const traks = mp4boxFile?.moov?.traks;
      if (Array.isArray(traks)) {
        for (const trak of traks) {
          const trakId = trak?.tkhd?.track_id;
          if (trakId === trackId) {
            const entry2 = trak?.mdia?.minf?.stbl?.stsd?.entries?.[0];
            if (entry2?.avcC || entry2?.avcc) {
              console.log('[WebCodecsPlayback] Found avcC via moov.traks path');
              return entry2.avcC ?? entry2.avcc;
            }
          }
        }
      }

      // Path 3: Check if avcC is directly on the sample description
      const info = mp4boxFile?.getInfo?.();
      const videoTrack = info?.tracks?.find((t: any) => t.id === trackId);
      if (videoTrack?.avcC || videoTrack?.avcc) {
        console.log('[WebCodecsPlayback] Found avcC via getInfo track');
        return videoTrack.avcC ?? videoTrack.avcc;
      }

      // Path 4: Look for avcC in boxes array of the sample entry
      if (entry1?.boxes) {
        for (const box of entry1.boxes) {
          if (box.type === 'avcC' || box.type === 'avcc') {
            console.log('[WebCodecsPlayback] Found avcC in entry1.boxes');
            return box;
          }
        }
      }

      // Path 5: Try moov.traks entry boxes
      if (Array.isArray(traks)) {
        for (const trak of traks) {
          const trakId = trak?.tkhd?.track_id;
          if (trakId === trackId) {
            const entry = trak?.mdia?.minf?.stbl?.stsd?.entries?.[0];
            if (entry?.boxes) {
              for (const box of entry.boxes) {
                if (box.type === 'avcC' || box.type === 'avcc') {
                  console.log('[WebCodecsPlayback] Found avcC in moov.traks entry.boxes');
                  return box;
                }
              }
            }
          }
        }
      }

      // Path 6: Try to get raw avcC data buffer if the box has a write method
      if (entry1) {
        // Check if entry1 itself is the avc1/avc3 box with avcC inside
        for (const key of Object.keys(entry1)) {
          const val = entry1[key];
          if (val && typeof val === 'object' && (val.type === 'avcC' || key === 'avcC' || key === 'avcc')) {
            console.log('[WebCodecsPlayback] Found avcC as entry1 property:', key);
            return val;
          }
        }
        
        // Check for extradata (raw codec config bytes)
        if (entry1.extradata || entry1.extra_data) {
          const extradata = entry1.extradata ?? entry1.extra_data;
          console.log('[WebCodecsPlayback] Found extradata on entry1, length:', extradata?.byteLength ?? extradata?.length);
          // Return as-is, it should be raw AVCDecoderConfigurationRecord
          return { rawData: extradata };
        }
      }

      // Path 7: Check track.extradata directly
      if (trackById?.extradata) {
        console.log('[WebCodecsPlayback] Found extradata on trackById');
        return { rawData: trackById.extradata };
      }

      // Path 8: Check videoTrack from getInfo
      if (videoTrack?.extradata) {
        console.log('[WebCodecsPlayback] Found extradata on videoTrack');
        return { rawData: videoTrack.extradata };
      }

      // Debug: log what we found
      console.warn('[WebCodecsPlayback] avcC not found. Debug info:', {
        hasGetTrackById: typeof mp4boxFile?.getTrackById === 'function',
        trackByIdKeys: trackById ? Object.keys(trackById).slice(0, 20) : [],
        hasMoov: !!mp4boxFile?.moov,
        traksCount: traks?.length,
        entry1Type: entry1?.type,
        entry1Keys: entry1 ? Object.keys(entry1).slice(0, 20) : [],
        entry1BoxTypes: entry1?.boxes?.map((b: any) => b.type) ?? [],
        firstTrakStsdEntry: traks?.[0]?.mdia?.minf?.stbl?.stsd?.entries?.[0] ? Object.keys(traks[0].mdia.minf.stbl.stsd.entries[0]).slice(0, 20) : [],
      });

      return undefined;
    } catch (error) {
      console.warn('[WebCodecsPlayback] Failed to read avcC from MP4Box track boxes:', error);
      return undefined;
    }
  };

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
    return `${sourceId}:${Math.round(timestamp * 1000000)}`; // Convert seconds to microseconds to match decoder
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
  async function initializeDecoder(source: VideoSource, startTime?: number): Promise<DecoderState | null> {
    const { path: videoPath, trimOffset } = resolveVideoPath(source);
    
    // CRITICAL: Check if this is a proxy path or original path
    // If it's the original path and we expect a proxy, wait for proxy to be ready
    const isOriginalFile = !videoPath.includes('proxy_');
    if (isOriginalFile && getEffectivePathWithOffset) {
      console.warn(`[WebCodecsPlayback] ⚠️ Attempting to load original file instead of proxy for source ${source.id}`);
      console.warn(`[WebCodecsPlayback] Path: ${videoPath.split('\\').pop()}`);
      console.warn(`[WebCodecsPlayback] This will cause slow playback. Waiting for proxy...`);
    }

    const cacheKey = `${source.id}:${videoPath}`;

    // Return existing decoder if already initialized
    if (decoders.has(cacheKey)) {
      const existing = decoders.get(cacheKey)!;
      if (existing.isInitialized) {
        return existing;
      }
    }

    console.log(`[WebCodecsPlayback] Initializing decoder for source ${source.id} with path: ${videoPath.split('\\').pop()}`);
    
    // Set loading state for this source
    updateSourceLoading(source.id, {
      isLoading: true,
      progress: 0,
      message: 'Fetching video...'
    });

    try {
      // Create a timeout race for initialization
      const initWithTimeout = new Promise<DecoderState | null>(async (resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Decoder initialization timed out (15s)'));
        }, 15000);

        try {
          // In dev: use local video server (port 48276) which handles range requests
          // In production: the video server is bundled and runs on the same port
          // The server is started in lib.rs setup() and runs for the lifetime of the app
          const encodedPath = btoa(videoPath);
          const videoUrl = `http://localhost:48276/video/${encodedPath}`;
          console.log(`[WebCodecsPlayback] Fetching from video server: ${videoUrl}`);
          
          // Use web-demuxer - no sample limits, designed for WebCodecs
          // Must use absolute URL for WASM file since web-demuxer runs in a Web Worker
          const wasmUrl = new URL('/web-demuxer.wasm', window.location.origin).href;
          const demuxer = new WebDemuxer({
            wasmFilePath: wasmUrl
          });
          console.log('[WebCodecsPlayback] Created WebDemuxer instance with WASM:', wasmUrl);
          
          // Load video with web-demuxer
          await demuxer.load(videoUrl);
          console.log('[WebCodecsPlayback] Video loaded successfully');
          
          // Get media info to check video length
          const mediaInfo = await demuxer.getMediaInfo();
          console.log('[WebCodecsPlayback] Media info:', {
            duration: mediaInfo.duration,
            nbStreams: mediaInfo.nb_streams,
            videoStream: mediaInfo.streams.find(s => s.codec_type_string === 'video')
          });
          
          // Get video decoder config from web-demuxer
          const videoDecoderConfig = await demuxer.getDecoderConfig('video');
          console.log('[WebCodecsPlayback] Got decoder config:', videoDecoderConfig);
          
          // Create WebCodecs VideoDecoder
          const decoder = new VideoDecoder({
            output: (frame: VideoFrame) => {
              // Cache decoded frame
              const key = `${source.id}:${frame.timestamp}`;
              
              // Convert VideoFrame to ImageBitmap asynchronously
              createImageBitmap(frame).then(bitmap => {
                frameCache.set(key, {
                  bitmap,
                  timestamp: frame.timestamp / 1000000, // Convert to seconds
                  sourceId: source.id
                });
                frame.close();
                
                cacheDebugCounter++;
                outputFrameCount++;
              }).catch(err => {
                console.error('[WebCodecsPlayback] Failed to create ImageBitmap:', err);
                frame.close();
              });
            },
            error: (e: any) => {
              console.error('[WebCodecsPlayback] VideoDecoder error:', e);
              onError?.(`Video decoder error: ${e.message}`);
            }
          });
          
          // Configure decoder
          decoder.configure(videoDecoderConfig);
          console.log('[WebCodecsPlayback] VideoDecoder configured');
          
          // Create decoder state
          const decoderState: DecoderState = {
            decoder,
            mp4boxFile: demuxer, // Store demuxer here for compatibility
            videoTrack: { id: 1 }, // Dummy track info
            sourceId: source.id,
            videoPath,
            isInitialized: true,
            isDecoding: false,
            durationSec: typeof mediaInfo?.duration === 'number' ? mediaInfo.duration : undefined,
            fullDecodeComplete: false
          };
          
          // CRITICAL: Store decoder in map so it can be looked up for continuous decoding
          decoders.set(cacheKey, decoderState);
          console.log(`[WebCodecsPlayback] Decoder stored with key: ${cacheKey.substring(0, 60)}...`);
          
          // CRITICAL: Read the ENTIRE video, not just 2 seconds
          // This fixes the "plays a few seconds then freezes" issue
          console.log('[WebCodecsPlayback] Starting full video stream decode...');
          const videoStream = await demuxer.read('video', 0, mediaInfo.duration || 999999);
          const reader = videoStream.getReader();
          let chunkCount = 0;
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            decoder.decode(value);
            chunkCount++;
            
            // Log progress every 100 chunks
            if (chunkCount % 100 === 0) {
              console.log(`[WebCodecsPlayback] Decoded ${chunkCount} chunks...`);
            }
          }
          
          await decoder.flush();
          decoderState.fullDecodeComplete = true;
          console.log(`[WebCodecsPlayback] ✅ Full video decoded: ${chunkCount} chunks total`);
          
          console.log('[WebCodecsPlayback] Initial frames decoded and cached');
          updateSourceLoading(source.id, {
            isLoading: false,
            progress: 100,
            message: 'Ready'
          });

          // Wait for initialization to complete
          clearTimeout(timeoutId);
          resolve(decoderState);
        } catch (error) {
          clearTimeout(timeoutId);
          reject(error);
        }
      });

      const initPromise = initWithTimeout;
      initializingDecoders.set(cacheKey, initPromise);
      initPromise.finally(() => {
        initializingDecoders.delete(cacheKey);
        // Ensure loading state is cleared even if init fails
        if (loadingStates[source.id]?.isLoading) {
          updateSourceLoading(source.id, { isLoading: false });
           updateSourceLoading(source.id, { isLoading: false });
        }
      });
      return initPromise;
    } catch (error) {
      console.error('[WebCodecsPlayback] Failed to initialize decoder:', error);
      updateSourceLoading(source.id, { 
        message: 'Failed to load video',
        isLoading: false
      });
      onError?.(String(error));
      return null;
    }
  }

  // Prefetch frames ahead of playhead
  async function prefetchFrames(source: VideoSource, startTime: number) {
    const decoderState = await initializeDecoder(source);
    if (!decoderState) return;

    // Use web-demuxer to seek and decode frames at the desired time
    const demuxer = decoderState.mp4boxFile as WebDemuxer;
    try {
      // Read 2 seconds of video starting from startTime
      const videoStream = await demuxer.read('video', startTime, startTime + 2);
      
      // Decode the frames
      const reader = videoStream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        decoderState.decoder.decode(value);
      }
      await decoderState.decoder.flush();
      
      console.log(`[WebCodecsPlayback] Prefetched frames at ${startTime.toFixed(3)}s`);
    } catch (error) {
      console.warn(`[WebCodecsPlayback] Failed to prefetch frames at ${startTime.toFixed(3)}s:`, error);
    }
  }

  // Prune frames that are behind playhead (keep rolling window)
  function pruneFrames(playheadTime: number, sourceId: string) {
    const BACK_BUFFER = 0.5; // Keep frames 0.5s behind playhead
    const keysToDelete: string[] = [];
    
    for (const [key, cached] of frameCache.entries()) {
      if (cached.sourceId === sourceId && cached.timestamp < playheadTime - BACK_BUFFER) {
        cached.bitmap.close();
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => frameCache.delete(key));
  }

  // Render a frame to canvas
  function renderFrame(timestamp: number) {
    if (!ctx || !canvasRef.value) return;

    const source = findSourceAtTime(timestamp);
    
    // Handle source transitions
    if (source && currentSourceId !== source.id) {
      console.log(`[WebCodecsPlayback] Source transition: ${currentSourceId || 'none'} -> ${source.id}`);
      currentSourceId = source.id;

      // Initialize decoder for new source
      initializeDecoder(source);
    }

    if (!source) {
      // No source at this time - render black
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvasRef.value.width, canvasRef.value.height);
      return;
    }

    // Calculate time within the source file (accounts for trim_start)
    const sourceTime = getSourceTime(timestamp, source);
    const { trimOffset } = resolveVideoPath(source);
    // Frames from proxies are cached starting at 0s (proxy start)
    const adjustedTime = trimOffset > 0 ? sourceTime - trimOffset : sourceTime;

    const { path: videoPath } = resolveVideoPath(source);
    const cacheKeyForDecoder = `${source.id}:${videoPath}`;
    const decoderState = decoders.get(cacheKeyForDecoder);
    if (decoderState?.durationSec !== undefined && adjustedTime > decoderState.durationSec) {
      const sourceFrames = Array.from(frameCache.values()).filter((f) => f.sourceId === source.id);
      if (sourceFrames.length > 0) {
        const lastFrame = sourceFrames.reduce((max, f) => (f.timestamp > max.timestamp ? f : max));
        try {
          if (canvasRef.value.width !== lastFrame.bitmap.width || canvasRef.value.height !== lastFrame.bitmap.height) {
            canvasRef.value.width = lastFrame.bitmap.width;
            canvasRef.value.height = lastFrame.bitmap.height;
          }
          ctx.drawImage(lastFrame.bitmap, 0, 0);
          lastRenderedFrame = lastFrame.bitmap;
        } catch (e) {
          console.warn('[WebCodecsPlayback] Failed to render last frame at end of source:', e);
        }
      }
      return;
    }

    if (lastRenderSourceId !== source.id) {
      lastRenderSourceId = source.id;
      lastRenderTime = adjustedTime;
    } else if (!isPlaying.value && Math.abs(adjustedTime - lastRenderTime) > 0.25) {
      if (!decoderState?.fullDecodeComplete) {
        clearSourceCache(source);
        resetDecoder(source);
        initializeDecoder(source, adjustedTime);
      }
      lastRenderTime = adjustedTime;
    } else {
      lastRenderTime = adjustedTime;
    }

    // Continuously decode frames ahead of playhead during playback
    if (isPlaying.value && source) {
      const { path: videoPath } = resolveVideoPath(source);
      const cacheKey = `${source.id}:${videoPath}`;
      const decoderState = decoders.get(cacheKey);
      
      if (decoderState && decoderState.isInitialized) {
        // Check if we need more frames ahead
        const sourceCachedFrames = Array.from(frameCache.values()).filter(f => f.sourceId === source.id);
        const maxCachedTime = sourceCachedFrames.length > 0 
          ? Math.max(...sourceCachedFrames.map(f => f.timestamp))
          : 0;
        
        // If we don't have enough frames ahead (less than 1 second), decode more
        const needsMoreFrames = maxCachedTime < adjustedTime + 1;
        
        if (needsMoreFrames && !decoderState.isDecoding) {
          decoderState.isDecoding = true;
          const demuxer = decoderState.mp4boxFile as WebDemuxer;
          const startTime = Math.max(maxCachedTime + 0.01, adjustedTime); // Start just after last cached frame
          const endTime = adjustedTime + 3; // Decode 3 seconds ahead
          
          console.log(`[WebCodecsPlayback] 📥 Decoding ahead: ${startTime.toFixed(2)}s → ${endTime.toFixed(2)}s (playhead: ${adjustedTime.toFixed(2)}s, maxCached: ${maxCachedTime.toFixed(2)}s)`);
          
          // Decode frames asynchronously (don't await to avoid blocking render)
          (async () => {
            try {
              const videoStream = await demuxer.read('video', startTime, endTime);
              const reader = videoStream.getReader();
              let chunkCount = 0;
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                decoderState.decoder.decode(value);
                chunkCount++;
              }
              console.log(`[WebCodecsPlayback] ✅ Decoded ${chunkCount} chunks ahead`);
            } catch (err) {
              console.warn('[WebCodecsPlayback] Failed to decode ahead:', err);
            } finally {
              decoderState.isDecoding = false;
            }
          })();
        }
      }
    }

    // Initialize decoder for upcoming sources (but don't seek during playback)
    if (isPlaying.value) {
      const upcoming = videoSources.value.find(
        (candidate) => candidate.start_time > timestamp && candidate.start_time - timestamp <= 3,
      );
      if (upcoming) {
        initializeDecoder(upcoming, 0);
      }
    }
    
    // Look for cached frame
    const cacheKey = getCacheKey(source.id, adjustedTime);
    let cachedFrame = frameCache.get(cacheKey);
    if (!cachedFrame) {
      let closestFrame: CachedFrame | null = null;
      let closestDelta = Infinity;
      let latestFrame: CachedFrame | null = null;
      for (const frame of frameCache.values()) {
        if (frame.sourceId !== source.id) continue;
        const delta = Math.abs(frame.timestamp - adjustedTime);
        if (delta < closestDelta) {
          closestDelta = delta;
          closestFrame = frame;
        }
        if (frame.timestamp <= adjustedTime && (!latestFrame || frame.timestamp > latestFrame.timestamp)) {
          latestFrame = frame;
        }
      }
      if (closestFrame && closestDelta <= 0.1) {
        cachedFrame = closestFrame;
      } else if (latestFrame) {
        cachedFrame = latestFrame;
      }
    }

    if (cachedFrame) {
      // Render cached frame
      const bitmap = cachedFrame.bitmap;
      
      try {
        // Resize canvas to match bitmap dimensions if needed
        if (canvasRef.value.width !== bitmap.width || 
            canvasRef.value.height !== bitmap.height) {
          canvasRef.value.width = bitmap.width;
          canvasRef.value.height = bitmap.height;
        }

        // Draw bitmap to canvas
        ctx.drawImage(bitmap, 0, 0);
        
        // Debug: log successful render every 30 frames
        if (outputFrameCount % 30 === 0) {
          console.log(`[WebCodecsPlayback] Rendered frame at ${adjustedTime.toFixed(3)}s`);
        }
        
        lastRenderedFrame = bitmap;
      } catch (drawError) {
        console.error('[WebCodecsPlayback] Canvas drawImage failed:', drawError);
      }
    } else {
      // Fallback: if target time is before earliest cached frame, find earliest
      const sourceFrames = Array.from(frameCache.values()).filter(f => f.sourceId === source.id);
      if (sourceFrames.length > 0) {
        const earliestFrame = sourceFrames.reduce((min, f) => f.timestamp < min.timestamp ? f : min);
        if (adjustedTime < earliestFrame.timestamp && earliestFrame.timestamp - adjustedTime < 2.0) {
          // Target is before earliest cached frame but within 2s - render earliest
          try {
            const bitmap = earliestFrame.bitmap;
            if (canvasRef.value.width !== bitmap.width || 
                canvasRef.value.height !== bitmap.height) {
              canvasRef.value.width = bitmap.width;
              canvasRef.value.height = bitmap.height;
            }
            ctx.drawImage(bitmap, 0, 0);
            lastRenderedFrame = bitmap;
            return; // Successfully rendered fallback frame
          } catch (e) {
            console.warn('[WebCodecsPlayback] Fallback render failed:', e);
          }
        }
      }
      
      if (cacheDebugCounter % 60 === 0) {
        const sampleFrames = sourceFrames
          .slice(0, 3)
          .map((f) => Number(f.timestamp.toFixed(3)));
        console.warn('[WebCodecsPlayback] No cached frame for time, debug:', {
          sourceId: source.id,
          adjustedTime: Number(adjustedTime.toFixed(3)),
          cacheSize: frameCache.size,
          sampleFrames,
        });
      }
      cacheDebugCounter += 1;
      
      // Frame not in cache - hold last frame (don't clear canvas)
      if (lastRenderedFrame) {
        try {
          // Keep showing last frame while waiting for new one
          ctx.drawImage(lastRenderedFrame, 0, 0);
        } catch (drawError) {
          // Bitmap was closed/detached - clear it
          console.warn('[WebCodecsPlayback] lastRenderedFrame detached, clearing');
          lastRenderedFrame = null;
          // Don't clear canvas - keep whatever was there
        }
      }
      // If no lastRenderedFrame, canvas keeps previous content
      // Don't fill black - that causes visible flashes

      // Note: During playback, samples continue to stream and decode via onSamples
      // We don't seek/flush here - that would reset the decoder position
      // The streaming MP4FileSink continues to feed data and onSamples fires naturally
    }
  }

  // RAF rendering loop
  let tickCount = 0;
  let lastLoggedSecond = -1;
  // Debug status logging
  let lastDebugStatusTime = 0;
  function logDebugStatus() {
    const now = performance.now();
    if (now - lastDebugStatusTime < 500) return;
    lastDebugStatusTime = now;
    
    const source = currentSourceId ? Array.from(frameCache.values()).filter(f => f.sourceId === currentSourceId) : [];
    const minTs = source.length > 0 ? Math.min(...source.map(f => f.timestamp)) : 0;
    const maxTs = source.length > 0 ? Math.max(...source.map(f => f.timestamp)) : 0;
    const playhead = currentTime.value;
    
    // Get decoder state - need to construct full cache key with videoPath
    let decoderState = 'none';
    let decodeQueueSize = 0;
    const activeSource = findSourceAtTime(currentTime.value);
    if (activeSource && currentSourceId) {
      const { path: videoPath } = resolveVideoPath(activeSource);
      const cacheKey = `${activeSource.id}:${videoPath}`;
      const decoderStateObj = decoders.get(cacheKey);
      if (decoderStateObj?.decoder) {
        decoderState = decoderStateObj.decoder.state;
        decodeQueueSize = decoderStateObj.decoder.decodeQueueSize;
      }
    }
    
    console.log('[WebCodecsPlayback] status', {
      playhead: playhead.toFixed(3),
      cache: {
        size: frameCache.size,
        sourceSize: source.length,
        minTs: minTs.toFixed(3),
        maxTs: maxTs.toFixed(3),
        behindMs: ((playhead - minTs) * 1000).toFixed(0),
        aheadMs: ((maxTs - playhead) * 1000).toFixed(0),
      },
      pendingSamples: pendingSamples.length,
      decoderState,
      decodeQueueSize,
    });
  }

  // Helper: decode a pending sample
  function decodePendingSample(ps: PendingSample, decoder: VideoDecoder) {
    if (!decoder || decoder.state === 'closed') {
      console.log(`[WebCodecsPlayback] ⚠️ decodePendingSample: Decoder not available (state=${decoder?.state})`);
      return;
    }
    
    const chunk = new EncodedVideoChunk({
      type: ps.isKey ? 'key' : 'delta',
      timestamp: ps.timestampUs,
      duration: ps.durationUs,
      data: ps.data,
    });
    
    try {
      decoder.decode(chunk);
      // Log first few decodes to confirm pipeline is working
      if (outputFrameCount < 5) {
        console.log(`[WebCodecsPlayback] decode chunk t=${ps.timeSec.toFixed(3)}s key=${ps.isKey}`);
      }
    } catch (e) {
      console.warn('[WebCodecsPlayback] decode() failed:', e);
    }
  }
  
  // Helper: drain pending samples that are now within the ahead window
  function drainPending(playheadSec: number, decoder: VideoDecoder) {
    if (!decoder || decoder.state === 'closed') {
      console.log(`[WebCodecsPlayback] ⚠️ drainPending: Decoder not available (state=${decoder?.state})`);
      return;
    }
    
    const initialPendingCount = pendingSamples.length;
    const initialQueueSize = decoder.decodeQueueSize;
    
    // If nothing decoded yet, drop leading non-keyframes (can't decode without keyframe)
    if (frameCache.size === 0) {
      let dropped = 0;
      while (pendingSamples.length > 0 && !pendingSamples[0].isKey) {
        pendingSamples.shift();
        dropped++;
      }
      if (dropped > 0) {
        console.log(`[WebCodecsPlayback] 🔑 drainPending: Dropped ${dropped} non-keyframes at start`);
      }
    }
    
    let processed = 0;
    let stoppedReason = 'none';
    
    // Keep draining until we're buffered far enough ahead OR decoder queue is full
    while (pendingSamples.length > 0) {
      const next = pendingSamples[0];
      
      // Stop if this sample is too far ahead
      if (next.timeSec > playheadSec + KEEP_AHEAD_SEC) {
        stoppedReason = 'too-far-ahead';
        break;
      }
      
      // Stop if decoder queue is getting full
      if (decoder.decodeQueueSize > 6) {
        stoppedReason = 'queue-full';
        break;
      }
      
      pendingSamples.shift();
      decodePendingSample(next, decoder);
      processed++;
    }
    
    if (processed > 0 || initialPendingCount > 0) {
      const nextSampleTime = pendingSamples.length > 0 ? pendingSamples[0].timeSec.toFixed(3) : 'none';
      console.log(`[WebCodecsPlayback] 🔄 drainPending: playhead=${playheadSec.toFixed(3)}s, processed=${processed}, pending=${initialPendingCount}→${pendingSamples.length}, queueSize=${initialQueueSize}→${decoder.decodeQueueSize}, nextSample=${nextSampleTime}s, stopped=${stoppedReason}`);
    }
  }

  function tick(timestamp: number) {
    try {
      tickCount++;
      rafDebugCounter++;
      
      // Debug status every 500ms (NO per-tick logs)
      logDebugStatus();
      
      if (!isPlaying.value) {
        rafId = null;
        return;
      }

      // Prune old frames and drain pending samples before rendering
      const activeSource = findSourceAtTime(currentTime.value);
      if (activeSource && currentSourceId) {
        const { path: videoPath } = resolveVideoPath(activeSource);
        const cacheKey = `${activeSource.id}:${videoPath}`;
        const decoderState = decoders.get(cacheKey);
        if (decoderState?.decoder) {
          drainPending(currentTime.value, decoderState.decoder);
        }
        pruneCache(currentTime.value, currentSourceId);
      }

      renderFrame(currentTime.value);

      // Update FPS counter
      fpsFrameCount++;
      if (timestamp - fpsLastTime >= 1000) {
        renderFps.value = Math.round(fpsFrameCount * 1000 / (timestamp - fpsLastTime));
        fpsFrameCount = 0;
        fpsLastTime = timestamp;
      }
    } catch (tickError) {
      console.error('[WebCodecsPlayback] RAF tick crashed:', tickError);
    }

    rafId = requestAnimationFrame(tick);
  }

  // Start rendering loop
  function startRendering() {
    if (rafId !== null) {
      console.log('[WebCodecsPlayback] ⚠️ RAF already running, rafId:', rafId);
      return;
    }
    console.log('[WebCodecsPlayback] 🚀 Starting RAF loop...');
    rafId = requestAnimationFrame(tick);
    console.log('[WebCodecsPlayback] ✅ RAF loop started, rafId:', rafId);
    
    // Verify RAF wasn't immediately canceled
    setTimeout(() => {
      if (rafId !== null) {
        console.log('[WebCodecsPlayback] ✓ RAF still scheduled after 10ms, rafId:', rafId);
      } else {
        console.error('[WebCodecsPlayback] ❌ RAF was CANCELED within 10ms!');
      }
    }, 10);
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
    // Close all cached bitmaps
    for (const cached of frameCache.values()) {
      cached.bitmap.close();
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

    // Clear last rendered frame reference (already closed above in frameCache)
    lastRenderedFrame = null;
  }

  function clearSourceCache(source: VideoSource) {
    for (const [key, cached] of frameCache.entries()) {
      if (cached.sourceId === source.id) {
        cached.bitmap.close();
        frameCache.delete(key);
      }
    }
    cacheSize.value = frameCache.size;
  }

  function resetDecoder(source: VideoSource) {
    const { path: videoPath } = resolveVideoPath(source);
    const decoderKey = `${source.id}:${videoPath}`;
    const existing = decoders.get(decoderKey);
    if (existing) {
      if (existing.decoder.state !== 'closed') {
        existing.decoder.close();
      }
      decoders.delete(decoderKey);
    }
    initializingDecoders.delete(decoderKey);
  }

  // Watch for play/pause changes
  watch(isPlaying, (playing) => {
    console.log(`[WebCodecsPlayback] 🎬 isPlaying changed: ${playing}, isInitialized: ${isInitialized.value}`);
    if (playing) {
      if (!isInitialized.value) {
        console.log('[WebCodecsPlayback] Initializing before starting rendering...');
        initialize();
      }
      console.log('[WebCodecsPlayback] ▶️ Starting rendering loop...');
      startRendering();
    } else {
      console.log('[WebCodecsPlayback] ⏸️ Stopping rendering loop...');
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
  watch(videoSources, async (sources) => {
    if (!sources || sources.length === 0 || !isInitialized.value) return;
    
    const source = findSourceAtTime(currentTime.value);
    if (source) {
      const { path: videoPath } = resolveVideoPath(source);
      const cacheKey = `${source.id}:${videoPath}`;
      
      if (!decoders.has(cacheKey)) {
        console.log(`[WebCodecsPlayback] Video sources loaded, initializing decoder for source ${source.id}`);
        await initializeDecoder(source);
      }
      
      // Render initial frame after decoder is ready
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
    isLoading,
    loadingProgress,
    loadingMessage,
    updateSourceLoading,
    renderFps,
    cacheSize,
    initialize,
    clearCache,
    renderFrame,
  };
}
