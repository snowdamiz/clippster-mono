import { computed, type Ref, type ComputedRef } from 'vue';
import type {
  FullVideoEditorEdit,
  VideoEditorAudioTrackRecord,
  VideoEditorTextOverlayRecord,
  VideoEditorStickerRecord,
  VideoEditorWatermarkRecord,
  VideoEditorEffectRecord,
} from '@/services/database/video-editor-edits';

/**
 * Grouped audio tracks by track_order
 */
export interface GroupedAudioTrack {
  order: number;
  segments: VideoEditorAudioTrackRecord[];
}

/**
 * Return type for useTimelineItems
 */
export interface TimelineItemsReturn {
  /** All audio tracks */
  audioTracks: ComputedRef<VideoEditorAudioTrackRecord[]>;
  /** All text overlays */
  textOverlays: ComputedRef<VideoEditorTextOverlayRecord[]>;
  /** All stickers */
  stickers: ComputedRef<VideoEditorStickerRecord[]>;
  /** All watermarks */
  watermarks: ComputedRef<VideoEditorWatermarkRecord[]>;
  /** All effects */
  effects: ComputedRef<VideoEditorEffectRecord[]>;
  /** Audio tracks grouped by track_order for timeline display */
  groupedAudioTracks: ComputedRef<GroupedAudioTrack[]>;

  /** Get text overlays active at a specific time */
  getActiveTextOverlays: (time: number) => VideoEditorTextOverlayRecord[];
  /** Get stickers active at a specific time */
  getActiveStickers: (time: number) => VideoEditorStickerRecord[];
  /** Get watermarks active at a specific time */
  getActiveWatermarks: (time: number) => VideoEditorWatermarkRecord[];
  /** Get effects active at a specific time */
  getActiveEffects: (time: number) => VideoEditorEffectRecord[];
  /** Get the first active watermark at a specific time (typically only one is shown) */
  getActiveWatermark: (time: number) => VideoEditorWatermarkRecord | null;
}

/**
 * useTimelineItems - Provide reactive access to timeline items with time-based filtering
 *
 * Extracts duplicated logic from:
 * - ClipEditorPreview (activeTextOverlays, activeStickers, activeWatermark - lines 274-296)
 * - ClipEditorTimeline (audioTracks, textOverlays, stickers, watermarks, groupedAudioTracks - lines 373-400)
 *
 * Usage:
 * ```ts
 * const {
 *   audioTracks,
 *   textOverlays,
 *   getActiveTextOverlays,
 *   getActiveStickers,
 *   groupedAudioTracks
 * } = useTimelineItems(editorEdit);
 *
 * // Get items active at current time
 * const activeTexts = getActiveTextOverlays(currentTime);
 *
 * // Use in computed for reactive updates
 * const currentOverlays = computed(() => getActiveTextOverlays(currentTime.value));
 * ```
 */
export function useTimelineItems(
  editorEdit: Ref<FullVideoEditorEdit | null>
): TimelineItemsReturn {
  // Base computed properties for all items
  const audioTracks = computed(() => editorEdit.value?.audioTracks || []);
  const textOverlays = computed(() => editorEdit.value?.textOverlays || []);
  const stickers = computed(() => editorEdit.value?.stickers || []);
  const watermarks = computed(() => editorEdit.value?.watermarks || []);
  const effects = computed(() => editorEdit.value?.effects || []);

  /**
   * Group audio tracks by track_order so split segments appear on the same row
   */
  const groupedAudioTracks = computed(() => {
    const tracks = audioTracks.value;
    const grouped = new Map<number, VideoEditorAudioTrackRecord[]>();

    tracks.forEach((track) => {
      const order = track.track_order || 0;
      if (!grouped.has(order)) {
        grouped.set(order, []);
      }
      grouped.get(order)!.push(track);
    });

    // Sort segments within each track by start_time
    grouped.forEach((segments) => {
      segments.sort((a, b) => a.start_time - b.start_time);
    });

    // Convert to array and sort by track_order
    return Array.from(grouped.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([order, segments]) => ({ order, segments }));
  });

  /**
   * Get text overlays active at a specific time
   */
  function getActiveTextOverlays(time: number): VideoEditorTextOverlayRecord[] {
    return textOverlays.value.filter(
      (overlay) => time >= overlay.start_time && time <= overlay.end_time
    );
  }

  /**
   * Get stickers active at a specific time
   */
  function getActiveStickers(time: number): VideoEditorStickerRecord[] {
    return stickers.value.filter(
      (sticker) => time >= sticker.start_time && time <= sticker.end_time
    );
  }

  /**
   * Get watermarks active at a specific time
   */
  function getActiveWatermarks(time: number): VideoEditorWatermarkRecord[] {
    return watermarks.value.filter(
      (wm) => time >= wm.start_time && time <= wm.end_time
    );
  }

  /**
   * Get the first active watermark at a specific time
   * (typically only one watermark is displayed at a time)
   */
  function getActiveWatermark(time: number): VideoEditorWatermarkRecord | null {
    const active = getActiveWatermarks(time);
    return active.length > 0 ? active[0] : null;
  }

  /**
   * Get effects active at a specific time
   */
  function getActiveEffects(time: number): VideoEditorEffectRecord[] {
    return effects.value.filter(
      (effect) => time >= effect.start_time && time <= effect.end_time
    );
  }

  return {
    audioTracks,
    textOverlays,
    stickers,
    watermarks,
    effects,
    groupedAudioTracks,
    getActiveTextOverlays,
    getActiveStickers,
    getActiveWatermarks,
    getActiveWatermark,
    getActiveEffects,
  };
}
