/**
 * Speaker Detection API Service
 *
 * Handles communication with the server-side speaker detection endpoints.
 * Used to analyze video clips for speakers and determine optimal framing strategies.
 */

import api from './api';
import type { FramingMode, VideoType, ParsedStrategyData } from './database/speaker-detection';

// ============================================================================
// TYPES
// ============================================================================

export interface AnalyzeSpeakersRequest {
  video_path: string;
  start_time: number;
  end_time: number;
  target_aspect_ratio?: string;
  sample_interval?: number;
}

export interface AnalyzeSpeakersResponse {
  success: boolean;
  clip_id: string;
  strategy: ServerFramingStrategy;
  video_type: VideoType;
  mode: FramingMode;
  confidence: number;
  speaker_count: number;
  target_aspect_ratio: string;
  analyzed_at: string;
}

export interface ServerFramingStrategy {
  mode: string;
  video_type: string;
  confidence: number;
  speaker_count: number;
  target_aspect_ratio: string;
  is_portrait: boolean;
  source_dimensions: {
    width: number;
    height: number;
  };
  ffmpeg_filter: string;
  layout?: {
    type: string;
    top_region: CropRegionResponse;
    bottom_region: CropRegionResponse;
    split_ratio: number;
  };
  keyframes?: KeyframeResponse[];
  crop_region?: CropRegionResponse;
  crop_center?: { x: number; y: number };
  generated_at: string;
}

export interface CropRegionResponse {
  x: number;
  y: number;
  width: number;
  height: number;
  output_height_ratio?: number;
}

export interface KeyframeResponse {
  timestamp: number;
  crop_x: number;
  crop_y: number;
  face_detected: boolean;
}

export interface ClassifyVideoRequest {
  video_path: string;
  start_time: number;
  end_time: number;
  sample_interval?: number;
}

