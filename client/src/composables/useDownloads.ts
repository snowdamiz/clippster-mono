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
  // Queue and video info
  videoUrl?: string;
}

const activeDownloads = reactive<Map<string, ActiveDownload>>(new Map());
const queuedDownloads = reactive<Map<string, ActiveDownload>>(new Map());
const isInitialized = ref(false);

// Download queue settings
const MAX_CONCURRENT_DOWNLOADS = 1;
const activeDownloadIds = reactive<Set<string>>(new Set());

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
            // Validate the downloaded video and thumbnail
            const validationResult = await validateDownloadedVideo(
              event.payload.file_path,
              event.payload.thumbnail_path || null,
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

              // Cleanup corrupted files
              await cleanupCorruptedDownload(
                event.payload.file_path,
                validationResult.thumbnailPath || event.payload.thumbnail_path || null,
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
            // Cleanup on validation error
            await cleanupCorruptedDownload(
              event.payload.file_path,
              event.payload.thumbnail_path || null,
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

      // Process queue when any download completes (successfully or not)
      if (activeDownloads.has(event.payload.download_id)) {
        // Remove from active downloads tracking
        activeDownloadIds.delete(event.payload.download_id);

        // Clean up metadata on successful completion (no need to keep it)
        if (event.payload.success) {
          try {
            await invoke('cleanup_completed_download', { downloadId: event.payload.download_id });
          } catch (cleanupError) {
            console.warn(
              '[Downloads] Failed to cleanup completed download metadata:',
              cleanupError
            );
          }
        }

        // Process next in queue
        processQueue();
      }
    });

    isInitialized.value = true;
  }

  async function startDownload(
    title: string,
    videoUrl: string,
    mintId: string,
    segmentRange?: { startTime: number; endTime: number },
    sourceClipId?: string,
    totalDuration?: number
  ): Promise<string> {
    await initialize();

    // If this is a full stream download and we have duration info, check if we need auto-segmentation
    if (!segmentRange && totalDuration && totalDuration > 3600) {
      // Auto-segment into equal chunks, no larger than 1 hour each
      console.log(`[Downloads] Auto-segmenting ${totalDuration}s video into 1-hour max chunks`);
      return await startAutoSegmentedDownload(
        title,
        videoUrl,
        mintId,
        sourceClipId || mintId,
        totalDuration
      );
    }

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
        }).catch((_error) => {
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
        }).catch((_error) => {
          // Remove from active downloads if failed to start
          activeDownloads.delete(downloadId);
          // We can't throw here since the async operation has already returned
        });
      }
    } catch (error) {
      // Remove from active downloads if failed to start
      activeDownloads.delete(downloadId);
      throw error;
    }

    return downloadId;
  }

  // Auto-segment download function for long videos
  async function startAutoSegmentedDownload(
    title: string,
    videoUrl: string,
    mintId: string,
    sourceClipId: string,
    totalDuration: number
  ): Promise<string> {
    await initialize();

    // Calculate equal segments, no larger than 1 hour (3600 seconds) each
    const maxSegmentDuration = 3600;
    const numberOfSegments = Math.ceil(totalDuration / maxSegmentDuration);
    const segmentDuration = totalDuration / numberOfSegments;

    console.log(
      `[Downloads] Splitting into ${numberOfSegments} equal segments of ${segmentDuration.toFixed(2)}s each`
    );

    // Create segments with equal time ranges
    const segments: Array<{ startTime: number; endTime: number; segmentNumber: number }> = [];
    for (let i = 0; i < numberOfSegments; i++) {
      const startTime = i * segmentDuration;
      const endTime = Math.min((i + 1) * segmentDuration, totalDuration);
      segments.push({
        startTime: Math.round(startTime * 1000) / 1000, // Round to 3 decimal places
        endTime: Math.round(endTime * 1000) / 1000,
        segmentNumber: i + 1,
      });
    }

    // Create a group ID to link all segments together
    const groupId = generateId();
    const allDownloadIds: string[] = [];

    // Process segments with queue system
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const segmentTitle = `${title} Part ${segment.segmentNumber}`;

      // Create download object
      const downloadId = generateId();
      const download: ActiveDownload = {
        id: downloadId,
        title: segmentTitle,
        mintId,
        progress: {
          download_id: downloadId,
          progress: 0,
          status: i < MAX_CONCURRENT_DOWNLOADS ? 'Initializing...' : 'Queued...',
        },
        sourceClipId: sourceClipId,
        segmentNumber: segment.segmentNumber,
        isSegment: true,
        segmentStartTime: segment.startTime,
        segmentEndTime: segment.endTime,
        videoUrl: videoUrl,
      };

      // Add group metadata
      (download as any).groupId = groupId;
      (download as any).totalSegments = numberOfSegments;
      (download as any).currentSegmentIndex = i;
      (download as any).isAutoSegmented = true;
      (download as any).isQueued = i >= MAX_CONCURRENT_DOWNLOADS;

      // Add to appropriate queue
      if (i < MAX_CONCURRENT_DOWNLOADS) {
        activeDownloads.set(downloadId, download);
        activeDownloadIds.add(downloadId);

        // Start the download immediately
        invoke('download_pumpfun_vod_segment', {
          downloadId,
          title: segmentTitle,
          videoUrl,
          mintId,
          startTime: segment.startTime,
          endTime: segment.endTime,
        }).catch((_error) => {
          // Remove from active downloads if failed to start
          activeDownloads.delete(downloadId);
          activeDownloadIds.delete(downloadId);
          // Start next in queue
          processQueue();
        });
      } else {
        // Add to queue
        queuedDownloads.set(downloadId, download);
        console.log(
          `[Downloads] Segment ${segment.segmentNumber} queued (position ${i - MAX_CONCURRENT_DOWNLOADS + 1})`
        );
      }

      allDownloadIds.push(downloadId);
    }

    console.log(
      `[Downloads] Started ${Math.min(numberOfSegments, MAX_CONCURRENT_DOWNLOADS)} immediate downloads, queued ${Math.max(0, numberOfSegments - MAX_CONCURRENT_DOWNLOADS)} with group ID: ${groupId}`
    );

    // Return the first download ID as the primary identifier
    return allDownloadIds[0];
  }

  // Process queued downloads
  function processQueue() {
    if (queuedDownloads.size === 0) return;
    if (activeDownloadIds.size >= MAX_CONCURRENT_DOWNLOADS) return;

    // Get the next download from queue (FIFO)
    const nextQueuedId = queuedDownloads.keys().next().value;
    if (!nextQueuedId) return;

    const queuedDownload = queuedDownloads.get(nextQueuedId);
    if (!queuedDownload) return;

    // Move from queue to active
    queuedDownloads.delete(nextQueuedId);
    activeDownloads.set(nextQueuedId, queuedDownload);
    activeDownloadIds.add(nextQueuedId);

    // Update status
    queuedDownload.progress.status = 'Initializing...';
    (queuedDownload as any).isQueued = false;

    // Get segment info
    const segmentRange = {
      startTime: queuedDownload.segmentStartTime!,
      endTime: queuedDownload.segmentEndTime!,
    };

    console.log(`[Downloads] Starting queued download: ${queuedDownload.title}`);

    // Start the download
    invoke('download_pumpfun_vod_segment', {
      downloadId: nextQueuedId,
      title: queuedDownload.title,
      videoUrl: queuedDownload.videoUrl!,
      mintId: queuedDownload.mintId,
      startTime: segmentRange.startTime,
      endTime: segmentRange.endTime,
    }).catch((_error) => {
      // Remove from active downloads if failed to start
      activeDownloads.delete(nextQueuedId);
      activeDownloadIds.delete(nextQueuedId);
      // Start next in queue
      processQueue();
    });
  }

  function getDownload(downloadId: string): ActiveDownload | undefined {
    return activeDownloads.get(downloadId);
  }

  function getAllDownloads(): ActiveDownload[] {
    return [...Array.from(activeDownloads.values()), ...Array.from(queuedDownloads.values())];
  }

  function getActiveDownloads(): ActiveDownload[] {
    return Array.from(activeDownloads.values()).filter(
      (download) => !download.result || download.result.success === undefined
    );
  }

  function getQueuedDownloads(): ActiveDownload[] {
    return Array.from(queuedDownloads.values());
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

  // Cancel download function
  async function cancelDownload(downloadId: string): Promise<boolean> {
    try {
      console.log(`[Downloads] Canceling download: ${downloadId}`);

      let cancelled = false;

      // Check if download is in active downloads
      if (activeDownloads.has(downloadId)) {
        // Attempt to cancel the actual download process
        try {
          cancelled = await invoke('cancel_download', { downloadId });
        } catch (cancelError) {
          console.warn('[Downloads] Failed to cancel backend process:', cancelError);
          // Continue with cleanup even if backend cancellation fails
          cancelled = true; // Assume we can still clean up
        }

        // Remove from active downloads
        activeDownloads.delete(downloadId);
        activeDownloadIds.delete(downloadId);

        // Process next in queue
        processQueue();
      }

      // Check if download is in queue
      if (queuedDownloads.has(downloadId)) {
        // Simply remove from queue (no backend process to cancel)
        queuedDownloads.delete(downloadId);
        cancelled = true;
      }

      return cancelled;
    } catch (error) {
      console.error('[Downloads] Error canceling download:', error);
      return false;
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
    _title: string
  ): Promise<{ isValid: boolean; thumbnailPath?: string | null; error?: string }> {
    try {
      // Check if video file exists and has content
      const videoExists = await invoke<boolean>('check_file_exists', { path: filePath });

      if (!videoExists) {
        return { isValid: false, error: 'Video file does not exist' };
      }

      // Validate video file integrity using FFmpeg
      const videoValidation = await invoke<any>('validate_video_file', { filePath });

      if (!videoValidation.is_valid) {
        return {
          isValid: false,
          error: videoValidation.error || 'Video file is corrupted or invalid',
        };
      }

      // Check if thumbnail exists, and if not, try to regenerate it
      let finalThumbnailPath = thumbnailPath;
      if (thumbnailPath) {
        const thumbnailExists = await invoke<boolean>('check_file_exists', { path: thumbnailPath });

        if (!thumbnailExists) {
          try {
            finalThumbnailPath = await invoke<string>('generate_thumbnail', {
              videoPath: filePath,
            });
          } catch (thumbnailError) {
            console.warn('[Validation] Failed to regenerate thumbnail:', thumbnailError);
            // Continue without thumbnail - not a critical failure
          }
        }
      } else {
        console.log('[Validation] No thumbnail path provided');
      }

      return { isValid: true, thumbnailPath: finalThumbnailPath };
    } catch (error) {
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
      // Delete video file if it exists
      if (filePath) {
        try {
          await invoke('delete_video_file', {
            filePath,
            thumbnailPath: thumbnailPath || undefined,
          });
        } catch (error) {
          console.warn('[Cleanup] Failed to delete video file:', error);
        }
      }

      // Delete database record if it was created
      if (rawVideoId) {
        try {
          const { deleteRawVideo } = await import('@/services/database');
          await deleteRawVideo(rawVideoId);
        } catch (error) {
          console.warn('[Cleanup] Failed to delete database record:', error);
        }
      }
    } catch (error) {
      console.error('[Cleanup] Error during cleanup:', error);
    }
  }

  return {
    activeDownloads,
    queuedDownloads,
    isInitialized,
    initialize,
    startDownload,
    getDownload,
    getAllDownloads,
    getActiveDownloads,
    getQueuedDownloads,
    getCompletedDownloads,
    removeDownload,
    clearCompleted,
    cleanupOldDownloads,
    cancelDownload,
    onDownloadComplete,
    validateDownloadedVideo,
    cleanupCorruptedDownload,
  };
}
