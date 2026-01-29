import { type Ref } from 'vue';
import type { SelectionItemType } from './useEditorSelection';
import {
  updateVideoEditorAudioTrack,
  createVideoEditorAudioTrack,
  updateVideoEditorTextOverlay,
  createVideoEditorTextOverlay,
  updateVideoEditorSticker,
  createVideoEditorSticker,
  updateVideoEditorWatermark,
  createVideoEditorWatermark,
  type VideoEditorAudioTrackRecord,
  type VideoEditorTextOverlayRecord,
  type VideoEditorStickerRecord,
  type VideoEditorWatermarkRecord,
} from '@/services/database/video-editor-edits';
import { getVideoEditorProjectWithSources } from '@/services/database/video-editor-projects';
import { commandHistory } from '@/services/commands/CommandHistory';
import { SplitSourceCommand } from '@/services/commands/SplitSourceCommand';

/**
 * Options for useEditorSplit
 */
export interface EditorSplitOptions {
  /** Current edit ID */
  editId: Ref<string | null>;
  /** Current project ID */
  projectId: Ref<string | null>;
  /** Currently selected item */
  selectedItem: Ref<any>;
  /** Type of the selected item */
  selectedItemType: Ref<SelectionItemType>;
  /** Callback after split completes */
  onComplete?: () => Promise<void>;
}

/**
 * Return type for useEditorSplit
 */
export interface EditorSplitReturn {
  /**
   * Split at the given time - either the selected item or video source
   */
  splitAtTime: (time: number) => Promise<void>;

  /**
   * Split a video source at the given time
   */
  splitVideoSource: (time: number) => Promise<void>;

  /**
   * Split an audio track at the given time
   */
  splitAudioTrack: (item: VideoEditorAudioTrackRecord, time: number) => Promise<void>;

  /**
   * Split a text overlay at the given time
   */
  splitTextOverlay: (item: VideoEditorTextOverlayRecord, time: number) => Promise<void>;

  /**
   * Split a sticker at the given time
   */
  splitSticker: (item: VideoEditorStickerRecord, time: number) => Promise<void>;

  /**
   * Split a watermark at the given time
   */
  splitWatermark: (item: VideoEditorWatermarkRecord, time: number) => Promise<void>;
}

/**
 * useEditorSplit - Handle split operations for all item types
 *
 * Extracts split logic from ClipEditorDialog (lines 380-526)
 *
 * Split operations:
 * 1. If an item is selected, split that specific item at the playhead
 * 2. Otherwise, split the video source at the playhead
 *
 * Usage:
 * ```ts
 * const { splitAtTime, splitVideoSource, splitAudioTrack } = useEditorSplit({
 *   editId,
 *   projectId,
 *   selectedItem,
 *   selectedItemType,
 *   onComplete: async () => {
 *     await loadEditorData();
 *     await reloadTimeline();
 *   }
 * });
 *
 * // Split at current playhead position
 * await splitAtTime(currentTime);
 * ```
 */
