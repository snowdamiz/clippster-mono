import { type Ref, type ComputedRef } from 'vue';
import type { FullVideoEditorEdit } from '@/services/database/video-editor-edits';

/**
 * Video source data for timeline
 */
export interface TimelineVideoSource {
  id: string;
  file_path: string;
  start_time: number;
  end_time: number;
  trim_start: number;
  trim_end: number | null;
  original_duration: number;
  order_index: number;
}

/**
 * Audio track data for timeline
 */
export interface TimelineAudioTrack {
  id: string;
  filePath: string;
  startTime: number;
  endTime: number;
  sourceStartTime: number;
  volume: number;
  isMuted: boolean;
  fadeInDuration: number;
  fadeOutDuration: number;
}

/**
 * Timeline data structure for playback engine
 */
export interface TimelineData {
  duration: number;
  videoSources: TimelineVideoSource[];
  audioTracks: TimelineAudioTrack[];
}

/**
 * Playback engine interface (subset of what we need)
 */
export interface PlaybackEngineInterface {
  setTimeline: (data: TimelineData) => void;
}

/**
 * Duration calculator function type
 */
export type DurationCalculatorFn = (
  videoSources: any[],
  audioTracks: any[],
  textOverlays: any[],
  stickers: any[],
  watermarks: any[]
) => number;

/**
 * Options for useTimelineReload
 */
export interface TimelineReloadOptions {
  /** Reference to the current project ID */
  projectId: Ref<string | null>;
  /** Reference to the current editor edit data */
  editorEdit: Ref<FullVideoEditorEdit | null>;
  /** Playback engine instance */
  playbackEngine: PlaybackEngineInterface;
  /** Function to calculate max duration from all tracks */
  calculateMaxDuration: DurationCalculatorFn;
}

/**
 * Return type for useTimelineReload
 */
export interface TimelineReloadReturn {
  /** Reload timeline with updated data from database */
  reloadTimeline: () => Promise<void>;
}

/**
 * useTimelineReload - Extract timeline reload logic from ClipEditorDialog
 *
 * This composable handles:
 * - Fetching updated project data from database
 * - Calculating timeline duration from all tracks
 * - Updating playback engine with new timeline data
 *
 * Extracted from ClipEditorDialog.vue reloadTimeline():
 * - getVideoEditorProjectWithSources call
 * - Duration recalculation
 * - PlaybackEngine.setTimeline call
 *
 * Usage:
 * ```ts
 * const projectId = ref<string | null>('project-123');
 * const editorEdit = ref<FullVideoEditorEdit | null>(null);
 * const playbackEngine = usePlaybackEngine();
 * const { calculateMaxDuration } = useDurationCalculator();
 *
 * const { reloadTimeline } = useTimelineReload({
 *   projectId,
 *   editorEdit,
 *   playbackEngine,
 *   calculateMaxDuration,
 * });
 *
 * // After adding/removing tracks
 * await reloadTimeline();
 * ```
 */
export function useTimelineReload(options: TimelineReloadOptions): TimelineReloadReturn {
  const { projectId, editorEdit, playbackEngine, calculateMaxDuration } = options;

  /**
   * Reload timeline with updated data from database
   * Fetches latest project sources and recalculates duration
   */
  async function reloadTimeline(): Promise<void> {
    if (!projectId.value) {
      console.warn('[useTimelineReload] No project ID available');
      return;
    }

    try {
      const { getVideoEditorProjectWithSources } = await import(
        '@/services/database/video-editor-projects'
      );

      const updatedProjectData = await getVideoEditorProjectWithSources(projectId.value);

      if (!updatedProjectData) {
        console.warn('[useTimelineReload] No project data found');
        return;
      }

      // Get audio tracks from current editor edit
      const audioTracksData = editorEdit.value?.audioTracks || [];

      // Calculate actual duration based on all tracks
      const maxDuration = calculateMaxDuration(
        updatedProjectData.sources,
        audioTracksData,
        editorEdit.value?.textOverlays || [],
        editorEdit.value?.stickers || [],
        editorEdit.value?.watermarks || []
      );

      // Transform video sources for playback engine
      const videoSources: TimelineVideoSource[] = updatedProjectData.sources.map((s) => ({
        id: s.id,
        file_path: s.source_path,
        start_time: s.start_time,
        end_time: s.end_time,
        trim_start: s.trim_start,
        trim_end: s.trim_end,
        original_duration: s.source_duration || (s.end_time - s.start_time),
        order_index: s.order_index,
      }));

      // Transform audio tracks for playback engine
      const audioTracks: TimelineAudioTrack[] = audioTracksData.map((track) => ({
        id: track.id,
        filePath: track.file_path,
        startTime: track.start_time,
        endTime: track.end_time,
        sourceStartTime: track.source_start_time,
        volume: track.volume,
        isMuted: track.is_muted === 1,
        fadeInDuration: track.fade_in,
        fadeOutDuration: track.fade_out,
      }));

      // Update playback engine with new timeline
      playbackEngine.setTimeline({
        duration: maxDuration,
        videoSources,
        audioTracks,
      });

      console.log('[useTimelineReload] Timeline reloaded:', {
        duration: maxDuration,
        videoSources: videoSources.length,
        audioTracks: audioTracks.length,
      });
    } catch (error) {
      console.error('[useTimelineReload] Failed to reload timeline:', error);
      throw error;
    }
  }

  return {
    reloadTimeline,
  };
}
