import { ref } from 'vue';
import { createRawVideo, deleteRawVideo, type RawVideo } from '@/services/database';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '@/composables/useToast';
import { useAudioChunking, type AudioChunk } from './useAudioChunking';

export function useVideoOperations() {
  const uploading = ref(false);
  const { success, error } = useToast();

  async function uploadVideo() {
    if (uploading.value) return { success: false };

    try {
      // Open file dialog with video file filters
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

      uploading.value = true;

      // Copy video to storage directory
      const result = await invoke<{ destination_path: string; original_filename: string }>(
        'copy_video_to_storage',
        {
          sourcePath: selected,
        }
      );

      // Generate thumbnail
      let thumbnailPath: string | undefined;
      try {
        thumbnailPath = await invoke<string>('generate_thumbnail', {
          videoPath: result.destination_path,
        });

        // Verify the thumbnail was actually created
        if (thumbnailPath) {
          const thumbnailExists = await invoke<boolean>('check_file_exists', {
            path: thumbnailPath,
          });
          if (!thumbnailExists) {
            thumbnailPath = undefined;
          }
        }
      } catch (error) {
        thumbnailPath = undefined;
      }

      // Create raw_videos record with original filename and thumbnail
      await createRawVideo(result.destination_path, {
        originalFilename: result.original_filename,
        thumbnailPath,
      });

      // Show success toast
      success('Video uploaded', `"${result.original_filename}" has been uploaded successfully`);

      return {
        success: true,
        video: {
          destination_path: result.destination_path,
          original_filename: result.original_filename,
          thumbnail_path: thumbnailPath,
        },
      };
    } catch (err) {
      error('Upload failed', `Failed to upload video: ${err}`);
      return { success: false, error: err };
    } finally {
      uploading.value = false;
    }
  }

  async function deleteVideo(video: RawVideo) {
    const deletedVideoName =
      video.original_filename || video.file_path.split(/[\\\/]/).pop() || 'Video';

    try {
      // Delete video file but preserve thumbnail for project cards
      await invoke('delete_video_file', {
        filePath: video.file_path,
        thumbnailPath: undefined, // Don't delete the thumbnail
      });

      // Delete the database record completely
      await deleteRawVideo(video.id);

      // Show success toast
      success('Video deleted', `"${deletedVideoName}" has been deleted successfully`);

      return { success: true };
    } catch (err) {
      error('Delete failed', `Failed to delete video: ${err}`);
      return { success: false, error: err };
    }
  }

  async function loadVideoThumbnail(video: RawVideo, cache: Map<string, string>) {
    if (!cache.has(video.id)) {
      // Check if video has a thumbnail path and if the file exists
      if (video.thumbnail_path) {
        try {
          const fileExists = await invoke<boolean>('check_file_exists', {
            path: video.thumbnail_path,
          });

          if (fileExists) {
            try {
              const dataUrl = await invoke<string>('read_file_as_data_url', {
                filePath: video.thumbnail_path,
              });
              cache.set(video.id, dataUrl);
              return dataUrl;
            } catch (error) {
              console.warn('Failed to load thumbnail for video:', video.id, error);
            }
          } else {
            console.warn('Thumbnail file does not exist:', video.thumbnail_path);
          }
        } catch (error) {
          console.warn('Failed to check thumbnail existence for video:', video.id, error);
        }
      } else {
        console.warn('No thumbnail path for video:', video.id);
      }

      // If we get here, either no thumbnail path, file doesn't exist, or failed to load
      // Use error SVG as fallback
      const errorSvgUrl = '/download_error.svg';
      cache.set(video.id, errorSvgUrl);
      return errorSvgUrl;
    }

    return cache.get(video.id) || '/download_error.svg';
  }

  async function prepareVideoForPlayback(video: RawVideo) {
    try {
      // Get video server port
      const port = await invoke<number>('get_video_server_port');
      // Encode file path as base64 for URL
      const encodedPath = btoa(video.file_path);
      return `http://localhost:${port}/video/${encodedPath}`;
    } catch (err) {
      throw err;
    }
  }

  async function prepareVideoForChunking(
    videoPath: string,
    projectId: string,
    options: {
      chunkDurationMinutes?: number;
      overlapSeconds?: number;
    } = {}
  ): Promise<{ success: boolean; chunks?: AudioChunk[]; error?: string }> {
    try {
      // First check if file exists
      const fileExists = await invoke<boolean>('check_file_exists', { path: videoPath });
      if (!fileExists) {
        return { success: false, error: 'Video file not found' };
      }

      // Use audio chunking composable
      const { extractAndChunkVideo } = useAudioChunking();
      const result = await extractAndChunkVideo(videoPath, projectId, options);

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage };
    }
  }

  // Get video duration for chunking estimates
  async function getVideoDuration(
    videoPath: string
  ): Promise<{ success: boolean; duration?: number; error?: string }> {
    try {
      // This could be implemented by calling a new Tauri command that uses FFmpeg to get duration
      // For now, we'll return a placeholder implementation
      console.log('[VideoOperations] Getting video duration for:', videoPath);

      // TODO: Implement actual duration detection via FFmpeg
      // This would involve adding a new Tauri command or using existing infrastructure

      return { success: false, error: 'Duration detection not implemented yet' };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage };
    }
  }

  return {
    uploading,
    uploadVideo,
    deleteVideo,
    loadVideoThumbnail,
    prepareVideoForPlayback,
    prepareVideoForChunking,
    getVideoDuration,
  };
}
