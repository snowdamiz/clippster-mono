import { watch, type Ref, type WatchStopHandle } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import { updateVideoEditorEdit } from '@/services/database/video-editor-edits';
import type { FullVideoEditorEdit } from '@/services/database/video-editor-edits';

/**
 * Options for the editor auto-save composable
 */
export interface EditorAutoSaveOptions {
  /** The current edit ID */
  editId: Ref<string | null>;
  /** The editor edit data to watch for changes */
  editorEdit: Ref<FullVideoEditorEdit | null>;
  /** Debounce delay in milliseconds (default: 500) */
  debounceMs?: number;
  /** Whether auto-save is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Return type for the editor auto-save composable
 */
export interface EditorAutoSaveReturn {
  /** Trigger a save immediately (debounced) */
  save: () => void;
  /** Force save without debounce */
  saveNow: () => Promise<void>;
  /** Stop watching for changes */
  stop: () => void;
}

/**
 * Composable for auto-saving editor data
 *
 * Extracts the auto-save logic from ClipEditorDialog.vue into a focused,
 * testable composable. Handles:
 * - Debounced saving on data changes
 * - Manual save triggers
 * - Proper cleanup of watchers
 *
 * @example
 * ```ts
 * const { save, saveNow, stop } = useEditorAutoSave({
 *   editId,
 *   editorEdit,
 *   debounceMs: 500,
 * });
 *
 * // Manually trigger save
 * save();
 *
 * // Force immediate save
 * await saveNow();
 *
 * // Stop auto-save on unmount
 * onUnmounted(() => stop());
 * ```
 */
export function useEditorAutoSave(options: EditorAutoSaveOptions): EditorAutoSaveReturn {
  const { editId, editorEdit, debounceMs = 500, enabled = true } = options;

  let stopWatch: WatchStopHandle | null = null;

  /**
   * Perform the actual save operation
   */
  async function performSave(): Promise<void> {
    if (!editId.value || !editorEdit.value) return;

    try {
      const editData = JSON.parse(editorEdit.value.edit.edit_data || '{}');
      await updateVideoEditorEdit(editId.value, editData);
      console.log('[useEditorAutoSave] Auto-saved editor data');
    } catch (error) {
      console.error('[useEditorAutoSave] Failed to auto-save:', error);
    }
  }

  /**
   * Debounced save function
   */
  const debouncedSave = useDebounceFn(performSave, debounceMs);

  /**
   * Set up the watcher for auto-save
   */
  if (enabled) {
    stopWatch = watch(() => editorEdit.value, debouncedSave, { deep: true });
  }

  /**
   * Stop watching for changes and cleanup
   */
  function stop(): void {
    if (stopWatch) {
      stopWatch();
      stopWatch = null;
    }
  }

  return {
    save: debouncedSave,
    saveNow: performSave,
    stop,
  };
}
