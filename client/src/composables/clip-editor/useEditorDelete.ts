import { type Ref } from 'vue';
import type { SelectionItemType } from './useEditorSelection';
import {
  deleteVideoEditorAudioTrack,
  deleteVideoEditorTextOverlay,
  deleteVideoEditorSticker,
  deleteVideoEditorWatermark,
} from '@/services/database/video-editor-edits';
import { deleteVideoEditorSource } from '@/services/database/video-editor-projects';

/**
 * Options for useEditorDelete
 */
export interface EditorDeleteOptions {
  /** Currently selected item */
  selectedItem: Ref<any>;
  /** Type of the selected item */
  selectedItemType: Ref<SelectionItemType>;
  /** Callback to clear selection after delete */
  clearSelection?: () => void;
  /** Callback after delete completes */
  onComplete?: () => Promise<void>;
}

/**
 * Return type for useEditorDelete
 */
export interface EditorDeleteReturn {
  /**
   * Delete the currently selected item
   */
  deleteSelectedItem: () => Promise<void>;

  /**
   * Delete an audio track by ID
   */
  deleteAudioTrack: (id: string) => Promise<void>;

  /**
   * Delete a text overlay by ID
   */
  deleteTextOverlay: (id: string) => Promise<void>;

  /**
   * Delete a sticker by ID
   */
  deleteSticker: (id: string) => Promise<void>;

  /**
   * Delete a watermark by ID
   */
  deleteWatermark: (id: string) => Promise<void>;

  /**
   * Delete a video source by ID
   */
  deleteVideoSource: (id: string) => Promise<void>;

  /**
   * Check if there's something selected that can be deleted
   */
  canDelete: () => boolean;
}

/**
 * useEditorDelete - Handle delete operations for all item types
 *
 * Extracts delete logic from ClipEditorDialog (lines 597-639)
 *
 * Usage:
 * ```ts
 * const { deleteSelectedItem, deleteAudioTrack, canDelete } = useEditorDelete({
 *   selectedItem,
 *   selectedItemType,
 *   clearSelection: () => {
 *     selectedItem.value = null;
 *     selectedItemType.value = null;
 *   },
 *   onComplete: async () => {
 *     await loadEditorData();
 *     await reloadTimeline();
 *   }
 * });
 *
 * // Delete current selection
 * if (canDelete()) {
 *   await deleteSelectedItem();
 * }
 *
 * // Delete specific item
 * await deleteAudioTrack(trackId);
 * ```
 */
export function useEditorDelete(options: EditorDeleteOptions): EditorDeleteReturn {
  const { selectedItem, selectedItemType, clearSelection, onComplete } = options;

  /**
   * Delete an audio track by ID
   */
  async function deleteAudioTrack(id: string): Promise<void> {
    await deleteVideoEditorAudioTrack(id);
    console.log('[useEditorDelete] Audio track deleted:', id);
  }

  /**
   * Delete a text overlay by ID
   */
  async function deleteTextOverlay(id: string): Promise<void> {
    await deleteVideoEditorTextOverlay(id);
    console.log('[useEditorDelete] Text overlay deleted:', id);
  }

  /**
   * Delete a sticker by ID
   */
  async function deleteSticker(id: string): Promise<void> {
    await deleteVideoEditorSticker(id);
    console.log('[useEditorDelete] Sticker deleted:', id);
  }

  /**
   * Delete a watermark by ID
   */
  async function deleteWatermark(id: string): Promise<void> {
    await deleteVideoEditorWatermark(id);
    console.log('[useEditorDelete] Watermark deleted:', id);
  }

  /**
   * Delete a video source by ID
   */
  async function deleteVideoSource(id: string): Promise<void> {
    await deleteVideoEditorSource(id);
    console.log('[useEditorDelete] Video source deleted:', id);
  }

  /**
   * Check if there's something selected that can be deleted
   */
  function canDelete(): boolean {
    return selectedItem.value !== null && selectedItemType.value !== null;
  }

  /**
   * Delete the currently selected item
   */
  async function deleteSelectedItem(): Promise<void> {
    if (!selectedItem.value || !selectedItemType.value) {
      console.warn('[useEditorDelete] No item selected to delete');
      return;
    }

    console.log('[useEditorDelete] Delete:', selectedItemType.value, selectedItem.value);

    try {
      const itemId = selectedItem.value.id;
      const type = selectedItemType.value;

      switch (type) {
        case 'audio':
          await deleteAudioTrack(itemId);
          break;
        case 'text':
          await deleteTextOverlay(itemId);
          break;
        case 'sticker':
          await deleteSticker(itemId);
          break;
        case 'watermark':
          await deleteWatermark(itemId);
          break;
        case 'video':
          await deleteVideoSource(itemId);
          break;
        default:
          console.warn('[useEditorDelete] Unknown item type:', type);
          return;
      }

      // Clear selection
      if (clearSelection) {
        clearSelection();
      }

      // Run completion callback
      if (onComplete) {
        await onComplete();
      }

      console.log('[useEditorDelete] Item deleted and timeline updated');
    } catch (error) {
      console.error('[useEditorDelete] Failed to delete item:', error);
      throw error;
    }
  }

  return {
    deleteSelectedItem,
    deleteAudioTrack,
    deleteTextOverlay,
    deleteSticker,
    deleteWatermark,
    deleteVideoSource,
    canDelete,
  };
}
