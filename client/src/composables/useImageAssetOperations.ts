import { ref, computed } from 'vue';
import {
  createImageAsset,
  deleteImageAsset,
  getAllImageAssets,
  type ImageAsset,
} from '@/services/database';
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '@/composables/useToast';

// Event emitter for upload completion notifications
const completionCallbacks = new Set<() => void>();

// Shared state across all instances
const uploading = ref(false);
const imageAssets = ref<ImageAsset[]>([]);
const loading = ref(false);

export function useImageAssetOperations() {
  const { success, error } = useToast();

  async function loadImageAssets() {
    loading.value = true;
    try {
      imageAssets.value = await getAllImageAssets();
    } catch (err) {
      console.error('Failed to load image assets:', err);
      error('Failed to load image assets', String(err), undefined, 'projects');
    } finally {
      loading.value = false;
    }
  }

  async function uploadImageAsset() {
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
            extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tiff', 'tif'],
          },
        ],
      });

      if (!selected) return { success: false, cancelled: true }; // User cancelled
      const sourcePath = selected;
      const originalFilename = sourcePath.split(/[\\\/]/).pop() || 'Unknown';

      console.log('Starting image asset upload:', { sourcePath, originalFilename });

      // Copy image to storage
      const result = await invoke<{
        destination_path: string;
        original_filename: string;
        width: number | null;
        height: number | null;
        file_size: number | null;
        mime_type: string | null;
      }>('copy_image_to_storage', { sourcePath });

      // Create database record
      const imageAssetId = await createImageAsset(
        result.original_filename,
        result.destination_path,
        result.width ?? undefined,
        result.height ?? undefined,
        result.file_size ?? undefined,
        result.mime_type ?? undefined
      );

      console.log('Image asset uploaded:', imageAssetId);

      // Show success toast
      success('Image uploaded', `"${result.original_filename}" has been uploaded successfully`, undefined, 'projects');

      // Reload image assets
      await loadImageAssets();

      // Notify all listeners about completion
      completionCallbacks.forEach((callback) => {
        try {
          callback();
        } catch (err) {
          console.error('[ImageAssetOperations] Error in completion callback:', err);
        }
      });

      return { success: true, imageAssetId };
    } catch (err) {
      console.error('Image asset upload error:', err);
      error('Upload failed', `Failed to upload image: ${err}`, undefined, 'projects');
      return { success: false, error: err };
    } finally {
      uploading.value = false;
    }
  }

  async function deleteImageAssetItem(imageAsset: ImageAsset) {
    const deletedName = imageAsset.name || imageAsset.file_path.split(/[\\\/]/).pop() || 'Image';

    try {
      // Delete file from filesystem
      await invoke('delete_image_file', {
        filePath: imageAsset.file_path,
      });

      // Delete the database record
      await deleteImageAsset(imageAsset.id);

      // Show success toast
      success('Image deleted', `"${deletedName}" has been deleted successfully`, undefined, 'projects');

      // Reload image assets
      await loadImageAssets();

      return { success: true };
    } catch (err) {
      error('Delete failed', `Failed to delete image: ${err}`, undefined, 'projects');
      return { success: false, error: err };
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
    imageAssets: computed(() => imageAssets.value),
    loadImageAssets,
    uploadImageAsset,
    deleteImageAsset: deleteImageAssetItem,
    onUploadComplete,
  };
}
