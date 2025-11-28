import { ref, computed } from 'vue';
import {
  createWatermarkImage,
  deleteWatermarkImage,
  getAllWatermarkImages,
  type WatermarkImage,
} from '@/services/database';
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '@/composables/useToast';

// Event emitter for upload completion notifications
const completionCallbacks = new Set<() => void>();

// Shared state across all instances
const uploading = ref(false);
const watermarks = ref<WatermarkImage[]>([]);
const loading = ref(false);

export function useWatermarkOperations() {
  const { success, error } = useToast();

  async function loadWatermarks() {
    loading.value = true;
    try {
      watermarks.value = await getAllWatermarkImages();
    } catch (err) {
      console.error('Failed to load watermarks:', err);
      error('Failed to load watermarks', String(err));
    } finally {
      loading.value = false;
    }
  }

  async function uploadWatermark() {
    if (uploading.value) return { success: false };

    try {
      uploading.value = true;

      // Open native file dialog for image selection
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'Images',
            extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
          },
        ],
      });

      if (!selected) return { success: false, cancelled: true }; // User cancelled
      const sourcePath = selected;
      const originalFilename = sourcePath.split(/[\\\/]/).pop() || 'Unknown';

      console.log('Starting watermark upload:', { sourcePath, originalFilename });

      // Copy watermark to storage
      const result = await invoke<{
        destination_path: string;
        original_filename: string;
        width: number | null;
        height: number | null;
        file_size: number | null;
      }>('copy_watermark_to_storage', { sourcePath });

      // Create database record
      const watermarkId = await createWatermarkImage(
        result.original_filename,
        result.destination_path,
        result.width ?? undefined,
        result.height ?? undefined,
        result.file_size ?? undefined
      );

      console.log('Watermark uploaded:', watermarkId);

      // Show success toast
      success('Watermark uploaded', `"${result.original_filename}" has been uploaded successfully`);

      // Reload watermarks
      await loadWatermarks();

      // Notify all listeners about completion
      completionCallbacks.forEach((callback) => {
        try {
          callback();
        } catch (err) {
          console.error('[WatermarkOperations] Error in completion callback:', err);
        }
      });

      return { success: true, watermarkId };
    } catch (err) {
      console.error('Watermark upload error:', err);
      error('Upload failed', `Failed to upload watermark: ${err}`);
      return { success: false, error: err };
    } finally {
      uploading.value = false;
    }
  }

  async function deleteWatermark(watermark: WatermarkImage) {
    const deletedName = watermark.name || watermark.file_path.split(/[\\\/]/).pop() || 'Watermark';

    try {
      // Delete file from filesystem
      await invoke('delete_watermark_file', {
        filePath: watermark.file_path,
      });

      // Delete the database record
      await deleteWatermarkImage(watermark.id);

      // Show success toast
      success('Watermark deleted', `"${deletedName}" has been deleted successfully`);

      // Reload watermarks
      await loadWatermarks();

      return { success: true };
    } catch (err) {
      error('Delete failed', `Failed to delete watermark: ${err}`);
      return { success: false, error: err };
    }
  }

  async function getWatermarkUrl(watermark: WatermarkImage): Promise<string> {
    try {
      // Get the file as a data URL
      const dataUrl = await invoke<string>('read_file_as_data_url', {
        filePath: watermark.file_path,
      });
      return dataUrl;
    } catch (err) {
      console.error('Failed to get watermark URL:', err);
      throw err;
    }
  }

  // Register a callback for upload completion events
  function onUploadComplete(callback: () => void): () => void {
    completionCallbacks.add(callback);

    // Return a function to unregister the callback
    return () => {
      completionCallbacks.delete(callback);
    };
  }

  return {
    uploading,
    loading,
    watermarks: computed(() => watermarks.value),
    loadWatermarks,
    uploadWatermark,
    deleteWatermark,
    getWatermarkUrl,
    onUploadComplete,
  };
}
