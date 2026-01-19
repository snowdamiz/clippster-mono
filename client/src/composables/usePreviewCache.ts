import { ref, computed, watch, type Ref, type ComputedRef } from 'vue';
import { invoke } from '@tauri-apps/api/core';

/**
 * Timeline segment for preview chunk rendering
 * Maps edited timeline time to source video time
 */
export interface TimelineSegment {
  sourceStart: number;
  sourceEnd: number;
  timelineStart: number;
  timelineEnd: number;
}

/**
 * Preview chunk result from backend
 */
export interface PreviewChunkResult {
  chunkIndex: number;
  outputPath: string;
  duration: number;
}

/**
 * Preview manifest result from backend
 */
export interface PreviewManifestResult {
  manifestPath: string;
  streamingUrl: string;
  chunkCount: number;
  totalDuration: number;
}

/**
 * Preview tier type
 */
export type PreviewTier = 'proxy' | 'hq';

/**
 * Chunk render status
 */
export interface ChunkStatus {
  index: number;
  status: 'pending' | 'rendering' | 'complete' | 'error';
  error?: string;
}

/**
 * Preview cache state
 */
export interface PreviewCacheState {
  isReady: boolean;
  isRendering: boolean;
  manifestUrl: string | null;
  chunkStatuses: ChunkStatus[];
  totalChunks: number;
  completedChunks: number;
  error: string | null;
}

/**
 * Audio track for preview rendering
 */
export interface PreviewAudioTrack {
  filePath: string;
  startTime: number;
  endTime: number;
  volume: number;
  isMuted: boolean;
}

/**
 * Text overlay style for preview rendering
 */
export interface PreviewTextOverlay {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  positionX: number;
  positionY: number;
  style: Record<string, unknown>;
  animation: string;
  perRatioConfigs?: Record<string, unknown>;
  previewHeight?: number;
}

/**
 * Sticker overlay for preview rendering
 */
export interface PreviewSticker {
  id: string;
  stickerPath: string;
  stickerType: string;
  startTime: number;
  endTime: number;
  positionX: number;
  positionY: number;
  scale: number;
  rotation: number;
  animation: string;
  perRatioConfigs?: Record<string, unknown>;
}

/**
 * Watermark overlay for preview rendering
 */
export interface PreviewWatermark {
  id: string;
  watermarkPath: string;
  startTime: number;
  endTime: number;
  positionX: number;
  positionY: number;
  scale: number;
  opacity: number;
  perRatioConfigs?: Record<string, unknown>;
}

/**
 * Video filter segment for preview rendering
 */
export interface PreviewFilterSegment {
  startTime: number;
  endTime: number;
  filterType: string;
  settings: Record<string, unknown>;
}

/**
 * Edit data for preview chunk rendering
 */
export interface PreviewChunkEditData {
  textOverlays: PreviewTextOverlay[];
  stickers: PreviewSticker[];
  watermarks: PreviewWatermark[];
  filterSegments: PreviewFilterSegment[];
  audioTracks: PreviewAudioTrack[];
  videoVolumeDb: number;
}

const CHUNK_DURATION = 3.0; // 3 seconds per chunk

/**
 * Composable for managing progressive preview cache (proxy + HQ tiers)
 * 
 * @param clipId - Unique clip identifier
 * @param videoPath - Path to source video file
 * @param segments - Reactive ref to timeline segments
 * @param videoServerPort - Video server port for streaming URLs
 * @param editData - Optional reactive ref to edit data (overlays, effects, audio)
 * @param aspectRatio - Optional aspect ratio for rendering
 * @param isPlaying - Optional ref to playback state (prevents rendering during playback)
 */
