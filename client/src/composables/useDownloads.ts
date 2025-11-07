import { ref, reactive } from 'vue';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { createRawVideo, getNextSegmentNumber } from '@/services/database';
import { generateId } from '@/services/database';

// Event emitter for download completion notifications
const completionCallbacks = new Set<(download: ActiveDownload) => void>();

export interface DownloadProgress {
  download_id: string;
  progress: number;
  current_time?: number;
  total_time?: number;
  status: string;
}

export interface DownloadResult {
  download_id: string;
  success: boolean;
  file_path?: string;
  thumbnail_path?: string;
  duration?: number;
  width?: number;
  height?: number;
  codec?: string;
  file_size?: number;
  error?: string;
}

export interface ActiveDownload {
  id: string;
  title: string;
  mintId: string;
  progress: DownloadProgress;
  result?: DownloadResult;
  rawVideoId?: string;
  // Segment tracking information
  sourceClipId?: string;
  segmentNumber?: number;
  isSegment?: boolean;
  segmentStartTime?: number;
  segmentEndTime?: number;
}

const activeDownloads = reactive<Map<string, ActiveDownload>>(new Map());
const isInitialized = ref(false);

export function useDownloads() {
  async function initialize() {
    if (isInitialized.value) {
      return;
    }

    // Listen for download progress updates
    await listen<DownloadProgress>('download-progress', (event) => {
      const download = activeDownloads.get(event.payload.download_id);
      if (download) {
        download.progress = event.payload;
      } else {
        console.warn(
          '[Downloads] Received progress for unknown download:',
          event.payload.download_id
        );
      }
    });

    // Listen for download completion
    await listen<DownloadResult>('download-complete', async (event) => {
      const download = activeDownloads.get(event.payload.download_id);
      if (download) {
        download.result = event.payload;

        // If download was successful, validate the video and thumbnail before creating database record
        if (event.payload.success && event.payload.file_path) {
          try {
            console.log('[Downloads] Validating downloaded video and thumbnail:', {
              sourceClipId: download.sourceClipId,
              segmentNumber: download.segmentNumber,
              isSegment: download.isSegment,
              title: download.title,
              filePath: event.payload.file_path,
              thumbnailPath: event.payload.thumbnail_path,
            });

            // Validate the downloaded video and thumbnail
            const validationResult = await validateDownloadedVideo(
              event.payload.file_path,
              event.payload.thumbnail_path,
              download.title
            );

            if (validationResult.isValid) {
              // Video is valid, create database record
              const rawVideoId = await createRawVideo(event.payload.file_path, {
                originalFilename: download.title,
                thumbnailPath: validationResult.thumbnailPath || event.payload.thumbnail_path,
                duration: event.payload.duration,
                width: event.payload.width,
                height: event.payload.height,
                frameRate: undefined, // We don't have this info from the basic download
                codec: event.payload.codec,
                fileSize: event.payload.file_size,
                // Segment tracking information
                sourceClipId: download.sourceClipId,
                sourceMintId: download.mintId,
                segmentNumber: download.segmentNumber,
                isSegment: download.isSegment || false,
                segmentStartTime: download.segmentStartTime,
                segmentEndTime: download.segmentEndTime,
              });

              console.log('[Downloads] Database record created successfully with ID:', rawVideoId);
              download.rawVideoId = rawVideoId;

              // Notify all listeners about completion
              completionCallbacks.forEach((callback) => {
                try {
                  callback(download);
                } catch (error) {
                  console.error('[Downloads] Error in completion callback:', error);
                }
              });
            } else {
              // Video validation failed, cleanup and notify error
              console.error('[Downloads] Video validation failed:', validationResult.error);

              // Cleanup corrupted files
              await cleanupCorruptedDownload(
                event.payload.file_path,
                validationResult.thumbnailPath || event.payload.thumbnail_path,
                download.rawVideoId
              );

              // Update download result to show failure
              download.result = {
                ...event.payload,
                success: false,
                error: validationResult.error || 'Video validation failed',
              };

              // Notify listeners about validation failure
              completionCallbacks.forEach((callback) => {
                try {
                  callback(download);
                } catch (error) {
                  console.error('[Downloads] Error in completion callback:', error);
                }
              });
            }
          } catch (error) {
            console.error('[Downloads] Error during download validation:', error);

            // Cleanup on validation error
            await cleanupCorruptedDownload(
              event.payload.file_path,
              event.payload.thumbnail_path,
              download.rawVideoId
            );

            // Update result to show failure
            download.result = {
              ...event.payload,
              success: false,
              error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
          }
        }
      } else {
        console.warn(
          '[Downloads] Received completion for unknown download:',
          event.payload.download_id
        );
      }
    });

    isInitialized.value = true;
  }

  async function startDownload(
    title: string,
    videoUrl: string,
    mintId: string,
    segmentRange?: { startTime: number; endTime: number },
    sourceClipId?: string
  ): Promise<string> {
    await initialize();

    const downloadId = generateId();

    const isSegmentDownload = !!(
      segmentRange &&
      sourceClipId &&
      segmentRange.startTime >= 0 &&
      segmentRange.endTime > segmentRange.startTime
    );

    let finalTitle = title;
    let segmentNumber: number | undefined;

    // Generate segment name if this is a segment download
    if (isSegmentDownload) {
      try {
        segmentNumber = await getNextSegmentNumber(sourceClipId);
        finalTitle = `${title} Segment ${segmentNumber}`;
      } catch (error) {
        console.warn('Error generating segment name - database may not be migrated:', error);
        // Fallback to original title if database isn't migrated
        finalTitle = title;
      }
    }

    const download: ActiveDownload = {
      id: downloadId,
      title: finalTitle,
      mintId,
      progress: {
        download_id: downloadId,
        progress: 0,
        status: 'Initializing...',
      },
      // Add segment tracking information
      sourceClipId: sourceClipId || (isSegmentDownload ? mintId : undefined),
      segmentNumber,
      isSegment: isSegmentDownload,
      segmentStartTime: segmentRange?.startTime,
      segmentEndTime: segmentRange?.endTime,
    };

    activeDownloads.set(downloadId, download);

    try {
      // Determine which download command to use
      if (isSegmentDownload) {
        // Start the segment download without waiting for it to complete
        invoke('download_pumpfun_vod_segment', {
          downloadId,
          title: finalTitle,
          videoUrl,
          mintId,
          startTime: segmentRange.startTime,
          endTime: segmentRange.endTime,
        }).catch((error) => {
          console.error('[Downloads] Error in segment download command (async):', error);
          // Remove from active downloads if failed to start
          activeDownloads.delete(downloadId);
          // We can't throw here since the async operation has already returned
        });
      } else {
        // Start the full download without waiting for it to complete
        invoke('download_pumpfun_vod', {
          downloadId,
          title: finalTitle,
          videoUrl,
          mintId,
        }).catch((error) => {
          console.error('[Downloads] Error in download command (async):', error);
          // Remove from active downloads if failed to start
          activeDownloads.delete(downloadId);
          // We can't throw here since the async operation has already returned
        });
      }
    } catch (error) {
      console.error('[Downloads] Error invoking download command:', error);
      // Remove from active downloads if failed to start
      activeDownloads.delete(downloadId);
      throw error;
    }

    return downloadId;
  }

  function getDownload(downloadId: string): ActiveDownload | undefined {
    return activeDownloads.get(downloadId);
  }

  function getAllDownloads(): ActiveDownload[] {
    return Array.from(activeDownloads.values());
  }

  function getActiveDownloads(): ActiveDownload[] {
    return Array.from(activeDownloads.values()).filter(
      (download) => !download.result || download.result.success === undefined
    );
  }

  function getCompletedDownloads(): ActiveDownload[] {
    return Array.from(activeDownloads.values()).filter(
      (download) => download.result && download.result.success !== undefined
    );
  }

  function removeDownload(downloadId: string): boolean {
    return activeDownloads.delete(downloadId);
  }

  function clearCompleted(): void {
    for (const [id, download] of activeDownloads.entries()) {
      if (download.result && download.result.success !== undefined) {
        activeDownloads.delete(id);
      }
    }
  }

  // Cleanup old completed downloads (older than 5 minutes)
  function cleanupOldDownloads(): void {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;

    for (const [id, download] of activeDownloads.entries()) {
      if (download.result && download.result.success !== undefined) {
        // If it's a completed download, remove it if it's older than 5 minutes
        // This prevents the downloads list from growing indefinitely
        if (Date.now() - fiveMinutesAgo > 0) {
          activeDownloads.delete(id);
        }
      }
    }
  }

  // Register a callback for download completion events
  function onDownloadComplete(callback: (download: ActiveDownload) => void): () => void {
    completionCallbacks.add(callback);

    // Return a function to unregister the callback
    return () => {
      completionCallbacks.delete(callback);
    };
  }

  // Validation functions
  async function validateDownloadedVideo(
    filePath: string,
    thumbnailPath: string | null,
    title: string
  ): Promise<{ isValid: boolean; thumbnailPath?: string | null; error?: string }> {
    try {
      console.log('[Validation] Starting validation for:', title);
      console.log('[Validation] File path:', filePath);
      console.log('[Validation] Thumbnail path:', thumbnailPath);

      // Check if video file exists and has content
      const videoExists = await invoke<boolean>('check_file_exists', { path: filePath });
      console.log('[Validation] Video file exists:', videoExists);

      if (!videoExists) {
        console.error('[Validation] Video file does not exist');
        return { isValid: false, error: 'Video file does not exist' };
      }

      // Validate video file integrity using FFmpeg
      console.log('[Validation] Calling validate_video_file command...');
      const videoValidation = await invoke<any>('validate_video_file', { filePath });
      console.log('[Validation] Validation result:', JSON.stringify(videoValidation, null, 2));

      if (!videoValidation.is_valid) {
        console.error('[Validation] Video validation failed. Full result:', videoValidation);
        console.error('[Validation] Error field:', videoValidation.error);
        console.error('[Validation] is_valid field:', videoValidation.is_valid);
        return {
          isValid: false,
          error: videoValidation.error || 'Video file is corrupted or invalid',
        };
      }

      // Check if thumbnail exists, and if not, try to regenerate it
      let finalThumbnailPath = thumbnailPath;
      if (thumbnailPath) {
        const thumbnailExists = await invoke<boolean>('check_file_exists', { path: thumbnailPath });
        console.log('[Validation] Thumbnail exists:', thumbnailExists);

        if (!thumbnailExists) {
          console.log('[Validation] Thumbnail missing or invalid, regenerating...');

          try {
            finalThumbnailPath = await invoke<string>('generate_thumbnail', {
              videoPath: filePath,
            });
            console.log('[Validation] Successfully regenerated thumbnail:', finalThumbnailPath);
          } catch (thumbnailError) {
            console.warn('[Validation] Failed to regenerate thumbnail:', thumbnailError);
            // Continue without thumbnail - not a critical failure
          }
        }
      } else {
        console.log('[Validation] No thumbnail path provided');
      }

      console.log('[Validation] Video validation successful for:', title);
      return { isValid: true, thumbnailPath: finalThumbnailPath };
    } catch (error) {
      console.error('[Validation] Error during video validation:', error);
      console.error('[Validation] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      return {
        isValid: false,
        error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  async function cleanupCorruptedDownload(
    filePath: string | null,
    thumbnailPath: string | null,
    rawVideoId: string | undefined
  ): Promise<void> {
    try {
      console.log('[Cleanup] Starting cleanup for corrupted download');

      // Delete video file if it exists
      if (filePath) {
        try {
          await invoke('delete_video_file', {
            filePath,
            thumbnailPath: thumbnailPath || undefined,
          });
          console.log('[Cleanup] Deleted video file:', filePath);
        } catch (error) {
          console.warn('[Cleanup] Failed to delete video file:', error);
        }
      }

      // Delete database record if it was created
      if (rawVideoId) {
        try {
          const { deleteRawVideo } = await import('@/services/database');
          await deleteRawVideo(rawVideoId);
          console.log('[Cleanup] Deleted database record:', rawVideoId);
        } catch (error) {
          console.warn('[Cleanup] Failed to delete database record:', error);
        }
      }

      console.log('[Cleanup] Cleanup completed');
    } catch (error) {
      console.error('[Cleanup] Error during cleanup:', error);
    }
  }

  return {
    activeDownloads,
    isInitialized,
    initialize,
    startDownload,
    getDownload,
    getAllDownloads,
    getActiveDownloads,
    getCompletedDownloads,
    removeDownload,
    clearCompleted,
    cleanupOldDownloads,
    onDownloadComplete,
    validateDownloadedVideo,
    cleanupCorruptedDownload,
  };
}
