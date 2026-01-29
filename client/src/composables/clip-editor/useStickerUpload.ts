import type { Ref } from 'vue';
import type { VideoEditorStickerRecord } from '@/services/database/video-editor-edits';
import { extractFileName } from './useEditorFormatters';

/**
 * Options for useStickerUpload
 */
export interface StickerUploadOptions {
  /** Reference to the current edit ID */
  editId: Ref<string | null>;
  /** Current playhead time for sticker placement */
  currentTime: Ref<number>;
  /** Function to create a sticker (from useStickersCRUD) */
  createSticker: (data: Partial<VideoEditorStickerRecord>) => Promise<VideoEditorStickerRecord>;
  /** Optional callback when upload succeeds */
  onUploadSuccess?: (sticker: VideoEditorStickerRecord) => void;
  /** Optional callback when upload fails */
  onUploadError?: (error: Error) => void;
}

/**
 * Return type for useStickerUpload
 */
export interface StickerUploadReturn {
  /** Open file dialog and upload sticker */
  uploadSticker: () => Promise<VideoEditorStickerRecord | null>;
}

/**
 * Default sticker duration in seconds
 */
const DEFAULT_STICKER_DURATION = 3;

/**
 * Supported image extensions for sticker upload
 */
const STICKER_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];

/**
 * useStickerUpload - Extract sticker upload logic
 *
 * Extracted from StickersPanel.vue:
 * - handleUploadSticker() lines 107-136
 *
 * This composable handles:
 * - Opening the file dialog for sticker selection
 * - Creating a sticker record with default values
 * - Error handling and logging
 *
 * Usage:
 * ```ts
 * const { create: createSticker } = useStickersCRUD(editIdRef);
 *
 * const { uploadSticker } = useStickerUpload({
 *   editId: toRef(props, 'editId'),
 *   currentTime: computed(() => props.currentTime || 0),
 *   createSticker,
 *   onUploadSuccess: (sticker) => emit('stickerAdded', sticker.id),
 * });
 *
 * // In template
 * <button @click="uploadSticker">Upload</button>
 * ```
 */
export function useStickerUpload(options: StickerUploadOptions): StickerUploadReturn {
  const { editId, currentTime, createSticker, onUploadSuccess, onUploadError } = options;

  /**
   * Open file dialog and upload sticker
   * @returns Created sticker record or null if cancelled/failed
   */
  async function uploadSticker(): Promise<VideoEditorStickerRecord | null> {
    if (!editId.value) {
      console.warn('[useStickerUpload] No edit ID available');
      return null;
    }

    try {
      const { open } = await import('@tauri-apps/plugin-dialog');

      const selected = await open({
        multiple: false,
        filters: [{ name: 'Images', extensions: STICKER_EXTENSIONS }],
      });

      if (!selected) return null;

      const filePath = selected as string;
      const startTime = currentTime.value;

      const newSticker = await createSticker({
        sticker_path: filePath,
        sticker_type: filePath.endsWith('.gif') ? 'gif' : 'image',
        start_time: startTime,
        end_time: startTime + DEFAULT_STICKER_DURATION,
        position_x: 50,
        position_y: 50,
        scale: 1.0,
        rotation: 0,
        animation: 'none',
      });

      console.log('[useStickerUpload] Uploaded sticker:', extractFileName(filePath));
      onUploadSuccess?.(newSticker);
      return newSticker;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[useStickerUpload] Failed to upload sticker:', err);
      onUploadError?.(err);
      return null;
    }
  }

  return {
    uploadSticker,
  };
}
