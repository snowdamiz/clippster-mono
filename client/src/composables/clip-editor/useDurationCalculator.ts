import type {
  VideoEditorAudioTrackRecord,
  VideoEditorTextOverlayRecord,
  VideoEditorStickerRecord,
  VideoEditorWatermarkRecord,
} from '@/services/database/video-editor-edits';

/**
 * Video source data for duration calculation
 */
export interface VideoSourceData {
  start_time: number;
  end_time: number;
}

/**
 * Project data with sources for duration calculation
 */
export interface ProjectWithSources {
  sources: VideoSourceData[];
}

/**
 * Return type for useDurationCalculator
 */
export interface DurationCalculatorReturn {
  /**
   * Calculate the maximum duration from all timeline tracks
   *
   * @param videoSources - Video source data (from project sources)
   * @param audioTracks - Audio track records
   * @param textOverlays - Text overlay records
   * @param stickers - Sticker records
   * @param watermarks - Watermark records
   * @returns The maximum end time across all tracks
   */
  calculateMaxDuration: (
    videoSources: VideoSourceData[],
    audioTracks: VideoEditorAudioTrackRecord[],
    textOverlays?: VideoEditorTextOverlayRecord[],
    stickers?: VideoEditorStickerRecord[],
    watermarks?: VideoEditorWatermarkRecord[]
  ) => number;

  /**
   * Calculate duration from project data and editor edit
   * Convenience method that accepts the common data structures
   */
  calculateDurationFromProject: (
    projectData: ProjectWithSources | null,
    audioTracks: VideoEditorAudioTrackRecord[],
    textOverlays?: VideoEditorTextOverlayRecord[],
    stickers?: VideoEditorStickerRecord[],
    watermarks?: VideoEditorWatermarkRecord[]
  ) => number;
}

/**
 * useDurationCalculator - Calculate timeline duration from all tracks
 *
 * Extracts the duration calculation logic from ClipEditorDialog (lines 561-595)
 *
 * The total timeline duration is determined by the maximum end time across:
 * - Video sources (primary content)
 * - Audio tracks (music may extend beyond video)
 * - Text overlays
 * - Stickers
 * - Watermarks
 *
 * Usage:
 * ```ts
 * const { calculateMaxDuration, calculateDurationFromProject } = useDurationCalculator();
 *
 * // Calculate from raw data
 * const duration = calculateMaxDuration(
 *   projectData.sources,
 *   editorEdit.audioTracks,
 *   editorEdit.textOverlays,
 *   editorEdit.stickers,
 *   editorEdit.watermarks
 * );
 *
 * // Or use the convenience method
 * const duration = calculateDurationFromProject(
 *   projectData,
 *   editorEdit.audioTracks,
 *   editorEdit.textOverlays
 * );
 * ```
 */
export function useDurationCalculator(): DurationCalculatorReturn {
  /**
   * Get maximum end time from an array of items with end_time property
   */
  function getMaxEndTime<T extends { end_time: number }>(items: T[]): number {
    if (!items || items.length === 0) return 0;
    return Math.max(...items.map((item) => item.end_time));
  }

  /**
   * Calculate the maximum duration from all timeline tracks
   */
  function calculateMaxDuration(
    videoSources: VideoSourceData[],
    audioTracks: VideoEditorAudioTrackRecord[],
    textOverlays: VideoEditorTextOverlayRecord[] = [],
    stickers: VideoEditorStickerRecord[] = [],
    watermarks: VideoEditorWatermarkRecord[] = []
  ): number {
    let maxDuration = 0;

    // Check video sources
    if (videoSources && videoSources.length > 0) {
      const videoEnd = getMaxEndTime(videoSources);
      maxDuration = Math.max(maxDuration, videoEnd);
    }

    // Check audio tracks
    if (audioTracks && audioTracks.length > 0) {
      const audioEnd = getMaxEndTime(audioTracks);
      maxDuration = Math.max(maxDuration, audioEnd);
    }

    // Check text overlays
    if (textOverlays && textOverlays.length > 0) {
      const textEnd = getMaxEndTime(textOverlays);
      maxDuration = Math.max(maxDuration, textEnd);
    }

    // Check stickers
    if (stickers && stickers.length > 0) {
      const stickerEnd = getMaxEndTime(stickers);
      maxDuration = Math.max(maxDuration, stickerEnd);
    }

    // Check watermarks
    if (watermarks && watermarks.length > 0) {
      const watermarkEnd = getMaxEndTime(watermarks);
      maxDuration = Math.max(maxDuration, watermarkEnd);
    }

    return maxDuration;
  }

  /**
   * Calculate duration from project data and editor edit
   */
  function calculateDurationFromProject(
    projectData: ProjectWithSources | null,
    audioTracks: VideoEditorAudioTrackRecord[],
    textOverlays: VideoEditorTextOverlayRecord[] = [],
    stickers: VideoEditorStickerRecord[] = [],
    watermarks: VideoEditorWatermarkRecord[] = []
  ): number {
    const videoSources = projectData?.sources || [];
    return calculateMaxDuration(
      videoSources,
      audioTracks,
      textOverlays,
      stickers,
      watermarks
    );
  }

  return {
    calculateMaxDuration,
    calculateDurationFromProject,
  };
}
