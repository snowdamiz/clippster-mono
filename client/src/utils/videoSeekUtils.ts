/**
 * Video seek utility functions extracted from Timeline.vue
 * These are pure functions that handle video seeking operations
 */

// Seek video by specified number of seconds
export function seekVideoBySeconds(
  currentTime: number,
  duration: number,
  seconds: number
): number {
  if (!duration || duration <= 0) return currentTime
  return Math.max(0, Math.min(duration, currentTime + seconds))
}

// Create a synthetic mouse event for seeking to a specific time
export function createSeekEvent(
  targetTime: number,
  duration: number,
  videoTrackElement: HTMLElement | null
): MouseEvent | null {
  if (!videoTrackElement || !duration || duration <= 0) return null

  const videoTrackRect = videoTrackElement.getBoundingClientRect()
  const targetX = videoTrackRect.left + (videoTrackRect.width * (targetTime / duration))

  // Create a proper synthetic event
  const syntheticEvent = new MouseEvent('click', {
    clientX: targetX,
    clientY: videoTrackRect.top + videoTrackRect.height / 2,
    bubbles: true,
    cancelable: true
  })

  // Set currentTarget and target properties
  Object.defineProperty(syntheticEvent, 'currentTarget', {
    value: videoTrackElement,
    writable: false
  })
  Object.defineProperty(syntheticEvent, 'target', {
    value: videoTrackElement,
    writable: false
  })

  return syntheticEvent
}