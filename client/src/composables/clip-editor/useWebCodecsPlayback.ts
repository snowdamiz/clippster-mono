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
  let cacheDebugCounter = 0;
  
  // Rendering state
  let rafId: number | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let lastRenderedFrame: VideoFrame | null = null;
  let lastRenderTime = 0;
  let lastRenderSourceId: string | null = null;
  
  // Performance metrics
  const isInitialized = ref(false);
  const renderFps = ref(0);
  const cacheSize = ref(0);
  let fpsFrameCount = 0;
  let fpsLastTime = performance.now();

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
        let totalSize: number | null = null;
        let nextOffset = 0;
        let streamingStarted = false;
        let initialBuffer: ArrayBuffer | null = null;
        let hasKeyframe = false;
        let isReady = false;
        let moovFetchAttempted = false;

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
          isReady = true;
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
          
          VideoDecoder.isConfigSupported(config).then(({ supported }) => {
            console.log('[WebCodecsPlayback] Codec supported:', supported);
            
            if (!supported) {
              if (!isResolved) {
                isResolved = true;
                reject(new Error(`Codec ${videoTrack.codec} not supported`));
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
            const initialSeekTime = Math.max(0, startTime ?? 0);
            const seekResult = mp4boxFile.seek(initialSeekTime, true);
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
            if (!decoderConfigured && videoTrack?.codec?.startsWith('avc') && sample.is_sync) {
              const extracted = extractAvcParameterSets(sample.data as Uint8Array);
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
                    codec: videoTrack.codec,
                    codedWidth: videoTrack.video?.width || 1920,
                    codedHeight: videoTrack.video?.height || 1080,
                    hardwareAcceleration: 'prefer-hardware',
                    description,
                  };
                  decoder.configure(config);
                  decoderConfigured = true;
                  decoderConfigDebug = {
                    codec: videoTrack.codec,
                    descriptionBytes: description.byteLength,
                    avcCBytes: undefined,
                    spsCount: extracted.sps.length,
                    ppsCount: extracted.pps.length,
                  };
                  console.log('[WebCodecsPlayback] Decoder configured from keyframe SPS/PPS.', {
                    trackId: videoTrack.id,
                    descriptionBytes: description.byteLength,
                    spsCount: extracted.sps.length,
                    ppsCount: extracted.pps.length,
                  });
                }
              } else {
                console.warn('[WebCodecsPlayback] Failed to extract SPS/PPS from keyframe sample.', {
                  trackId: videoTrack.id,
                  sampleSize: sample.data?.byteLength,
                });
              }
            }
            if (!decoderConfigured && videoTrack?.codec?.startsWith('avc')) {
              continue;
            }
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
                if (!decodeErrorLogged) {
                  decodeErrorLogged = true;
                  const errorMessage = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
                  const configMessage = decoderConfigDebug ? JSON.stringify(decoderConfigDebug) : 'null';
                  const sampleMessage = JSON.stringify({
                    isSync: sample.is_sync,
                    cts: sample.cts,
                    duration: sample.duration,
                    size: sample.data?.byteLength,
                  });
                  console.error(
                    `[WebCodecsPlayback] Decoder decode failed: ${errorMessage} | config=${configMessage} | sample=${sampleMessage}`,
                  );
                }
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

            if (!isReady && totalSize !== null && !moovFetchAttempted) {
              moovFetchAttempted = true;
              const tailSize = Math.min(4 * 1024 * 1024, totalSize);
              const tailStart = Math.max(0, totalSize - tailSize);
              if (tailStart + tailSize > nextOffset) {
                console.log('[WebCodecsPlayback] MP4Box not ready after init chunk, fetching tail range for moov:', {
                  tailStart,
                  tailEnd: totalSize - 1,
                  tailSize,
                });
                fetchRange(tailStart, totalSize - 1)
                  .then(({ data: tailData }) => {
                    appendBuffer(tailData, tailStart);
                    mp4boxFile.flush();
                    console.log('[WebCodecsPlayback] Tail range appended for moov, MP4Box flushed');
                  })
                  .catch((e) => {
                    console.error('[WebCodecsPlayback] Failed to fetch tail range for moov:', e);
                  });
              } else {
                console.log('[WebCodecsPlayback] Skipping tail range fetch; tail already covered by initial chunk.', {
                  tailStart,
                  tailSize,
                  nextOffset,
                });
              }
            } else if (!moovFetchAttempted) {
              console.log('[WebCodecsPlayback] Tail range fetch not attempted:', {
                isReady,
                totalSize,
                nextOffset,
              });
            }

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
    } else {
      const timeJump = Math.abs(adjustedTime - lastRenderTime);
      if (timeJump > 0.25) {
        clearSourceCache(source);
        resetDecoder(source);
        initializeDecoder(source, adjustedTime);
      }
      lastRenderTime = adjustedTime;
    }

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
      if (closestFrame && closestDelta <= 0.05) {
        cachedFrame = closestFrame;
      } else if (latestFrame) {
        cachedFrame = latestFrame;
      }
    }

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
      if (cacheDebugCounter % 60 === 0) {
        const sampleFrames = Array.from(frameCache.values())
          .filter((frame) => frame.sourceId === source.id)
          .slice(0, 3)
          .map((frame) => Number(frame.timestamp.toFixed(3)));
        console.warn('[WebCodecsPlayback] No cached frame for time, debug:', {
          sourceId: source.id,
          adjustedTime: Number(adjustedTime.toFixed(3)),
          cacheSize: frameCache.size,
          sampleFrames,
        });
      }
      cacheDebugCounter += 1;
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

  function clearSourceCache(source: VideoSource) {
    for (const [key, cached] of frameCache.entries()) {
      if (cached.sourceId === source.id) {
        cached.frame.close();
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