export interface ClassifyVideoResponse {
  success: boolean;
  clip_id: string;
  video_type: VideoType;
  recommended_framing: FramingMode;
  speaker_layout: 'none' | 'single' | 'dual' | 'multi';
  confidence: number;
  speakers_detected: number;
  content_regions: number;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Analyzes a video clip for speakers and generates a framing strategy.
 *
 * This is the main entry point for speaker detection. It:
 * 1. Extracts frames from the video at regular intervals
 * 2. Detects faces/speakers in each frame using cloud vision API
 * 3. Analyzes speaker positions and movement patterns
 * 4. Classifies the video content type (gaming, talking head, IRL, etc.)
 * 5. Generates optimal framing strategy for portrait export
 *
 * @param clipId - The clip ID to analyze
 * @param request - Analysis parameters
 * @returns Framing strategy for the clip
 */
export async function analyzeSpeakers(
  clipId: string,
  request: AnalyzeSpeakersRequest
): Promise<AnalyzeSpeakersResponse> {
  console.log('[SpeakerDetectionAPI] Analyzing speakers for clip:', clipId);
  console.log('[SpeakerDetectionAPI] Request:', request);

  const response = await api.post<AnalyzeSpeakersResponse>(
    `/clips/${clipId}/analyze-speakers`,
    request
  );

  console.log('[SpeakerDetectionAPI] Response:', response.data);
  return response.data;
}

/**
 * Quick classification of video content type without full analysis.
 *
 * Use this for a faster preliminary check before deciding whether
 * to run full speaker analysis.
 *
 * @param clipId - The clip ID to classify
 * @param request - Classification parameters
 * @returns Video type classification
 */
export async function classifyVideo(
  clipId: string,
  request: ClassifyVideoRequest
): Promise<ClassifyVideoResponse> {
  console.log('[SpeakerDetectionAPI] Classifying video for clip:', clipId);

  const response = await api.post<ClassifyVideoResponse>(
    `/clips/${clipId}/classify-video`,
    request
  );

  console.log('[SpeakerDetectionAPI] Classification:', response.data);
  return response.data;
}

/**
 * Converts server response to ParsedStrategyData format for storage.
 */
export function convertServerStrategyToStorageFormat(
  serverStrategy: ServerFramingStrategy
): ParsedStrategyData {
  return {
    mode: serverStrategy.mode as FramingMode,
    ffmpeg_filter: serverStrategy.ffmpeg_filter,
    layout: serverStrategy.layout
      ? {
          type: serverStrategy.layout.type,
          top_region: serverStrategy.layout.top_region,
          bottom_region: serverStrategy.layout.bottom_region,
          split_ratio: serverStrategy.layout.split_ratio,
        }
      : undefined,
    keyframes: serverStrategy.keyframes,
    crop_region: serverStrategy.crop_region,
    crop_center: serverStrategy.crop_center,
  };
}

/**
 * Determines if a clip should use speaker-aware framing.
 *
 * Returns true if:
 * - Target aspect ratio is portrait (9:16, 4:5)
 * - Video is long enough to benefit from analysis
 *
 * @param targetAspectRatio - Target aspect ratio string (e.g., "9:16")
 * @param durationSeconds - Clip duration in seconds
 * @returns Whether to use speaker-aware framing
 */
export function shouldUseSpeakerAwareFraming(
  targetAspectRatio: string,
  durationSeconds: number
): boolean {
  // Only for portrait aspect ratios
  const portraitRatios = ['9:16', '4:5'];
  if (!portraitRatios.includes(targetAspectRatio)) {
    return false;
  }

  // Only for clips longer than 3 seconds
  if (durationSeconds < 3) {
    return false;
  }

  return true;
}

/**
 * Gets the recommended sample interval based on clip duration.
 *
 * Longer clips can use larger intervals to reduce API costs.
 *
 * @param durationSeconds - Clip duration in seconds
 * @returns Recommended sample interval in seconds
 */
export function getRecommendedSampleInterval(durationSeconds: number): number {
  if (durationSeconds <= 15) {
    return 1; // Every second for short clips
  } else if (durationSeconds <= 60) {
    return 2; // Every 2 seconds for medium clips
  } else if (durationSeconds <= 180) {
    return 3; // Every 3 seconds for longer clips
  } else {
    return 5; // Every 5 seconds for very long clips
  }
}

/**
 * Estimates the cost of speaker analysis for a clip.
 *
 * Based on Google Cloud Vision API pricing (~$1.50 per 1000 images).
 *
 * @param durationSeconds - Clip duration in seconds
 * @param sampleInterval - Sample interval in seconds
 * @returns Estimated cost in USD
 */
export function estimateAnalysisCost(durationSeconds: number, sampleInterval: number = 2): number {
  const frameCount = Math.ceil(durationSeconds / sampleInterval) + 1;
  const costPerFrame = 1.5 / 1000; // $1.50 per 1000 images
  return frameCount * costPerFrame;
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

export class SpeakerDetectionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'SpeakerDetectionError';
  }
}

/**
 * Wraps speaker detection API calls with error handling.
 */
export async function withSpeakerDetectionErrorHandling<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await operation();
  } catch (error: unknown) {
    if (error instanceof Error) {
      // Check for specific error types
      if (error.message.includes('GOOGLE_VISION_API_KEY')) {
        throw new SpeakerDetectionError(
          'Google Vision API key not configured',
          'API_KEY_MISSING',
          error
        );
      }
      if (error.message.includes('rate limit')) {
        throw new SpeakerDetectionError(
          'Rate limit exceeded. Please try again later.',
          'RATE_LIMIT',
          error
        );
      }
      if (error.message.includes('timeout')) {
        throw new SpeakerDetectionError(
          'Analysis timed out. Try a shorter clip or larger sample interval.',
          'TIMEOUT',
          error
        );
      }
    }

    throw new SpeakerDetectionError(`Speaker detection failed during ${context}`, 'UNKNOWN', error);
  }
}
