/**
 * Timeline cut tool utilities
 */

import { ClipSegment } from './timelineUtils'
import { getSegmentDisplayTime } from './timelineUtils'
import { TIMELINE_CONSTANTS } from '../constants/timelineConstants'

export interface CutHoverInfo {
  clipId: string
  segmentIndex: number
  cutTime: number
  cutPosition: number // percentage (0-100)
  cursorPosition: number // percentage (0-100) for custom cursor position
}

/**
 * Calculate cut position and time for a segment
 */
export function calculateCutPosition(
  event: MouseEvent,
  segmentElement: HTMLElement,
  segment: ClipSegment,
  duration: number
): CutHoverInfo | null {
  const rect = segmentElement.getBoundingClientRect()
  const relativeX = event.clientX - rect.left
  const segmentWidth = rect.width

  // Calculate the cut position as a percentage within the segment
  const cutPositionPercent = (relativeX / segmentWidth) * 100

  // Calculate the actual cut time within the video
  const segmentStartTime = getSegmentDisplayTime(segment, 'start')
  const segmentEndTime = getSegmentDisplayTime(segment, 'end')
  const segmentDuration = segmentEndTime - segmentStartTime
  const cutTime = segmentStartTime + (segmentDuration * cutPositionPercent / 100)

  // Validate minimum segment durations
  const leftDuration = cutTime - segmentStartTime
  const rightDuration = segmentEndTime - cutTime

  if (leftDuration >= TIMELINE_CONSTANTS.MIN_SEGMENT_DURATION &&
      rightDuration >= TIMELINE_CONSTANTS.MIN_SEGMENT_DURATION) {
    return {
      clipId: '', // Will be set by caller
      segmentIndex: 0, // Will be set by caller
      cutTime,
      cutPosition: cutPositionPercent,
      cursorPosition: cutPositionPercent
    }
  }

  return null
}

/**
 * Create cut hover info with clip and segment details
 */
export function createCutHoverInfo(
  event: MouseEvent,
  segmentElement: HTMLElement,
  segment: ClipSegment,
  duration: number,
  clipId: string,
  segmentIndex: number
): CutHoverInfo | null {
  const cutInfo = calculateCutPosition(event, segmentElement, segment, duration)

  if (cutInfo) {
    return {
      ...cutInfo,
      clipId,
      segmentIndex
    }
  }

  return null
}