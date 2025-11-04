/**
 * Composable for managing video playhead positioning and tracking
 * Handles global playhead line positioning and updates
 */
import { ref, computed, watch, type Ref } from 'vue'
import { SELECTORS } from '../utils/timelineConstants'

export interface VideoPlayheadOptions {
  videoSrc: Ref<string | null>
  currentTime: Ref<number>
  duration: Ref<number>
  timelineContainer: Ref<HTMLElement | null>
}

export function useVideoPlayhead(options: VideoPlayheadOptions) {
  const { videoSrc, currentTime, duration, timelineContainer } = options

  // Global playhead state
  const globalPlayheadPosition = ref(0) // X position in pixels for the global playhead line
  const isPlayheadInitialized = ref(false) // Track if playhead has been properly initialized

  // Timeline bounds for constraining playhead
  const timelineBounds = ref({ top: 0, bottom: 0 })

  // Update global playhead position based on current time
  function updateGlobalPlayheadPosition() {
    if (!videoSrc.value || !duration.value || duration.value <= 0 || currentTime.value < 0) {
      return
    }

    const container = timelineContainer.value
    if (!container) return

    // Find the video track content element to use as positioning reference
    const videoTrack = container.querySelector(SELECTORS.VIDEO_TRACK) as HTMLElement
    if (!videoTrack) {
      // Video track doesn't exist yet, retry during initialization
      if (!isPlayheadInitialized.value) {
        requestAnimationFrame(() => {
          updateGlobalPlayheadPosition()
        })
      }
      return
    }

    // Calculate the time percentage
    const timePercent = currentTime.value / duration.value

    // Create a temporary div positioned at the time percentage within the video track
    const tempDiv = document.createElement('div')
    tempDiv.style.position = 'absolute'
    tempDiv.style.left = `${timePercent * 100}%`
    tempDiv.style.top = '0'
    tempDiv.style.width = '1px'
    tempDiv.style.height = '1px'
    tempDiv.style.pointerEvents = 'none'
    tempDiv.style.opacity = '0'

    videoTrack.appendChild(tempDiv)

    // Get the absolute position of this temp div
    const tempRect = tempDiv.getBoundingClientRect()
    const targetX = tempRect.left + tempRect.width / 2

    // Clean up
    videoTrack.removeChild(tempDiv)
    globalPlayheadPosition.value = targetX
    isPlayheadInitialized.value = true
  }

  // Initialize playhead with retry logic
  function initializePlayhead() {
    if (!timelineContainer.value) return

    const container = timelineContainer.value

    // Try positioning with increasing delays
    const tryPositioning = (delay: number) => {
      setTimeout(() => {
        const wasInitialized = isPlayheadInitialized.value
        updateGlobalPlayheadPosition()

        // If still not initialized after this attempt, try again with longer delay
        if (!isPlayheadInitialized.value && !wasInitialized && delay < 1000) {
          tryPositioning(delay * 2)
        }
      }, delay)
    }

    // Start with 200ms delay but also check if container height is stable
    const checkHeightAndPosition = (delay: number) => {
      setTimeout(() => {
        const currentRect = container.getBoundingClientRect()
        const expectedMinHeight = 300 // Timeline should be at least 300px tall when fully rendered

        if (currentRect.height < expectedMinHeight && delay < 1000) {
          // Container is still expanding, wait longer
          checkHeightAndPosition(delay * 2)
          return
        }

        tryPositioning(delay)
      }, delay)
    }

    // Start with 200ms delay
    checkHeightAndPosition(200)
  }

  // Update timeline bounds
  function updateTimelineBounds() {
    if (timelineContainer.value) {
      const rect = timelineContainer.value.getBoundingClientRect()
      timelineBounds.value = {
        top: rect.top,
        bottom: rect.bottom
      }
    }
  }

  // Watch for changes that affect global playhead position
  watch(
    [() => currentTime.value, () => duration.value, () => videoSrc.value],
    () => {
      updateGlobalPlayheadPosition()
    },
    { immediate: true }
  )

  // Computed for playhead visibility
  const shouldShowPlayhead = computed(() => {
    return videoSrc.value && duration.value && duration.value > 0
  })

  // Create synthetic playhead event for testing/debugging
  function createPlayheadTestEvent(): MouseEvent | null {
    if (!timelineContainer.value || !duration.value || duration.value <= 0) return null

    const container = timelineContainer.value
    const videoTrack = container.querySelector(SELECTORS.VIDEO_TRACK) as HTMLElement
    if (!videoTrack) return null

    const timePercent = currentTime.value / duration.value
    const videoTrackRect = videoTrack.getBoundingClientRect()
    const targetX = videoTrackRect.left + (videoTrackRect.width * timePercent)

    return new MouseEvent('mousemove', {
      clientX: targetX,
      clientY: videoTrackRect.top + videoTrackRect.height / 2,
      bubbles: true,
      cancelable: true
    })
  }

  return {
    // State
    globalPlayheadPosition,
    isPlayheadInitialized,
    timelineBounds,
    shouldShowPlayhead,

    // Methods
    updateGlobalPlayheadPosition,
    initializePlayhead,
    updateTimelineBounds,
    createPlayheadTestEvent
  }
}