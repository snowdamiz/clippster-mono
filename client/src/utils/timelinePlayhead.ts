/**
 * Timeline playhead utilities
 */

export interface TimelineBounds {
  top: number
  bottom: number
}

/**
 * Calculate the position of a temporary div at a specific time percentage
 */
export function createTempDivAtTime(
  videoTrack: HTMLElement,
  timePercent: number
): HTMLDivElement {
  const tempDiv = document.createElement('div')
  tempDiv.style.position = 'absolute'
  tempDiv.style.left = `${timePercent * 100}%`
  tempDiv.style.top = '0'
  tempDiv.style.width = '1px'
  tempDiv.style.height = '1px'
  tempDiv.style.pointerEvents = 'none'
  tempDiv.style.opacity = '0'

  videoTrack.appendChild(tempDiv)
  return tempDiv
}

/**
 * Get the absolute X position for a given time percentage
 */
export function getXPositionAtTime(
  videoTrack: HTMLElement,
  timePercent: number
): number {
  const tempDiv = createTempDivAtTime(videoTrack, timePercent)

  // Get the absolute position of this temp div
  const tempRect = tempDiv.getBoundingClientRect()
  const targetX = tempRect.left + tempRect.width / 2

  // Clean up
  videoTrack.removeChild(tempDiv)

  return targetX
}

/**
 * Calculate time percentage from current time and duration
 */
export function calculateTimePercent(currentTime: number, duration: number): number {
  if (!duration || duration <= 0 || currentTime < 0) return 0
  return Math.min(1, Math.max(0, currentTime / duration))
}

/**
 * Validate if playhead can be positioned
 */
export function canPositionPlayhead(
  videoSrc: string | null,
  duration: number,
  currentTime: number
): boolean {
  return !!(videoSrc && duration && duration > 0 && currentTime >= 0)
}