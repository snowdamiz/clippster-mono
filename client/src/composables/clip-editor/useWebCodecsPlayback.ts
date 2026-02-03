import { ref, watch, onUnmounted, reactive, computed, type Ref } from 'vue';
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
    
    for (const [key, frame] of frameCache.entries()) {
      // Only prune frames for the specified source (or all if not specified)
      if (sourceId && frame.sourceId !== sourceId) continue;
      
      // Evict if too far behind or too far ahead
      if (frame.timestamp < minTime || frame.timestamp > maxTime) {
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

    const inFlight = initializingDecoders.get(cacheKey);
    if (inFlight) {
      return inFlight;
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
          
          // Disable MP4Box debug logging in production (too verbose)
          if (MP4Box.Log) {
            MP4Box.Log.setLogLevel(MP4Box.Log.error);
          }
          
          const mp4boxFile = MP4Box.createFile();
          
          // CRITICAL: Must set discardMdatData = false to extract samples
          // If true, MP4Box throws away the actual video sample bytes and onSamples never fires
          mp4boxFile.discardMdatData = false;
          console.log('[WebCodecsPlayback] MP4Box discardMdatData set to false');
          
          // CRITICAL: Use streaming like the W3C WebCodecs example
          // Large chunks cause onSamples to never fire (GitHub issue #520)
          // Must use pipeTo() with small chunks for MP4Box to work correctly

          // Health check the video server first
          console.log('[WebCodecsPlayback] Checking video server health...');
          try {
            const healthCheck = await fetch(videoUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
            console.log('[WebCodecsPlayback] Video server health check:', healthCheck.status);
          } catch (e) {
            console.error('[WebCodecsPlayback] Video server not responding:', e);
            throw new Error('Video server is not responding. Please restart the application.');
          }

          // Set up MP4Box handlers and process using STREAMING like the W3C WebCodecs example
          // CRITICAL: Large chunks (64kb+) cause onSamples to never fire (GitHub issue #520)
          const decoderState = await new Promise<DecoderState | null>((resolveInner, rejectInner) => {
            let videoTrack: any = null;
            let decoder: VideoDecoder | null = null;
            let decoderConfigDebug: {
              codec?: string;
              descriptionBytes?: number;
              avcCBytes?: number;
              spsCount?: number;
              ppsCount?: number;
            } | null = null;
            let isResolved = false;
            let decoderConfigured = false;
            let decodeErrorLogged = false;
            let hasKeyframe = false;
            let streamOffset = 0;

            // MP4FileSink class to wrap MP4Box as a WritableStream sink (from W3C example)
            class MP4FileSink {
              write(chunk: Uint8Array) {
                // MP4Box.js requires buffers to be ArrayBuffers with fileStart property
                // CRITICAL: Use slice() to create standalone ArrayBuffer of exact size
                const buffer = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength) as ArrayBuffer & { fileStart: number };
                buffer.fileStart = streamOffset;
                streamOffset += buffer.byteLength;
                
                // Log progress periodically
                if (streamOffset % (1024 * 1024) < chunk.byteLength) {
                  console.log(`[WebCodecsPlayback] Streaming: ${(streamOffset / (1024 * 1024)).toFixed(1)} MiB, fileStart=${buffer.fileStart}`);
                }
                
                mp4boxFile.appendBuffer(buffer);
                
                // DO NOT flush() here - flush() means "end-of-file" in MP4Box
                // Calling it after each chunk prevents sample extraction
                // Only flush once when stream is complete (in close())
              }
              
              close() {
                console.log('[WebCodecsPlayback] Stream complete (fileSink closed)');
                // NOTE: Do NOT call mp4boxFile.flush() here
                // flush() signals EOF to MP4Box, which stops further sample extraction
                // We want MP4Box to continue extracting samples as they arrive during playback
                // flush() should only be called explicitly when seeking or switching sources
              }
            }

            mp4boxFile.onError = (e: any) => {
              console.error('[WebCodecsPlayback] MP4Box error:', e);
              if (!isResolved) {
                isResolved = true;
                rejectInner(new Error(`MP4Box error: ${e}`));
              }
            };

            // Register onSamples BEFORE starting fetch (as per W3C example)
            mp4boxFile.onSamples = async (trackId: number, _user: unknown, samples: any[]) => {
              try {
                console.log(`[WebCodecsPlayback] onSamples called! trackId=${trackId}, samples=${samples.length}, decoderConfigured=${decoderConfigured}, hasKeyframe=${hasKeyframe}, decoderState=${decoder?.state}`);
                
                let skippedCount = 0;
                let queuedCount = 0;
                let errorCount = 0;
                
                // Get track timescale for timestamp conversion
                const track = videoTrack;
                const timescale = track?.timescale || 1000;
                
                // Decode samples into frames
                for (const sample of samples) {
                  try {
                    // Skip samples with no data
                    if (!sample?.data || sample.data.byteLength === 0) {
                      skippedCount++;
                      continue;
                    }
                    
                    // Ensure data is Uint8Array
                    const data = sample.data instanceof Uint8Array 
                      ? sample.data 
                      : new Uint8Array(sample.data);
                    
                    if (!decoderConfigured && track?.codec?.startsWith('avc') && sample.is_sync) {
                      const extracted = extractAvcParameterSets(data);
                      if (extracted) {
                        const profile = extracted.sps[0]?.[1] ?? 0;
                        const compatibility = extracted.sps[0]?.[2] ?? 0;
                        const level = extracted.sps[0]?.[3] ?? 0;
                        const description = buildAvcConfigRecord({
                          spsList: extracted.sps,
                          ppsList: extracted.pps,
                          profile,
                          compatibility,
                          level,
                        });
                        if (description && decoder) {
                          const config: VideoDecoderConfig = {
                            codec: track.codec,
                            codedWidth: track.video?.width || 1920,
                            codedHeight: track.video?.height || 1080,
                            hardwareAcceleration: 'prefer-hardware',
                            description,
                          };
                          decoder.configure(config);
                          decoderConfigured = true;
                          decoderConfigDebug = {
                            codec: track.codec,
                            descriptionBytes: description.byteLength,
                            avcCBytes: undefined,
                            spsCount: extracted.sps.length,
                            ppsCount: extracted.pps.length,
                          };
                          console.log('[WebCodecsPlayback] Decoder configured from keyframe SPS/PPS.', {
                            trackId: track.id,
                            descriptionBytes: description.byteLength,
                            spsCount: extracted.sps.length,
                            ppsCount: extracted.pps.length,
                          });
                        }
                      } else {
                        console.warn('[WebCodecsPlayback] Failed to extract SPS/PPS from keyframe sample.', {
                          trackId: track.id,
                          sampleSize: data.byteLength,
                        });
                      }
                    }
                    
                    if (!hasKeyframe) {
                      if (!sample.is_sync) {
                        skippedCount++;
                        continue;
                      }
                      hasKeyframe = true;
                    }
                    
                    // Normalize timestamps to start at 0 for this source
                    const rawCts = sample.cts ?? sample.dts ?? 0;
                    
                    // Set base CTS from first sample if not already set
                    if (!baseCtsBySource.has(source.id) && samples.length > 0) {
                      baseCtsBySource.set(source.id, rawCts);
                      console.log(`[WebCodecsPlayback] Base CTS for source ${source.id}: ${rawCts} (timescale=${timescale}, ~${(rawCts/timescale).toFixed(2)}s)`);
                    }
                    
                    const baseCts = baseCtsBySource.get(source.id) ?? 0;
                    const normCts = rawCts - baseCts; // Now starts near 0
                    
                    // Convert normalized timestamps
                    const timeSec = normCts / timescale;
                    const timestampUs = Math.round((normCts * 1_000_000) / timescale);
                    const durationUs = Math.max(1, Math.round((sample.duration * 1_000_000) / timescale));
                    
                    // Create pending sample for on-demand decoding
                    const pendingSample: PendingSample = {
                      timeSec,
                      timestampUs,
                      durationUs,
                      isKey: !!sample.is_sync,
                      data,
                    };
                    
                    // Queue sample to pending buffer
                    pendingSamples.push(pendingSample);
                    queuedCount++;
                  } catch (sampleError) {
                    errorCount++;
                    console.warn('[WebCodecsPlayback] Sample processing error (skipping):', sampleError);
                    continue;
                  }
                }
                
                if (queuedCount > 0 || skippedCount > 0 || errorCount > 0) {
                  const totalPending = pendingSamples.length;
                  console.log(`[WebCodecsPlayback] onSamples: queued=${queuedCount}, skipped=${skippedCount}, errors=${errorCount}, batch=${samples.length}, pendingTotal=${totalPending}, seenKeyframe=${hasKeyframe}`);
                }
                
                // Release samples to free memory
                mp4boxFile.releaseUsedSamples(trackId, samples[samples.length - 1].number);
              } catch (onSamplesError) {
                console.error('[WebCodecsPlayback] CRITICAL onSamples error:', onSamplesError);
              }
            };

            mp4boxFile.onReady = (info: any) => {
              updateSourceLoading(source.id, { progress: 30, message: 'Parsing video track...' });
              console.log('[WebCodecsPlayback] MP4Box ready, tracks:', info.tracks.length);
              
              // Find video track
              videoTrack = info.tracks.find((t: any) => t.type === 'video');
              if (!videoTrack) {
                if (!isResolved) {
                  isResolved = true;
                  rejectInner(new Error('No video track found'));
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
              updateSourceLoading(source.id, { progress: 50, message: 'Configuring decoder...' });
              
              decoder = new VideoDecoder({
                output: async (frame: VideoFrame) => {
                  outputFrameCount++;
                  const ts = frame.timestamp / 1_000_000;
                  
                  // Log every 60 frames to debug freeze
                  if (outputFrameCount % 60 === 0) {
                    console.log(`[WebCodecsPlayback] OUTPUT #${outputFrameCount}, queue:${frameCache.size}, lastTs:${ts.toFixed(3)}s`);
                  }
                  
                  // Create ImageBitmap from frame (safer than caching VideoFrame)
                  const frameTimeSec = frame.timestamp / 1_000_000;
                  
                  try {
                    const bitmap = await createImageBitmap(frame);
                    const frameCacheKey = getCacheKey(source.id, frameTimeSec);
                    frameCache.set(frameCacheKey, {
                      bitmap,
                      timestamp: frameTimeSec,
                      sourceId: source.id,
                    });
                    
                    // Prune cache based on current playhead time
                    pruneCache(currentTime.value, source.id);
                  } catch (bitmapError) {
                    console.warn('[WebCodecsPlayback] Failed to create ImageBitmap:', bitmapError);
                  }
                  
                  // Always close the original frame from decoder
                  frame.close();
                  
                  // Resolve initialization promise on first frame
                  if (!isResolved && decoderConfigured) {
                    isResolved = true;
                    updateSourceLoading(source.id, {
                      isLoading: false,
                      progress: 100,
                      message: 'Ready'
                    });
                    
                    const decoderState: DecoderState = {
                      decoder: decoder!,
                      mp4boxFile,
                      videoTrack: videoTrack!,
                      sourceId: source.id,
                      videoPath,
                      isInitialized: true,
                    };
                    resolveInner(decoderState);
                  }
                  
                  // Continue pumping after each output
                  if (pumpDecoder) pumpDecoder();
                },
                error: (e: Error) => {
                  console.error('[WebCodecsPlayback] Decoder error:', e);
                  onError?.(e.message);
                },
              });

              // Set up chunk pump mechanism for this decoder
              pumpDecoder = () => {
                if (isPumping) return;
                if (!decoder || decoder.state === 'closed') return;
                isPumping = true;
                
                const pump = () => {
                  if (!decoder || decoder.state === 'closed') {
                    isPumping = false;
                    return;
                  }
                  
                  try {
                    while (pendingChunks.length > 0 && decoder.decodeQueueSize < MAX_QUEUE) {
                      const chunk = pendingChunks.shift();
                      if (chunk) {
                        try {
                          decoder.decode(chunk);
                        } catch (decodeErr) {
                          console.warn('[WebCodecsPlayback] decode() failed:', decodeErr);
                        }
                      }
                    }
                  } catch (e) {
                    console.error('[WebCodecsPlayback] Pump error:', e);
                  }
                  
                  if (pendingChunks.length > 0) {
                    requestAnimationFrame(pump);
                  } else {
                    isPumping = false;
                  }
                };
                
                requestAnimationFrame(pump);
              };

              // Configure decoder with track info
              const config: VideoDecoderConfig = {
                codec: videoTrack.codec || 'avc1.64001f',
                codedWidth: videoTrack.video?.width || 1920,
                codedHeight: videoTrack.video?.height || 1080,
                hardwareAcceleration: 'prefer-hardware', // Use GPU decoding
              };

              // Add description (codec-specific data) if available
              const boxAvcC = getAvcCFromTrackBoxes(mp4boxFile, videoTrack.id);
              const codecDescription =
                normalizeCodecDescription(videoTrack.description) ||
                normalizeCodecDescription(videoTrack.avcC) ||
                normalizeCodecDescription(videoTrack.avcc) ||
                normalizeCodecDescription(videoTrack.hvcC) ||
                normalizeCodecDescription(videoTrack.vpcC) ||
                normalizeCodecDescription(boxAvcC) ||
                (videoTrack.codec?.startsWith('avc') ? buildAvcConfig(boxAvcC ?? videoTrack) : undefined);

              const avcC = boxAvcC ?? videoTrack.avcC ?? videoTrack.avcc;
              const spsCount = Array.isArray(avcC?.SPS ?? avcC?.sps) ? (avcC.SPS ?? avcC.sps).length : 0;
              const ppsCount = Array.isArray(avcC?.PPS ?? avcC?.pps) ? (avcC.PPS ?? avcC.pps).length : 0;
              const avcCData = normalizeCodecDescription(avcC);
              decoderConfigDebug = {
                codec: videoTrack.codec,
                descriptionBytes: normalizeCodecDescription(videoTrack.description)?.byteLength ?? codecDescription?.byteLength,
                avcCBytes: avcCData?.byteLength,
                spsCount,
                ppsCount,
              };

              console.log('[WebCodecsPlayback] Video track description details:', {
                trackId: videoTrack.id,
                ...decoderConfigDebug,
              });

              if (codecDescription) {
                config.description = codecDescription;
                if (videoTrack.codec?.startsWith('avc') && !normalizeCodecDescription(videoTrack.description)) {
                  console.log('[WebCodecsPlayback] AVC decoder description built from avcC.', {
                    trackId: videoTrack.id,
                    descriptionBytes: codecDescription.byteLength,
                  });
                }
              } else if (videoTrack.codec?.startsWith('avc')) {
                console.warn('[WebCodecsPlayback] Missing AVC decoder description for track:', {
                  codec: videoTrack.codec,
                  trackId: videoTrack.id,
                  descriptionType: typeof videoTrack.description,
                  avcCType: typeof videoTrack.avcC,
                  avccType: typeof videoTrack.avcc,
                  hasAvcCData: Boolean((videoTrack.avcC as any)?.data),
                });
              }

              console.log('[WebCodecsPlayback] Checking codec support:', config.codec);
              updateSourceLoading(source.id, { progress: 60, message: 'Initializing hardware decoder...' });
              
              VideoDecoder.isConfigSupported(config).then(({ supported }) => {
                console.log('[WebCodecsPlayback] Codec supported:', supported);
                updateSourceLoading(source.id, { progress: 70, message: 'Starting video stream...' });
                
                if (!supported) {
                  if (!isResolved) {
                    isResolved = true;
                    rejectInner(new Error(`Codec ${videoTrack.codec} not supported`));
                  }
                  return;
                }

                if (config.description || !videoTrack.codec?.startsWith('avc')) {
                  console.log('[WebCodecsPlayback] Configuring decoder...');
                  decoder!.configure(config);
                  decoderConfigured = true;
                  console.log('[WebCodecsPlayback] Decoder configured successfully');
                } else {
                  // Try configuring without description first - some browsers accept this
                  console.warn('[WebCodecsPlayback] AVC description missing, attempting configuration without it...');
                  try {
                    decoder!.configure(config);
                    decoderConfigured = true;
                    console.log('[WebCodecsPlayback] Decoder configured without description (browser accepted)');
                  } catch (configError) {
                    console.warn('[WebCodecsPlayback] Decoder rejected config without description, deferring until SPS/PPS extracted:', configError);
                  }
                }

                // Set up sample processing - this enables extraction for future data
                console.log('[WebCodecsPlayback] Setting extraction options for track ID:', videoTrack.id);
                updateSourceLoading(source.id, { progress: 50, message: 'Configuring extraction...' });
                console.log('[WebCodecsPlayback] Track info:', JSON.stringify({
                  id: videoTrack.id,
                  nb_samples: videoTrack.nb_samples,
                  duration: videoTrack.duration,
                  timescale: videoTrack.timescale,
                }));
                
                // Set extraction options and start demuxing
                // CRITICAL: Must call setExtractionOptions BEFORE start() so MP4Box knows which track to extract
                console.log('[WebCodecsPlayback] Verifying onSamples callback exists:', typeof mp4boxFile.onSamples, mp4boxFile.onSamples ? 'REGISTERED' : 'NOT REGISTERED');
                
                // Pass user parameter as per MP4Box documentation - this is passed back to onSamples
                const extractionUser = { sourceId: source.id };
                mp4boxFile.setExtractionOptions(videoTrack.id, extractionUser, { nbSamples: 100 });
                console.log('[WebCodecsPlayback] Extraction options set for track', videoTrack.id, 'with nbSamples: 100');
                
                // Now start extraction - samples will be extracted from data that continues to stream in
                mp4boxFile.start();
                console.log('[WebCodecsPlayback] start() called - MP4Box will extract samples from streaming data');
                
                // DO NOT flush() here - flush() means "end-of-file" in MP4Box
                // Calling it early (at ~2 MiB) when file is 50 MiB causes MP4Box to finalize without extracting samples
                // Only flush once when stream is complete
                
                const decoderState: DecoderState = {
                  decoder: decoder!,
                  mp4boxFile,
                  videoTrack,
                  sourceId: source.id,
                  videoPath,
                  isInitialized: true,
                };

                decoders.set(cacheKey, decoderState);
                
                // Resolve immediately - decoder configured and MP4Box started
                // Frames will be decoded on-demand during playback via drainPending
                if (!isResolved) {
                  isResolved = true;
                  updateSourceLoading(source.id, {
                    isLoading: false,
                    progress: 100,
                    message: 'Ready'
                  });
                  resolveInner(decoderState);
                }
              }).catch((err: Error) => {
                console.error('[WebCodecsPlayback] isConfigSupported failed:', err);
                if (!isResolved) {
                  isResolved = true;
                  rejectInner(err);
                }
              });
            };

            // Use STREAMING like the W3C WebCodecs example
            // This streams data in small chunks which is required for onSamples to fire
            console.log('[WebCodecsPlayback] Starting streaming fetch...');
            const fileSink = new MP4FileSink();
            // IMPORTANT: Video server requires Range header, so request entire file with Range: bytes=0-
            fetch(videoUrl, {
              headers: {
                'Range': 'bytes=0-'
              }
            })
              .then(response => {
                if (!response.ok) {
                  throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
                }
                if (!response.body) {
                  throw new Error('Response body is null');
                }
                console.log('[WebCodecsPlayback] Streaming video data through pipeTo...');
                // Stream data through WritableStream with small buffer (highWaterMark: 2)
                // This is critical - large chunks cause onSamples to never fire
                return response.body.pipeTo(new WritableStream(fileSink, { highWaterMark: 2 }));
              })
              .then(() => {
                console.log('[WebCodecsPlayback] Streaming complete');
                updateSourceLoading(source.id, { progress: 100, message: 'Ready' });
              })
              .catch((e: Error) => {
                console.error('[WebCodecsPlayback] Streaming error:', e);
                if (!isResolved) {
                  isResolved = true;
                  rejectInner(e);
                }
              });
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

    // Seek MP4Box to the desired time position
    // Note: mp4boxFile.start() is already called during initialization
    try {
      const seekResult = decoderState.mp4boxFile.seek(startTime, true);
      if (seekResult) {
        console.log(`[WebCodecsPlayback] Prefetch seek to ${startTime.toFixed(3)}s, offset: ${seekResult.offset}`);
      }
      
      // CRITICAL: flush() must be called after seek() to trigger onSamples callback
      // MP4Box only calls onSamples when new data is appended OR when flush() is explicitly called
      // Since all data is already loaded, flush() extracts samples at the current seek position
      decoderState.mp4boxFile.flush();
      console.log(`[WebCodecsPlayback] Flushed MP4Box after seek to ${startTime.toFixed(3)}s`);
    } catch (error) {
      console.warn(`[WebCodecsPlayback] Failed to seek/flush for prefetch at ${startTime.toFixed(3)}s:`, error);
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

    if (lastRenderSourceId !== source.id) {
      lastRenderSourceId = source.id;
      lastRenderTime = adjustedTime;
    } else if (!isPlaying.value && Math.abs(adjustedTime - lastRenderTime) > 0.25) {
      clearSourceCache(source);
      resetDecoder(source);
      initializeDecoder(source, adjustedTime);
      lastRenderTime = adjustedTime;
    } else {
      lastRenderTime = adjustedTime;
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
    if (!decoder || decoder.state === 'closed') return;
    
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
    if (!decoder || decoder.state === 'closed') return;
    
    // If nothing decoded yet, drop leading non-keyframes (can't decode without keyframe)
    if (frameCache.size === 0) {
      let dropped = 0;
      while (pendingSamples.length > 0 && !pendingSamples[0].isKey) {
        pendingSamples.shift();
        dropped++;
      }
      if (dropped > 0) {
        console.log(`[WebCodecsPlayback] Dropped ${dropped} non-keyframes at start`);
      }
    }
    
    // Keep draining until we're buffered far enough ahead OR decoder queue is full
    while (pendingSamples.length > 0) {
      const next = pendingSamples[0];
      
      // Stop if this sample is too far ahead
      if (next.timeSec > playheadSec + KEEP_AHEAD_SEC) break;
      
      // Stop if decoder queue is getting full
      if (decoder.decodeQueueSize > 6) break;
      
      pendingSamples.shift();
      decodePendingSample(next, decoder);
    }
  }

  function tick(timestamp: number) {
    try {
      tickCount++;
      rafDebugCounter++;
      const currentSecond = Math.floor(currentTime.value);
      if (currentSecond !== lastLoggedSecond) {
        console.log(`[WebCodecsPlayback] Playing at ${currentSecond}s`);
        lastLoggedSecond = currentSecond;
      }
      
      // Debug log every 60 RAF ticks
      if (rafDebugCounter % 60 === 0 && frameCache.size > 0) {
        const frames = Array.from(frameCache.values()).slice(0, 5);
        const rangeStart = frames[0]?.timestamp?.toFixed(3) ?? 'N/A';
        const rangeEnd = frames[frames.length - 1]?.timestamp?.toFixed(3) ?? 'N/A';
        console.log(`[WebCodecsPlayback] RAF t=${currentTime.value.toFixed(3)}, cache=${frameCache.size}, range=[${rangeStart}→${rangeEnd}]`);
      }
      
      // Debug status every 500ms
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
