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
  /** Current timeline time (for selecting active video source) */
  currentTime: Ref<number>;
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
 * - Dynamic video source selection based on timeline position
 * - Video source path for waveform
 * - Video content duration calculation
 *
 * The activeVideoUrl is computed reactively based on currentTime, so when the
 * timeline position changes to a different video source, the URL automatically
 * updates to point to the correct video file.
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
 *   currentTime: playbackEngine.currentTime,
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
  const { getTimeline, currentTime } = options;

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
   * Find which video source contains the given timeline time
   */
  function findSourceAtTime(timelineTime: number, sources: VideoSource[]): VideoSource | null {
    for (const source of sources) {
      if (timelineTime >= source.start_time && timelineTime < source.end_time) {
        return source;
      }
    }
    // If past all sources, return the last source
    return sources.length > 0 ? sources[sources.length - 1] : null;
  }

  /**
   * Active video URL from timeline - dynamically selects source based on current time
   */
  const activeVideoUrl = computed((): string | null => {
    const timeline = getTimeline();

    if (!serverPort.value) {
      return null;
    }

    if (!timeline || timeline.videoSources.length === 0) {
      return null;
    }

    // Find the source at the current timeline position
    const activeSource = findSourceAtTime(currentTime.value, timeline.videoSources);
    if (!activeSource || !activeSource.file_path) {
      return null;
    }

    const url = buildVideoUrl(activeSource.file_path);
    const isTsFile = activeSource.file_path.toLowerCase().endsWith('.ts');

    console.log(
      '[useVideoUrlBuilder] Active video URL:',
      url,
      isTsFile ? '(HLS)' : '(Direct)',
      `at timeline ${currentTime.value.toFixed(2)}s`
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
