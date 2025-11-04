/**
 * Video seek utility functions extracted from Timeline.vue
 * These are pure functions that handle video seeking operations
 */

// Seek video by specified number of seconds
export function seekVideoBySeconds(currentTime: number, duration: number, seconds: number): number {
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

  // Calculate position relative to the video track element (not absolute)
  const relativeX = videoTrackRect.width * (targetTime / duration)
  const targetX = videoTrackRect.left + relativeX

  console.log('[createSeekEvent] targetTime:', targetTime, 'duration:', duration)
  console.log('[createSeekEvent] videoTrackRect.width:', videoTrackRect.width)
  console.log('[createSeekEvent] relativeX:', relativeX, 'targetX:', targetX)

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
