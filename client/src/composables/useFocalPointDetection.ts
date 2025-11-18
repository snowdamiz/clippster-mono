import { invoke } from '@tauri-apps/api/core';
import { hasFocalPoints, bulkCreateFocalPoints, getFocalPointCount } from '@/services/database';

interface FocalPointData {
  time_offset: number;
  focal_x: number;
  focal_y: number;
  confidence: number;
}

interface FocalDetectionResult {
  success: boolean;
  count?: number;
  error?: string;
}

/**
 * Composable for detecting and storing focal points in videos
 */
export function useFocalPointDetection() {
  /**
   * Detect focal points for a video if they don't already exist
   *
   * @param rawVideoId - ID of the raw video in the database
   * @param videoPath - File path to the video
   * @param intervalSeconds - Time interval between focal point samples (default: 5)
   * @returns Result with success status and count of focal points
   */
  async function detectFocalPoints(
    rawVideoId: string,
    videoPath: string,
    intervalSeconds: number = 5
  ): Promise<FocalDetectionResult> {
    try {
      console.log('[FocalPointDetection] Starting focal point detection for video:', rawVideoId);

      // Check if focal points already exist
      const exists = await hasFocalPoints(rawVideoId);
      if (exists) {
        const count = await getFocalPointCount(rawVideoId);
        console.log('[FocalPointDetection] Focal points already exist:', count);
        return { success: true, count };
      }

      console.log('[FocalPointDetection] No existing focal points, running detection...');

      // Call Tauri command to detect focal points
      const focalPointsData = await invoke<FocalPointData[]>('detect_focal_points', {
        videoPath,
        intervalSeconds,
      });

      console.log('[FocalPointDetection] Detection completed, found:', focalPointsData.length);

      // Store focal points in database
      if (focalPointsData.length > 0) {
        await bulkCreateFocalPoints(
          rawVideoId,
          focalPointsData.map((fp) => ({
            timeOffset: fp.time_offset,
            focalX: fp.focal_x,
            focalY: fp.focal_y,
            confidence: fp.confidence,
          }))
        );
        console.log('[FocalPointDetection] Stored focal points in database');
      }

      return {
        success: true,
        count: focalPointsData.length,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[FocalPointDetection] Detection failed:', errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Detect focal points silently in the background without blocking
   * Errors are logged but not thrown
   *
   * @param rawVideoId - ID of the raw video in the database
   * @param videoPath - File path to the video
   * @param intervalSeconds - Time interval between focal point samples (default: 5)
   */
  async function detectFocalPointsBackground(
    rawVideoId: string,
    videoPath: string,
    intervalSeconds: number = 5
  ): Promise<void> {
    try {
      await detectFocalPoints(rawVideoId, videoPath, intervalSeconds);
    } catch (error) {
      console.error('[FocalPointDetection] Background detection failed (non-blocking):', error);
      // Silently fail - focal points are an enhancement, not critical
    }
  }

  return {
    detectFocalPoints,
    detectFocalPointsBackground,
  };
}
