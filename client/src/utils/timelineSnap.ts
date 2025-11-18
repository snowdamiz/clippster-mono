/**
 * Timeline snap utilities
 */

import { getXPositionAtTime, calculateTimePercent } from './timelinePlayhead';
import { TIMELINE_CONSTANTS } from '../constants/timelineConstants';

export interface SnapInfo {
  shouldSnap: boolean;
  snappedTime?: number;
  snapDistance?: number;
}

/**
 * Check if a time position should snap to the playhead position
 * @param targetTime - The time we want to check for snapping
 * @param playheadTime - The current playhead time
 * @param duration - Total duration of the timeline
 * @param videoTrack - The video track element for positioning calculations
 * @returns SnapInfo indicating if snapping should occur and the snapped time
 */
export function checkSnapToPlayhead(
  targetTime: number,
  playheadTime: number,
  duration: number,
  videoTrack: HTMLElement
): SnapInfo {
  if (!TIMELINE_CONSTANTS.SNAP_ENABLED || !videoTrack || duration <= 0) {
    return { shouldSnap: false };
  }

  // Get absolute X positions for both times
  const targetX = getXPositionAtTime(videoTrack, calculateTimePercent(targetTime, duration));
  const playheadX = getXPositionAtTime(videoTrack, calculateTimePercent(playheadTime, duration));

  // Calculate pixel distance
  const distance = Math.abs(targetX - playheadX);

  // Check if within snap threshold
  if (distance <= TIMELINE_CONSTANTS.SNAP_THRESHOLD) {
    return {
      shouldSnap: true,
      snappedTime: playheadTime,
      snapDistance: distance,
    };
  }

  return { shouldSnap: false };
}

/**
 * Apply snapping to segment times during drag operations
 * @param startTime - Current segment start time
 * @param endTime - Current segment end time
 * @param playheadTime - Current playhead time
 * @param duration - Total duration
 * @param videoTrack - Video track element
 * @returns Object with potentially snapped start and end times
 */
export function applySnapToSegment(
  startTime: number,
  endTime: number,
  playheadTime: number,
  duration: number,
  videoTrack: HTMLElement
): { startTime: number; endTime: number; didSnap: boolean } {
  if (!TIMELINE_CONSTANTS.SNAP_ENABLED) {
    return { startTime, endTime, didSnap: false };
  }

  let didSnap = false;

  // Check start time for snapping
  const startSnap = checkSnapToPlayhead(startTime, playheadTime, duration, videoTrack);
  if (startSnap.shouldSnap && startSnap.snappedTime !== undefined) {
    startTime = startSnap.snappedTime;
    didSnap = true;
  }

  // Check end time for snapping
  const endSnap = checkSnapToPlayhead(endTime, playheadTime, duration, videoTrack);
  if (endSnap.shouldSnap && endSnap.snappedTime !== undefined) {
    endTime = endSnap.snappedTime;
    didSnap = true;
  }

  return { startTime, endTime, didSnap };
}

/**
 * Apply snapping to a single time position (for resize operations)
 * @param targetTime - The time being adjusted
 * @param playheadTime - Current playhead time
 * @param duration - Total duration
 * @param videoTrack - Video track element
 * @returns Object with potentially snapped time
 */
export function applySnapToTime(
  targetTime: number,
  playheadTime: number,
  duration: number,
  videoTrack: HTMLElement
): { time: number; didSnap: boolean } {
  if (!TIMELINE_CONSTANTS.SNAP_ENABLED) {
    return { time: targetTime, didSnap: false };
  }

  const snap = checkSnapToPlayhead(targetTime, playheadTime, duration, videoTrack);

  if (snap.shouldSnap && snap.snappedTime !== undefined) {
    return { time: snap.snappedTime, didSnap: true };
  }

  return { time: targetTime, didSnap: false };
}
