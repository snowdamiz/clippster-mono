import { invoke } from '@tauri-apps/api/core';
import { deleteRawVideo, getRawVideo } from '@/services/database';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  thumbnailPath?: string | null;
  duration?: number;
  width?: number;
  height?: number;
  codec?: string;
  fileSize?: number;
}

/**
 * Validate an existing video file and regenerate thumbnail if missing
 */
export async function validateExistingVideo(
  videoId: string,
  autoCleanup: boolean = true
): Promise<ValidationResult> {
  try {
    console.log('[VideoValidation] Validating existing video:', videoId);

    // Get video record from database
    const videoRecord = await getRawVideo(videoId);
    if (!videoRecord) {
      return {
        isValid: false,
        error: 'Video record not found in database',
      };
    }

    // Check if video file exists
    const videoExists = await invoke<boolean>('check_file_exists', {
      path: videoRecord.file_path,
    });

    if (!videoExists) {
      const error = 'Video file is missing from filesystem';

      if (autoCleanup) {
        console.log('[VideoValidation] Cleaning up orphaned database record:', videoId);
        await cleanupOrphanedVideo(videoId, error);
      }

      return {
        isValid: false,
        error,
      };
    }

    // Validate video file integrity using FFmpeg
    const videoValidation = await invoke<any>('validate_video_file', {
      filePath: videoRecord.file_path,
    });

    if (!videoValidation.isValid) {
      const error = videoValidation.error || 'Video file is corrupted or invalid';

      if (autoCleanup) {
        console.log('[VideoValidation] Cleaning up corrupted video:', videoId);
        await cleanupCorruptedVideo(
          videoId,
          videoRecord.file_path,
          videoRecord.thumbnail_path,
          error
        );
      }

      return {
        isValid: false,
        error,
      };
    }

    // Check if thumbnail exists, and if not, try to regenerate it
    let finalThumbnailPath = videoRecord.thumbnail_path;
    if (
      !videoRecord.thumbnail_path ||
      !(await invoke<boolean>('check_file_exists', {
        path: videoRecord.thumbnail_path,
      }))
    ) {
      console.log('[VideoValidation] Thumbnail missing, regenerating...');

      try {
        finalThumbnailPath = await invoke<string>('generate_thumbnail', {
          videoPath: videoRecord.file_path,
        });
        console.log('[VideoValidation] Successfully regenerated thumbnail:', finalThumbnailPath);

        // Update database with new thumbnail path
        const { updateRawVideo } = await import('@/services/database');
        await updateRawVideo(videoId, { thumbnail_path: finalThumbnailPath });
      } catch (thumbnailError) {
        console.warn('[VideoValidation] Failed to regenerate thumbnail:', thumbnailError);
        // Continue without thumbnail - not a critical failure
      }
    }

    console.log('[VideoValidation] Video validation successful for:', videoId);
    return {
      isValid: true,
      thumbnailPath: finalThumbnailPath,
      duration: videoValidation.duration,
      width: videoValidation.width,
      height: videoValidation.height,
      codec: videoValidation.codec,
      fileSize: videoValidation.file_size,
    };
  } catch (error) {
    console.error('[VideoValidation] Error during video validation:', error);
    return {
      isValid: false,
      error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Cleanup orphaned video (database record exists but file is missing)
 */
async function cleanupOrphanedVideo(videoId: string, reason: string): Promise<void> {
  try {
    console.log('[VideoValidation] Cleaning up orphaned video:', { videoId, reason });

    // Delete database record
    await deleteRawVideo(videoId);

    console.log('[VideoValidation] Cleaned up orphaned database record:', videoId);
  } catch (error) {
    console.error('[VideoValidation] Error cleaning up orphaned video:', error);
  }
}

/**
 * Cleanup corrupted video and associated files
 */
async function cleanupCorruptedVideo(
  videoId: string,
  filePath: string,
  thumbnailPath: string | null,
  reason: string
): Promise<void> {
  try {
    console.log('[VideoValidation] Cleaning up corrupted video:', { videoId, filePath, reason });

    // Delete files if they exist
    try {
      await invoke('delete_video_file', {
        filePath,
        thumbnailPath: thumbnailPath || undefined,
      });
      console.log('[VideoValidation] Deleted corrupted video file:', filePath);
    } catch (error) {
      console.warn('[VideoValidation] Failed to delete corrupted video file:', error);
    }

    // Delete database record
    await deleteRawVideo(videoId);

    console.log('[VideoValidation] Cleaned up corrupted video:', videoId);
  } catch (error) {
    console.error('[VideoValidation] Error cleaning up corrupted video:', error);
  }
}

/**
 * Batch validate multiple videos
 */
export async function validateMultipleVideos(
  videoIds: string[],
  autoCleanup: boolean = true,
  progressCallback?: (current: number, total: number, result: ValidationResult) => void
): Promise<{ results: ValidationResult[]; validCount: number; invalidCount: number }> {
  const results: ValidationResult[] = [];
  let validCount = 0;
  let invalidCount = 0;

  for (let i = 0; i < videoIds.length; i++) {
    const videoId = videoIds[i];
    const result = await validateExistingVideo(videoId, autoCleanup);

    results.push(result);

    if (result.isValid) {
      validCount++;
    } else {
      invalidCount++;
    }

    // Call progress callback if provided
    if (progressCallback) {
      progressCallback(i + 1, videoIds.length, result);
    }

    // Small delay to prevent overwhelming the system
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return {
    results,
    validCount,
    invalidCount,
  };
}
