import { ref, computed, type Ref, type ComputedRef } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type { VideoSource } from './useVideoSourceTime';

/**
 * Timeline data interface (matches playback engine timeline state)
 */
export interface TimelineData {
  duration: number;
  videoSources: VideoSource[];
  audioTracks?: any[];
}

/**
 * Options for useVideoUrlBuilder
 */
export interface VideoUrlBuilderOptions {
  /** Function to get current timeline state */
  getTimeline: () => TimelineData | null;
}

/**
 * Return type for useVideoUrlBuilder
 */
export interface VideoUrlBuilderReturn {
  /** Video server port */
  serverPort: Ref<number | null>;
  /** Initialize the video server connection */
  initServer: () => Promise<void>;
  /** Active video URL (computed) */
  activeVideoUrl: ComputedRef<string | null>;
  /** Video source path for waveform (local file path) */
  videoSourcePath: ComputedRef<string | null>;
  /** Video sources array */
  videoSources: ComputedRef<VideoSource[]>;
  /** Video content duration (max end time of video sources) */
  videoContentDuration: ComputedRef<number>;
}

/**
 * useVideoUrlBuilder - Video URL generation and server management
 *
 * Extracts video URL generation logic from ClipEditorDialog (lines 196-286).
 * Handles:
 * - Video server port initialization
 * - HLS vs direct video URL selection
 * - Video source path for waveform
 * - Video content duration calculation
 *
 * Usage:
 * ```ts
 * const {
 *   serverPort,
 *   initServer,
 *   activeVideoUrl,
 *   videoSourcePath,
 *   videoSources,
 *   videoContentDuration,
 * } = useVideoUrlBuilder({
 *   getTimeline: () => playbackEngine.getTimeline(),
 * });
 *
 * onMounted(async () => {
 *   await initServer();
 * });
 * ```
 */
export function useVideoUrlBuilder(
  options: VideoUrlBuilderOptions
): VideoUrlBuilderReturn {
  const { getTimeline } = options;

  const serverPort = ref<number | null>(null);

  /**
   * Initialize video server connection
   */
  async function initServer(): Promise<void> {
    try {
      serverPort.value = await invoke<number>('get_video_server_port');
      console.log('[useVideoUrlBuilder] Video server port:', serverPort.value);
    } catch (error) {
      console.error('[useVideoUrlBuilder] Failed to get video server port:', error);
    }
  }

  /**
   * Build video URL from file path
   */
  function buildVideoUrl(filePath: string): string {
    if (!serverPort.value) return '';

    const encodedPath = btoa(unescape(encodeURIComponent(filePath)));

    // Check if this is a .ts file (MPEG-TS stream) - needs HLS wrapper
    const isTsFile = filePath.toLowerCase().endsWith('.ts');

    return isTsFile
      ? `http://localhost:${serverPort.value}/ts-hls/${encodedPath}/playlist.m3u8`
      : `http://localhost:${serverPort.value}/video/${encodedPath}`;
  }

  /**
   * Active video URL from timeline
   */
  const activeVideoUrl = computed((): string | null => {
    const timeline = getTimeline();

    if (!serverPort.value) {
      return null;
    }

    if (!timeline || timeline.videoSources.length === 0) {
      return null;
    }

    // Always use the first source for now (single-source clips)
    const firstSource = timeline.videoSources[0];
    if (!firstSource || !firstSource.file_path) {
      return null;
    }

    const url = buildVideoUrl(firstSource.file_path);
    const isTsFile = firstSource.file_path.toLowerCase().endsWith('.ts');

    console.log(
      '[useVideoUrlBuilder] Active video URL:',
      url,
      isTsFile ? '(HLS)' : '(Direct)'
    );
    return url;
  });

  /**
   * Video source path for waveform (local file path, not HTTP URL)
   */
  const videoSourcePath = computed((): string | null => {
    const timeline = getTimeline();

    if (!timeline || timeline.videoSources.length === 0) {
      return null;
    }

    const firstSource = timeline.videoSources[0];
    return firstSource?.file_path || null;
  });

  /**
   * Video sources for timeline rendering
   */
  const videoSources = computed((): VideoSource[] => {
    const timeline = getTimeline();
    return timeline?.videoSources || [];
  });

  /**
   * Calculate the actual video content duration (max end time of video sources)
   */
  const videoContentDuration = computed((): number => {
    const timeline = getTimeline();
    if (!timeline || timeline.videoSources.length === 0) {
      return 0;
    }

    // Get the maximum end time of all video sources
    return Math.max(...timeline.videoSources.map((s) => s.end_time));
  });

  return {
    serverPort,
    initServer,
    activeVideoUrl,
    videoSourcePath,
    videoSources,
    videoContentDuration,
  };
}
