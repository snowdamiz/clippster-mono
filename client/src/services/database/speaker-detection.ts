/**
 * Speaker Detection Database Service
 *
 * Handles persistence of speaker detection results and framing strategies
 * in the local SQLite database.
 */

import { getDatabase, generateId } from './core';

// ============================================================================
// TYPES
// ============================================================================

export type FramingMode = 'split_screen' | 'dynamic_pan' | 'static';
export type VideoType = 'talking_head' | 'gaming' | 'irl' | 'multi_speaker' | 'podcast' | 'unknown';

export interface SpeakerDetection {
  id: string;
  clip_id: string;
  time_offset: number;
  speaker_index: number;
  bbox_x: number;
  bbox_y: number;
  bbox_width: number;
  bbox_height: number;
  confidence: number;
  is_speaking: boolean;
  roll_angle?: number;
  pan_angle?: number;
  tilt_angle?: number;
  created_at: number;
}

export interface SpeakerSummary {
  id: string;
  clip_id: string;
  speaker_index: number;
  avg_x: number;
  avg_y: number;
  avg_width: number;
  avg_height: number;
  avg_confidence: number;
  detection_count: number;
  position_horizontal: string | null;
  position_vertical: string | null;
  movement_variance: number;
  first_seen: number | null;
  last_seen: number | null;
  created_at: number;
}

export interface FramingStrategy {
  id: string;
  clip_id: string;
  mode: FramingMode;
  video_type: VideoType;
  target_aspect_ratio: string;
  confidence: number;
  speaker_count: number;
  strategy_data: string | null; // JSON
  source_width: number | null;
  source_height: number | null;
  created_at: number;
  updated_at: number;
}

export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  output_height_ratio?: number;
}

export interface SplitLayout {
  type: string;
  top_region: CropRegion;
  bottom_region: CropRegion;
  split_ratio: number;
}

export interface PanKeyframe {
  timestamp: number;
  crop_x: number;
  crop_y: number;
  face_detected: boolean;
}

export interface ParsedStrategyData {
  mode: FramingMode;
  layout?: SplitLayout;
  keyframes?: PanKeyframe[];
  crop_region?: CropRegion;
  crop_center?: { x: number; y: number };
  ffmpeg_filter: string;
  speakers?: Array<{
    speaker_index: number;
    centroid: { x: number; y: number };
    confidence: number;
  }>;
  content_regions?: Array<{
    type: string;
    bbox: CropRegion;
    quadrant?: string;
    priority: string;
  }>;
}

// ============================================================================
// SPEAKER DETECTIONS
// ============================================================================

/**
 * Saves speaker detections for a clip to the database.
 */
export async function saveSpeakerDetections(
  clipId: string,
  detections: Omit<SpeakerDetection, 'id' | 'clip_id' | 'created_at'>[]
): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();

  for (const detection of detections) {
    await db.execute(
      `INSERT INTO speaker_detections 
       (id, clip_id, time_offset, speaker_index, bbox_x, bbox_y, bbox_width, bbox_height, 
        confidence, is_speaking, roll_angle, pan_angle, tilt_angle, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        generateId(),
        clipId,
        detection.time_offset,
        detection.speaker_index,
        detection.bbox_x,
        detection.bbox_y,
        detection.bbox_width,
        detection.bbox_height,
        detection.confidence,
        detection.is_speaking ? 1 : 0,
        detection.roll_angle ?? 0,
        detection.pan_angle ?? 0,
        detection.tilt_angle ?? 0,
        now,
      ]
    );
  }
}

/**
 * Gets all speaker detections for a clip.
 */
export async function getSpeakerDetectionsByClipId(clipId: string): Promise<SpeakerDetection[]> {
  const db = await getDatabase();
  const result = await db.select<SpeakerDetection[]>(
    `SELECT * FROM speaker_detections WHERE clip_id = ? ORDER BY time_offset, speaker_index`,
    [clipId]
  );
  return result.map((r) => ({
    ...r,
    is_speaking: Boolean(r.is_speaking),
  }));
}

/**
 * Deletes all speaker detections for a clip.
 */
export async function deleteSpeakerDetectionsByClipId(clipId: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(`DELETE FROM speaker_detections WHERE clip_id = ?`, [clipId]);
}

// ============================================================================
// SPEAKER SUMMARIES
// ============================================================================

/**
 * Saves speaker summary for a clip.
 */
export async function saveSpeakerSummary(
  clipId: string,
  summary: Omit<SpeakerSummary, 'id' | 'clip_id' | 'created_at'>
): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();

  await db.execute(
    `INSERT OR REPLACE INTO speaker_summaries 
     (id, clip_id, speaker_index, avg_x, avg_y, avg_width, avg_height, avg_confidence,
      detection_count, position_horizontal, position_vertical, movement_variance,
      first_seen, last_seen, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      generateId(),
      clipId,
      summary.speaker_index,
      summary.avg_x,
      summary.avg_y,
      summary.avg_width,
      summary.avg_height,
      summary.avg_confidence,
      summary.detection_count,
      summary.position_horizontal,
      summary.position_vertical,
      summary.movement_variance,
      summary.first_seen,
      summary.last_seen,
      now,
    ]
  );
}

