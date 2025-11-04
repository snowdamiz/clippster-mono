/**
 * Timeline movement and resize constraint utilities
 */

import { ClipSegment } from './timelineUtils'
import { ClipSegment as DatabaseClipSegment } from '../services/database'
import { TIMELINE_CONSTANTS } from '../constants/timelineConstants'


export interface MovementConstraints {
  minStartTime: number
  maxEndTime: number
}

export interface ResizeConstraints {
  minStartTime: number
  maxEndTime: number
}

/**
 * Calculate movement constraints for a segment
 */
export function calculateMovementConstraints(
  segmentDuration: number,
  adjacentPrevious: DatabaseClipSegment | null,
  adjacentNext: DatabaseClipSegment | null,
  videoDuration: number
): MovementConstraints {
  let minStartTime = 0
  let maxEndTime = videoDuration || Infinity

  // Can't go past previous segment's end time
  if (adjacentPrevious) {
    minStartTime = adjacentPrevious.end_time
  }

  // Can't go past next segment's start time
  if (adjacentNext) {
    maxEndTime = adjacentNext.start_time
  }

  // IMPORTANT: Ensure we have enough space for the original duration
  // If the maxEndTime doesn't allow the original duration, we need to adjust it
  if (maxEndTime < minStartTime + segmentDuration) {
    maxEndTime = minStartTime + segmentDuration
  }

  return {
    minStartTime,
    maxEndTime
  }
}

/**
 * Calculate resize constraints for a segment
 */
export function calculateResizeConstraints(
  handleType: 'left' | 'right',
  currentSegment: ClipSegment,
  adjacentPrevious: DatabaseClipSegment | null,
  adjacentNext: DatabaseClipSegment | null,
  videoDuration: number
): ResizeConstraints {
  let minStartTime = 0
  let maxEndTime = videoDuration || Infinity

  // Can't go past previous segment's end time
  if (adjacentPrevious) {
    minStartTime = adjacentPrevious.end_time
  }

  // Can't go past next segment's start time
  if (adjacentNext) {
    maxEndTime = adjacentNext.start_time
  }

  // For left handle, we need to consider the current segment's end_time
  // For right handle, we need to consider the current segment's start_time
  if (handleType === 'left') {
    // Left handle can't go past current end_time - minimum duration
    maxEndTime = Math.min(maxEndTime, currentSegment.end_time - TIMELINE_CONSTANTS.MIN_SEGMENT_DURATION)
  } else {
    // Right handle can't go before current start_time + minimum duration
    minStartTime = Math.max(minStartTime, currentSegment.start_time + TIMELINE_CONSTANTS.MIN_SEGMENT_DURATION)
  }

  return { minStartTime, maxEndTime }
}

/**
 * Apply constraints to movement calculations
 */
export function applyMovementConstraints(
  newStartTime: number,
  newEndTime: number,
  originalDuration: number,
  constraints: MovementConstraints,
  videoDuration: number
): { startTime: number; endTime: number } {
  let startTime = newStartTime
  let endTime = newEndTime

  // Apply constraints that prevent shrinking
  if (startTime < constraints.minStartTime) {
    // Moving left would violate constraint, stop at boundary
    startTime = constraints.minStartTime
    endTime = startTime + originalDuration
  } else if (endTime > constraints.maxEndTime) {
    // Moving right would violate constraint, stop at boundary
    endTime = constraints.maxEndTime
    startTime = endTime - originalDuration
  }

  // Also ensure we stay within video bounds while preserving duration
  if (startTime < 0) {
    startTime = 0
    endTime = Math.min(originalDuration, videoDuration)
  } else if (endTime > videoDuration) {
    endTime = videoDuration
    startTime = Math.max(videoDuration - originalDuration, 0)
  }

  // Final check: if we still can't maintain original duration, don't move at all
  if (endTime - startTime < originalDuration * 0.99) { // Allow tiny floating point errors
    // Revert to original position - constraint hit, can't move further in this direction
    startTime = constraints.minStartTime // This will be handled by caller
    endTime = startTime + originalDuration
  }

  return { startTime, endTime }
}

/**
 * Apply constraints to resize calculations
 */
export function applyResizeConstraints(
  newStartTime: number,
  newEndTime: number,
  handleType: 'left' | 'right',
  constraints: ResizeConstraints
): { startTime: number; endTime: number } {
  let startTime = newStartTime
  let endTime = newEndTime

  if (handleType === 'left') {
    // Resize left handle: change start_time, keep end_time fixed
    startTime = newStartTime

    // Apply constraints
    startTime = Math.max(constraints.minStartTime, startTime)
    startTime = Math.min(constraints.maxEndTime, startTime)

    // Ensure minimum duration
    if (endTime - startTime < TIMELINE_CONSTANTS.MIN_SEGMENT_DURATION) {
      startTime = endTime - TIMELINE_CONSTANTS.MIN_SEGMENT_DURATION
    }
  } else {
    // Resize right handle: change end_time, keep start_time fixed
    endTime = newEndTime

    // Apply constraints
    endTime = Math.max(constraints.minStartTime, endTime)
    endTime = Math.min(constraints.maxEndTime, endTime)

    // Ensure minimum duration
    if (endTime - startTime < TIMELINE_CONSTANTS.MIN_SEGMENT_DURATION) {
      endTime = startTime + TIMELINE_CONSTANTS.MIN_SEGMENT_DURATION
    }
  }

  return { startTime, endTime }
}