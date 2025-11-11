import { ref, computed } from 'vue';
import {
  createIntroOutro,
  deleteIntroOutro,
  updateIntroOutroThumbnailStatus,
  updateIntroOutroCompletion,
  type IntroOutro,
} from '@/services/database';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { generateId } from '@/services/database';
import { useToast } from '@/composables/useToast';

// Event emitter for upload completion notifications
const completionCallbacks = new Set<() => void>();

// Shared state across all instances
const uploading = ref(false);
const activeUploads = ref<Set<string>>(new Set()); // Track active uploads by upload ID
const activeUploadsCount = ref(0); // Separate counter for reactivity
const showSkeletonCard = ref(false); // Separate flag for skeleton display with minimum time
let isEventListenerInitialized = false;

export function useAssetOperations() {
  const { success, error } = useToast();

  // Initialize event listener for asset upload completion

  async function initializeEventListener() {
    if (isEventListenerInitialized) return;

    await listen('asset-upload-complete', async (event) => {
      console.log('Asset upload completed:', event.payload);
      const result = event.payload as {
        upload_id: string;
        success: boolean;
        file_path?: string;
        thumbnail_path?: string;
        duration?: number;
        error?: string;
      };

      // Remove upload from active tracking (extract the upload_id part before the colon)
      const actualUploadId = result.upload_id.split(':')[0];
      const wasActive = activeUploads.value.has(actualUploadId);
      activeUploads.value.delete(actualUploadId);
      if (wasActive) {
        activeUploadsCount.value = Math.max(0, activeUploadsCount.value - 1); // Update counter

        // Hide skeleton card immediately when upload completes
        if (activeUploadsCount.value === 0) {
          showSkeletonCard.value = false;
        }
      } else {
        // Unknown upload completion, just hide skeleton if no active uploads
        if (activeUploadsCount.value === 0) {
          showSkeletonCard.value = false;
        }
      }

      if (result.success && result.file_path) {
        // Create database record when upload completes successfully
        try {
          // Extract metadata from the upload_id (which contains our original data)
          // Format: "uploadId:encodedMetadata" where encodedMetadata is base64 encoded JSON
          let uploadData: { type: 'intro' | 'outro'; originalFilename: string };

          try {
            const metadataPart = result.upload_id.split(':')[1];
            if (metadataPart) {
              const decodedJson = atob(metadataPart);
              uploadData = JSON.parse(decodedJson);
            } else {
              throw new Error('No metadata found in upload_id');
            }
          } catch (decodeError) {
            console.error('Failed to decode upload metadata:', decodeError);
            throw new Error(
              `Invalid upload metadata encoding: ${decodeError instanceof Error ? decodeError.message : 'Unknown decode error'}`
            );
          }

          const assetId = await createIntroOutro(
            uploadData.type as 'intro' | 'outro',
            uploadData.originalFilename,
            result.file_path,
            result.duration,
            result.thumbnail_path || null,
            'completed'
          );

          console.log('Database record created for completed upload:', assetId);

          // Show success toast
          const typeLabel = uploadData.type === 'intro' ? 'Intro' : 'Outro';
          success(
            `${typeLabel} uploaded`,
            `"${uploadData.originalFilename}" has been uploaded successfully`
          );

          // Notify all listeners about completion
          completionCallbacks.forEach((callback) => {
            try {
              callback();
            } catch (error) {
              console.error('[AssetOperations] Error in completion callback:', error);
            }
          });
        } catch (dbError) {
          console.error('Failed to create database record for completed upload:', dbError);
          error('Upload failed', `Failed to save asset: ${dbError}`);
        }
      } else {
        // Show error toast for failed upload
        error('Upload failed', result.error || 'Unknown upload error');
      }
    });

    isEventListenerInitialized = true;
  }

  async function uploadAsset(type: 'intro' | 'outro') {
    if (uploading.value) return { success: false };

    try {
      uploading.value = true;

      // Initialize event listener if not already done
      await initializeEventListener();

      let sourcePath: string;
      let originalFilename: string;

      // Always use native file dialog for asset uploads to avoid blocking behavior
      // This matches the non-blocking pattern used by video uploads
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'Video',
            extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v'],
          },
        ],
      });

      if (!selected) return { success: false, cancelled: true }; // User cancelled
      sourcePath = selected;
      originalFilename = sourcePath.split(/[\\\/]/).pop() || 'Unknown';

      console.log('Starting async asset upload:', { type, sourcePath, originalFilename });

      // Generate unique upload ID and embed metadata
      const uploadId = generateId();
      const uploadMetadata = { type, originalFilename };
      const encodedMetadata = btoa(JSON.stringify(uploadMetadata));
      const fullUploadId = `${uploadId}:${encodedMetadata}`;

      // Add to active uploads tracking
      activeUploads.value.add(uploadId);
      activeUploadsCount.value++; // Update counter for reactivity
      showSkeletonCard.value = true; // Show skeleton immediately

      // Start async upload without waiting for completion
      invoke('upload_asset_async', {
        uploadId: fullUploadId,
        assetType: type,
        sourcePath,
        originalFilename,
      }).catch((err) => {
        console.error('Failed to start async upload:', err);
        error('Upload failed', `Failed to start upload: ${err}`);
        // Remove from active uploads on error
        activeUploads.value.delete(uploadId);
        activeUploadsCount.value = Math.max(0, activeUploadsCount.value - 1); // Update counter
      });

      // Return immediately - dialog will close, no database record yet
      return {
        success: true,
      };
    } catch (err) {
      console.error('Asset upload error:', err);
      const typeLabel = type === 'intro' ? 'Intro' : 'Outro';
      error('Upload failed', `Failed to upload ${typeLabel.toLowerCase()}: ${err}`);
      return { success: false, error: err };
    } finally {
      uploading.value = false;
    }
  }

  async function deleteAsset(asset: IntroOutro) {
    const deletedAssetName = asset.name || asset.file_path.split(/[\\\/]/).pop() || 'Asset';
    const typeLabel = asset.type === 'intro' ? 'Intro' : 'Outro';

    try {
      // Delete asset file
      await invoke('delete_asset_file', {
        filePath: asset.file_path,
        assetType: asset.type, // 'intro' or 'outro'
      });

      // Delete the database record
      await deleteIntroOutro(asset.id);

      // Show success toast
      success(`${typeLabel} deleted`, `"${deletedAssetName}" has been deleted successfully`);

      return { success: true };
    } catch (err) {
      error('Delete failed', `Failed to delete ${typeLabel.toLowerCase()}: ${err}`);
      return { success: false, error: err };
    }
  }

  async function prepareAssetForPlayback(asset: IntroOutro) {
    try {
      // Get video server port
      const port = await invoke<number>('get_video_server_port');
      // Encode file path as base64 for URL
      const encodedPath = btoa(asset.file_path);
      return `http://localhost:${port}/video/${encodedPath}`;
    } catch (err) {
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
    activeUploads,
    hasActiveUploads: computed(() => activeUploadsCount.value > 0),
    showSkeletonCard: computed(() => showSkeletonCard.value),
    uploadAsset,
    deleteAsset,
    prepareAssetForPlayback,
    onUploadComplete,
  };
}