/**
 * Gets speaker summaries for a clip.
 */
export async function getSpeakerSummariesByClipId(clipId: string): Promise<SpeakerSummary[]> {
  const db = await getDatabase();
  return await db.select<SpeakerSummary[]>(
    `SELECT * FROM speaker_summaries WHERE clip_id = ? ORDER BY speaker_index`,
    [clipId]
  );
}

// ============================================================================
// FRAMING STRATEGIES
// ============================================================================

/**
 * Saves or updates a framing strategy for a clip.
 */
export async function saveFramingStrategy(
  clipId: string,
  strategy: {
    mode: FramingMode;
    video_type: VideoType;
    target_aspect_ratio: string;
    confidence: number;
    speaker_count: number;
    strategy_data: ParsedStrategyData;
    source_width?: number;
    source_height?: number;
  }
): Promise<string> {
  const db = await getDatabase();
  const now = Date.now();
  const id = generateId();

  await db.execute(
    `INSERT OR REPLACE INTO framing_strategies 
     (id, clip_id, mode, video_type, target_aspect_ratio, confidence, speaker_count,
      strategy_data, source_width, source_height, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      clipId,
      strategy.mode,
      strategy.video_type,
      strategy.target_aspect_ratio,
      strategy.confidence,
      strategy.speaker_count,
      JSON.stringify(strategy.strategy_data),
      strategy.source_width ?? null,
      strategy.source_height ?? null,
      now,
      now,
    ]
  );

  return id;
}

/**
 * Gets the framing strategy for a clip.
 */
export async function getFramingStrategyByClipId(clipId: string): Promise<FramingStrategy | null> {
  const db = await getDatabase();
  const results = await db.select<FramingStrategy[]>(
    `SELECT * FROM framing_strategies WHERE clip_id = ?`,
    [clipId]
  );
  return results.length > 0 ? results[0] : null;
}

/**
 * Gets the framing strategy with parsed data.
 */
export async function getFramingStrategyWithData(clipId: string): Promise<{
  strategy: FramingStrategy;
  data: ParsedStrategyData;
} | null> {
  const strategy = await getFramingStrategyByClipId(clipId);
  if (!strategy) return null;

  let data: ParsedStrategyData;
  try {
    data = JSON.parse(strategy.strategy_data || '{}');
  } catch {
    data = {
      mode: strategy.mode,
      ffmpeg_filter: '',
    };
  }

  return { strategy, data };
}

/**
 * Deletes the framing strategy for a clip.
 */
export async function deleteFramingStrategyByClipId(clipId: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(`DELETE FROM framing_strategies WHERE clip_id = ?`, [clipId]);
}

/**
 * Gets all clips with a specific framing mode.
 */
export async function getClipsByFramingMode(mode: FramingMode): Promise<FramingStrategy[]> {
  const db = await getDatabase();
  return await db.select<FramingStrategy[]>(
    `SELECT * FROM framing_strategies WHERE mode = ? ORDER BY created_at DESC`,
    [mode]
  );
}

/**
 * Gets all clips with a specific video type.
 */
export async function getClipsByVideoType(videoType: VideoType): Promise<FramingStrategy[]> {
  const db = await getDatabase();
  return await db.select<FramingStrategy[]>(
    `SELECT * FROM framing_strategies WHERE video_type = ? ORDER BY created_at DESC`,
    [videoType]
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Clears all speaker detection data for a clip (detections, summaries, strategy).
 */
export async function clearAllSpeakerDataForClip(clipId: string): Promise<void> {
  await deleteSpeakerDetectionsByClipId(clipId);
  await deleteFramingStrategyByClipId(clipId);

  const db = await getDatabase();
  await db.execute(`DELETE FROM speaker_summaries WHERE clip_id = ?`, [clipId]);
}

/**
 * Checks if a clip has speaker detection data.
 */
export async function hasFramingStrategy(clipId: string): Promise<boolean> {
  const strategy = await getFramingStrategyByClipId(clipId);
  return strategy !== null;
}
