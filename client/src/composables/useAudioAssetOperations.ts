import { ref, computed } from 'vue';
import {
  createAudioAsset,
  deleteAudioAsset,
  getAllAudioAssets,
  type AudioAsset,
} from '@/services/database';
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '@/composables/useToast';

// Event emitter for upload completion notifications
const completionCallbacks = new Set<() => void>();

// Shared state across all instances
const uploading = ref(false);
const audioAssets = ref<AudioAsset[]>([]);
const loading = ref(false);

export function useAudioAssetOperations() {
  const { success, error } = useToast();

  async function loadAudioAssets() {
    loading.value = true;
    try {
      audioAssets.value = await getAllAudioAssets();
    } catch (err) {
      console.error('Failed to load audio assets:', err);
      error('Failed to load audio assets', String(err));
    } finally {
      loading.value = false;
    }
  }

  async function uploadAudioAsset() {
    if (uploading.value) return { success: false };

    try {
      uploading.value = true;

      // Open native file dialog for audio selection
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'Audio',
            extensions: ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'wma'],
          },
        ],
      });

      if (!selected) return { success: false, cancelled: true }; // User cancelled
      const sourcePath = selected;
      const originalFilename = sourcePath.split(/[\\\/]/).pop() || 'Unknown';

      console.log('Starting audio asset upload:', { sourcePath, originalFilename });

      // Copy audio to storage
      const result = await invoke<{
        destination_path: string;
        original_filename: string;
        duration: number | null;
        file_size: number | null;
        sample_rate: number | null;
        channels: number | null;
      }>('copy_audio_to_storage', { sourcePath });

      // Create database record
      const audioAssetId = await createAudioAsset(
        result.original_filename,
        result.destination_path,
        result.duration ?? undefined,
        result.file_size ?? undefined,
        result.sample_rate ?? undefined,
        result.channels ?? undefined
      );

      console.log('Audio asset uploaded:', audioAssetId);

      // Show success toast
      success('Audio uploaded', `"${result.original_filename}" has been uploaded successfully`);

      // Reload audio assets
      await loadAudioAssets();

      // Notify all listeners about completion
      completionCallbacks.forEach((callback) => {
        try {
          callback();
        } catch (err) {
          console.error('[AudioAssetOperations] Error in completion callback:', err);
        }
      });

      return { success: true, audioAssetId };
    } catch (err) {
      console.error('Audio asset upload error:', err);
      error('Upload failed', `Failed to upload audio: ${err}`);
      return { success: false, error: err };
    } finally {
      uploading.value = false;
    }
  }

  async function deleteAudioAssetItem(audioAsset: AudioAsset) {
    const deletedName = audioAsset.name || audioAsset.file_path.split(/[\\\/]/).pop() || 'Audio';

    try {
      // Delete file from filesystem
      await invoke('delete_audio_file', {
        filePath: audioAsset.file_path,
      });

      // Delete the database record
      await deleteAudioAsset(audioAsset.id);

      // Show success toast
      success('Audio deleted', `"${deletedName}" has been deleted successfully`);

      // Reload audio assets
      await loadAudioAssets();

      return { success: true };
    } catch (err) {
      error('Delete failed', `Failed to delete audio: ${err}`);
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
    audioAssets: computed(() => audioAssets.value),
    loadAudioAssets,
    uploadAudioAsset,
    deleteAudioAsset: deleteAudioAssetItem,
    onUploadComplete,
  };
}