export function usePreviewCache(
  clipId: Ref<string>,
  videoPath: Ref<string | null>,
  segments: ComputedRef<TimelineSegment[]>,
  videoServerPort: Ref<number | null>,
  editData?: Ref<PreviewChunkEditData | null>,
  aspectRatio?: Ref<string>,
  isPlaying?: Ref<boolean>
) {
  // Proxy cache state (720p)
  const proxyState = ref<PreviewCacheState>({
    isReady: false,
    isRendering: false,
    manifestUrl: null,
    chunkStatuses: [],
    totalChunks: 0,
    completedChunks: 0,
    error: null,
  });

  // HQ cache state (1080p)
  const hqState = ref<PreviewCacheState>({
    isReady: false,
    isRendering: false,
    manifestUrl: null,
    chunkStatuses: [],
    totalChunks: 0,
    completedChunks: 0,
    error: null,
  });

  // Current playhead position (for prioritizing chunks)
  const currentPlayheadTime = ref(0);

  // Whether HQ rendering has been requested (triggered by fullscreen)
  const hqRequested = ref(false);

  // Render queue abort controller
  let proxyAbortController: AbortController | null = null;
  let hqAbortController: AbortController | null = null;

  // Debounce timer for cache invalidation
  let invalidationTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Calculate total timeline duration from segments
   */
  const totalDuration = computed(() => {
    if (segments.value.length === 0) return 0;
    return Math.max(...segments.value.map(s => s.timelineEnd));
  });

  /**
   * Calculate number of chunks needed
   */
  const chunkCount = computed(() => {
    if (totalDuration.value <= 0) return 0;
    return Math.ceil(totalDuration.value / CHUNK_DURATION);
  });

  /**
   * Generate a cache key based on edit state (for invalidation)
   * Includes segments, overlays, effects, and audio tracks
   */
  const cacheKey = computed(() => {
    const segmentData = segments.value.map(s => 
      `${s.sourceStart.toFixed(3)}-${s.sourceEnd.toFixed(3)}-${s.timelineStart.toFixed(3)}-${s.timelineEnd.toFixed(3)}`
    ).join('|');
    
    // Include edit data in cache key for invalidation when overlays/effects change
    let editDataKey = '';
    if (editData?.value) {
      const data = editData.value;
      // Hash text overlays
      const textKey = data.textOverlays.map(t => 
        `${t.id}:${t.startTime.toFixed(2)}-${t.endTime.toFixed(2)}:${t.positionX.toFixed(1)},${t.positionY.toFixed(1)}:${t.text.substring(0, 20)}`
      ).join(';');
      // Hash stickers
      const stickerKey = data.stickers.map(s => 
        `${s.id}:${s.startTime.toFixed(2)}-${s.endTime.toFixed(2)}:${s.positionX.toFixed(1)},${s.positionY.toFixed(1)}:${s.scale.toFixed(2)}`
      ).join(';');
      // Hash watermarks
      const watermarkKey = data.watermarks.map(w => 
        `${w.id}:${w.startTime.toFixed(2)}-${w.endTime.toFixed(2)}:${w.positionX.toFixed(1)},${w.positionY.toFixed(1)}:${w.scale.toFixed(2)}:${w.opacity.toFixed(2)}`
      ).join(';');
      // Hash filter segments
      const filterKey = data.filterSegments.map(f => 
        `${f.startTime.toFixed(2)}-${f.endTime.toFixed(2)}:${f.filterType}`
      ).join(';');
      // Hash audio tracks
      const audioKey = data.audioTracks.map(a => 
        `${a.startTime.toFixed(2)}-${a.endTime.toFixed(2)}:${a.volume.toFixed(2)}:${a.isMuted}`
      ).join(';');
      
      editDataKey = `|text:${textKey}|stk:${stickerKey}|wm:${watermarkKey}|flt:${filterKey}|aud:${audioKey}`;
    }
    
    return `${clipId.value}:${segmentData}${editDataKey}`;
  });

  /**
   * Get chunk indices sorted by priority (nearest to playhead first)
   */
  function getChunkPriority(playheadTime: number, totalChunks: number): number[] {
    if (totalChunks === 0) return [];

    const currentChunk = Math.floor(playheadTime / CHUNK_DURATION);
    const indices: number[] = [];

    // Start with current chunk, then alternate forward/backward
    for (let offset = 0; offset < totalChunks; offset++) {
      const forward = currentChunk + offset;
      const backward = currentChunk - offset - 1;

      if (forward < totalChunks && !indices.includes(forward)) {
        indices.push(forward);
      }
      if (backward >= 0 && !indices.includes(backward)) {
        indices.push(backward);
      }
    }

    return indices;
  }

  /**
   * Render a single chunk
   */
  async function renderChunk(
    tier: PreviewTier,
    chunkIndex: number,
    signal: AbortSignal
  ): Promise<PreviewChunkResult | null> {
    if (signal.aborted) return null;

    const chunkStart = chunkIndex * CHUNK_DURATION;
    const chunkDuration = Math.min(CHUNK_DURATION, totalDuration.value - chunkStart);

    if (chunkDuration <= 0) return null;

    try {
      const result = await invoke<PreviewChunkResult>('generate_preview_chunk', {
        clipId: clipId.value,
        videoPath: videoPath.value,
        tier,
        chunkIndex,
        chunkStart,
        chunkDuration,
        segments: segments.value,
        editData: editData?.value ?? null,
        aspectRatio: aspectRatio?.value ?? null,
      });

      return result;
    } catch (error) {
      if (signal.aborted) return null;
      throw error;
    }
  }

  /**
   * Write HLS manifest for completed chunks
   */
  async function writeManifest(
    tier: PreviewTier,
    chunks: PreviewChunkResult[]
  ): Promise<PreviewManifestResult> {
    return await invoke<PreviewManifestResult>('write_preview_manifest', {
      clipId: clipId.value,
      tier,
      chunks,
    });
  }

  function buildHlsManifestUrl(manifestPath: string, port: number): string {
    const lastSlashIndex = Math.max(manifestPath.lastIndexOf('/'), manifestPath.lastIndexOf('\\'));
    const dirPath = lastSlashIndex >= 0 ? manifestPath.slice(0, lastSlashIndex) : manifestPath;
    const encodedDir = btoa(unescape(encodeURIComponent(dirPath)));
    return `http://localhost:${port}/hls/${encodedDir}/playlist.m3u8`;
  }

  /**
   * Render all chunks for a tier with progressive updates
   */
  async function renderTier(tier: PreviewTier): Promise<void> {
    const state = tier === 'proxy' ? proxyState : hqState;
    const abortController = new AbortController();

    if (tier === 'proxy') {
      proxyAbortController?.abort();
      proxyAbortController = abortController;
    } else {
      hqAbortController?.abort();
      hqAbortController = abortController;
    }

    const signal = abortController.signal;

    // Skip if no segments or video path
    if (!videoPath.value || segments.value.length === 0) {
      state.value = {
        isReady: false,
        isRendering: false,
        manifestUrl: null,
        chunkStatuses: [],
        totalChunks: 0,
        completedChunks: 0,
        error: null,
      };
      return;
    }

    const numChunks = chunkCount.value;
    if (numChunks === 0) return;

    // Initialize state
    state.value = {
      isReady: false,
      isRendering: true,
      manifestUrl: null,
      chunkStatuses: Array.from({ length: numChunks }, (_, i) => ({
        index: i,
        status: 'pending' as const,
      })),
      totalChunks: numChunks,
      completedChunks: 0,
      error: null,
    };

    const completedChunks: PreviewChunkResult[] = [];
    const chunkOrder = getChunkPriority(currentPlayheadTime.value, numChunks);

    console.log(`[usePreviewCache] Starting ${tier} render: ${numChunks} chunks, priority order:`, chunkOrder.slice(0, 5));

    for (const chunkIndex of chunkOrder) {
      if (signal.aborted) {
        console.log(`[usePreviewCache] ${tier} render aborted`);
        return;
      }

      // Update chunk status to rendering
      state.value.chunkStatuses[chunkIndex] = {
        index: chunkIndex,
        status: 'rendering',
      };

      try {
        const result = await renderChunk(tier, chunkIndex, signal);

        if (signal.aborted) return;

        if (result) {
          completedChunks.push(result);
          state.value.chunkStatuses[chunkIndex] = {
            index: chunkIndex,
            status: 'complete',
          };
          state.value.completedChunks = completedChunks.length;

          // Write manifest after each chunk for progressive playback
          // Only write if we have at least the first chunk or enough chunks
          if (completedChunks.length >= 1) {
            try {
              const manifest = await writeManifest(tier, completedChunks);
              
              // Convert file:// URL to HTTP streaming URL
              if (videoServerPort.value) {
                state.value.manifestUrl = buildHlsManifestUrl(manifest.manifestPath, videoServerPort.value);
              } else {
                state.value.manifestUrl = manifest.streamingUrl;
              }

              // Mark as ready as soon as we have the first chunk
              // This enables immediate playback while remaining chunks render in background
              if (completedChunks.length >= 1) {
                state.value.isReady = true;
              }
            } catch (manifestError) {
              console.warn(`[usePreviewCache] Failed to write ${tier} manifest:`, manifestError);
            }
          }
        }
      } catch (error) {
        if (signal.aborted) return;

        console.error(`[usePreviewCache] Failed to render ${tier} chunk ${chunkIndex}:`, error);
        state.value.chunkStatuses[chunkIndex] = {
          index: chunkIndex,
          status: 'error',
          error: String(error),
        };
      }
    }

    // Final state update
    if (!signal.aborted) {
      state.value.isRendering = false;
      state.value.isReady = completedChunks.length > 0;
      console.log(`[usePreviewCache] ${tier} render complete: ${completedChunks.length}/${numChunks} chunks`);
    }
  }

  /**
   * Start proxy cache rendering
   */
  async function startProxyRender(): Promise<void> {
    // Don't render during playback to avoid decoder contention
    if (isPlaying?.value) {
      console.log('[usePreviewCache] Skipping proxy render - playback active');
      return;
    }
    console.log('[usePreviewCache] Starting proxy render');
    await renderTier('proxy');
  }

  /**
   * Start HQ cache rendering (triggered by fullscreen)
   */
  async function startHqRender(): Promise<void> {
    // Don't render during playback to avoid decoder contention
    if (isPlaying?.value) {
      console.log('[usePreviewCache] Skipping HQ render - playback active');
      return;
    }
    if (hqState.value.isReady || hqState.value.isRendering) {
      console.log('[usePreviewCache] HQ already ready or rendering, skipping');
      return;
    }

    hqRequested.value = true;
    console.log('[usePreviewCache] Starting HQ render');
    await renderTier('hq');
  }

  /**
   * Invalidate cache and trigger re-render
   */
  function invalidateCache(): void {
    console.log('[usePreviewCache] Cache invalidated');

    // Abort any ongoing renders
    proxyAbortController?.abort();
    hqAbortController?.abort();

    // Reset states
    proxyState.value = {
      isReady: false,
      isRendering: false,
      manifestUrl: null,
      chunkStatuses: [],
      totalChunks: 0,
      completedChunks: 0,
      error: null,
    };

    hqState.value = {
      isReady: false,
      isRendering: false,
      manifestUrl: null,
      chunkStatuses: [],
      totalChunks: 0,
      completedChunks: 0,
      error: null,
    };

    // Debounce the re-render
    if (invalidationTimer) {
      clearTimeout(invalidationTimer);
    }

    invalidationTimer = setTimeout(() => {
      startProxyRender();
      // Re-render HQ if it was previously requested
      if (hqRequested.value) {
        startHqRender();
      }
    }, 500);
  }

  /**
   * Update playhead position (for chunk prioritization)
   */
  function updatePlayhead(time: number): void {
    currentPlayheadTime.value = time;
  }

  /**
   * Clean up cache files
   */
  async function cleanup(): Promise<void> {
    console.log('[usePreviewCache] Cleaning up cache');

    // Abort any ongoing renders
    proxyAbortController?.abort();
    hqAbortController?.abort();

    if (invalidationTimer) {
      clearTimeout(invalidationTimer);
      invalidationTimer = null;
    }

    try {
      await invoke('delete_preview_cache', { clipId: clipId.value });
    } catch (error) {
      console.warn('[usePreviewCache] Failed to delete cache:', error);
    }

    // Reset states
    proxyState.value = {
      isReady: false,
      isRendering: false,
      manifestUrl: null,
      chunkStatuses: [],
      totalChunks: 0,
      completedChunks: 0,
      error: null,
    };

    hqState.value = {
      isReady: false,
      isRendering: false,
      manifestUrl: null,
      chunkStatuses: [],
      totalChunks: 0,
      completedChunks: 0,
      error: null,
    };

    hqRequested.value = false;
  }

  /**
   * Get the effective manifest URL (HQ if ready, otherwise proxy)
   * Only returns URL when the preview is actually ready for playback
   */
  const effectiveManifestUrl = computed(() => {
    // Use HQ if ready and requested
    if (hqRequested.value && hqState.value.isReady && hqState.value.manifestUrl) {
      return hqState.value.manifestUrl;
    }
    // Fall back to proxy only if it's ready
    if (proxyState.value.isReady && proxyState.value.manifestUrl) {
      return proxyState.value.manifestUrl;
    }
    // Not ready yet - return null to fall back to legacy preview
    return null;
  });

  /**
   * Whether the preview is ready for playback
   */
  const isPreviewReady = computed(() => {
    return proxyState.value.isReady || hqState.value.isReady;
  });

  /**
   * Whether any rendering is in progress
   */
  const isRendering = computed(() => {
    return proxyState.value.isRendering || hqState.value.isRendering;
  });

  /**
   * Overall progress (0-100)
   */
  const renderProgress = computed(() => {
    const proxyProgress = proxyState.value.totalChunks > 0
      ? (proxyState.value.completedChunks / proxyState.value.totalChunks) * 100
      : 0;
    return Math.round(proxyProgress);
  });

  // Watch for segment changes to invalidate cache
  let previousCacheKey = '';
  watch(cacheKey, (newKey) => {
    if (newKey !== previousCacheKey && previousCacheKey !== '') {
      invalidateCache();
    }
    previousCacheKey = newKey;
  });

  return {
    // State
    proxyState,
    hqState,
    effectiveManifestUrl,
    isPreviewReady,
    isRendering,
    renderProgress,
    totalDuration,
    chunkCount,

    // Actions
    startProxyRender,
    startHqRender,
    invalidateCache,
    updatePlayhead,
    cleanup,
  };
}