export function useEditorSplit(options: EditorSplitOptions): EditorSplitReturn {
  const { editId, projectId, selectedItem, selectedItemType, onComplete } = options;

  /**
   * Check if split time is valid for the given item
   */
  function isValidSplitTime(item: { start_time: number; end_time: number }, time: number): boolean {
    return time > item.start_time && time < item.end_time;
  }

  /**
   * Split an audio track at the given time
   */
  async function splitAudioTrack(
    item: VideoEditorAudioTrackRecord,
    time: number
  ): Promise<void> {
    if (!editId.value) {
      throw new Error('No edit ID available');
    }

    if (!isValidSplitTime(item, time)) {
      console.warn('[useEditorSplit] Split time is not within audio track range');
      return;
    }

    // Update original track to end at split time
    await updateVideoEditorAudioTrack(item.id, { end_time: time });

    // Create new track from split time to original end
    await createVideoEditorAudioTrack(editId.value, {
      file_path: item.file_path,
      name: item.name,
      start_time: time,
      end_time: item.end_time,
      volume: item.volume,
      pan: item.pan || 0,
      fade_in: item.fade_in || 0,
      fade_out: item.fade_out || 0,
      track_order: item.track_order,
      is_muted: item.is_muted,
      is_solo: item.is_solo || 0,
      source_id: item.source_id,
    });

    console.log('[useEditorSplit] Audio track split successfully at', time);
  }

  /**
   * Split a text overlay at the given time
   */
  async function splitTextOverlay(
    item: VideoEditorTextOverlayRecord,
    time: number
  ): Promise<void> {
    if (!editId.value) {
      throw new Error('No edit ID available');
    }

    if (!isValidSplitTime(item, time)) {
      console.warn('[useEditorSplit] Split time is not within text overlay range');
      return;
    }

    // Update original overlay to end at split time
    await updateVideoEditorTextOverlay(item.id, { end_time: time });

    // Create new overlay from split time to original end
    await createVideoEditorTextOverlay(editId.value, {
      text: item.text,
      start_time: time,
      end_time: item.end_time,
      position_x: item.position_x,
      position_y: item.position_y,
      style_data: item.style_data,
      animation: item.animation,
      layer: item.layer,
      per_ratio_configs_data: item.per_ratio_configs_data,
      preview_height: item.preview_height,
    });

    console.log('[useEditorSplit] Text overlay split successfully at', time);
  }

  /**
   * Split a sticker at the given time
   */
  async function splitSticker(
    item: VideoEditorStickerRecord,
    time: number
  ): Promise<void> {
    if (!editId.value) {
      throw new Error('No edit ID available');
    }

    if (!isValidSplitTime(item, time)) {
      console.warn('[useEditorSplit] Split time is not within sticker range');
      return;
    }

    // Update original sticker to end at split time
    await updateVideoEditorSticker(item.id, { end_time: time });

    // Create new sticker from split time to original end
    await createVideoEditorSticker(editId.value, {
      sticker_path: item.sticker_path,
      sticker_type: item.sticker_type,
      start_time: time,
      end_time: item.end_time,
      position_x: item.position_x,
      position_y: item.position_y,
      scale: item.scale,
      rotation: item.rotation || 0,
      animation: item.animation,
      layer: item.layer,
      per_ratio_configs_data: item.per_ratio_configs_data,
    });

    console.log('[useEditorSplit] Sticker split successfully at', time);
  }

  /**
   * Split a watermark at the given time
   */
  async function splitWatermark(
    item: VideoEditorWatermarkRecord,
    time: number
  ): Promise<void> {
    if (!editId.value) {
      throw new Error('No edit ID available');
    }

    if (!isValidSplitTime(item, time)) {
      console.warn('[useEditorSplit] Split time is not within watermark range');
      return;
    }

    // Update original watermark to end at split time
    await updateVideoEditorWatermark(item.id, { end_time: time });

    // Create new watermark from split time to original end
    await createVideoEditorWatermark(editId.value, {
      watermark_id: item.watermark_id,
      watermark_path: item.watermark_path,
      preview_url: item.preview_url,
      start_time: time,
      end_time: item.end_time,
      position_x: item.position_x,
      position_y: item.position_y,
      scale: item.scale,
      opacity: item.opacity || 1,
      layer: item.layer,
    });

    console.log('[useEditorSplit] Watermark split successfully at', time);
  }

  /**
   * Split video source at the given time using command pattern
   */
  async function splitVideoSource(time: number): Promise<void> {
    if (!projectId.value) {
      throw new Error('No project ID available');
    }

    // Get project sources to find which source contains the current time
    const projectData = await getVideoEditorProjectWithSources(projectId.value);
    if (!projectData || projectData.sources.length === 0) {
      console.warn('[useEditorSplit] No sources to split');
      return;
    }

    // Find the source that contains the current time
    let sourceIndexToSplit = -1;
    for (let i = 0; i < projectData.sources.length; i++) {
      const source = projectData.sources[i];
      if (time >= source.start_time && time < source.end_time) {
        sourceIndexToSplit = i;
        break;
      }
    }

    if (sourceIndexToSplit === -1) {
      console.warn('[useEditorSplit] Current time is not within any source');
      return;
    }

    // Create and execute split command
    const command = new SplitSourceCommand(projectId.value, sourceIndexToSplit, time);
    await commandHistory.executeCommand(command);

    console.log('[useEditorSplit] Video source split successfully at', time);
  }

  /**
   * Split at the given time - handles both selected items and video sources
   */
  async function splitAtTime(time: number): Promise<void> {
    if (!projectId.value) {
      console.warn('[useEditorSplit] Cannot split: no project ID');
      return;
    }

    console.log('[useEditorSplit] Split at:', time, 'Selected:', selectedItemType.value);

    try {
      // If an item is selected, split that specific item
      if (selectedItem.value && selectedItemType.value) {
        const item = selectedItem.value;
        const type = selectedItemType.value;

        switch (type) {
          case 'audio':
            await splitAudioTrack(item, time);
            break;
          case 'text':
            await splitTextOverlay(item, time);
            break;
          case 'sticker':
            await splitSticker(item, time);
            break;
          case 'watermark':
            await splitWatermark(item, time);
            break;
          case 'video':
            // For video items, split the video source
            await splitVideoSource(time);
            break;
          default:
            console.warn('[useEditorSplit] Unknown item type:', type);
            return;
        }
      } else {
        // Otherwise, split video source at playhead
        await splitVideoSource(time);
      }

      // Run completion callback
      if (onComplete) {
        await onComplete();
      }
    } catch (error) {
      console.error('[useEditorSplit] Failed to split:', error);
      throw error;
    }
  }

  return {
    splitAtTime,
    splitVideoSource,
    splitAudioTrack,
    splitTextOverlay,
    splitSticker,
    splitWatermark,
  };
}
