/**
 * Composable for managing continuous video seeking operations
 * Handles keyboard and button-based seeking with visual feedback
 */
import { ref, type Ref } from 'vue'
import { SEEKING_CONFIG } from '../utils/timelineConstants'

export interface ContinuousSeekingOptions {
  videoSrc: Ref<string | null>
  duration: Ref<number>
  onSeekVideo: (seconds: number) => void
}

export function useContinuousSeeking(options: ContinuousSeekingOptions) {
  const { videoSrc, duration, onSeekVideo } = options

  // Continuous seeking state
  const isSeeking = ref(false)
  const seekDirection = ref<'forward' | 'reverse' | null>(null)
  const seekInterval = ref<NodeJS.Timeout | null>(null)

  // Start continuous seeking
  function startContinuousSeeking(direction: 'forward' | 'reverse') {
    if (!videoSrc.value || !duration.value) return

    isSeeking.value = true
    seekDirection.value = direction

    // Start continuous seeking at high speed immediately (no initial jump)
    seekInterval.value = setInterval(() => {
      const seekAmount = seekDirection.value === 'forward'
        ? SEEKING_CONFIG.SECONDS_PER_INTERVAL
        : -SEEKING_CONFIG.SECONDS_PER_INTERVAL
      onSeekVideo(seekAmount)
    }, SEEKING_CONFIG.INTERVAL_MS)
  }

  // Stop continuous seeking
  function stopContinuousSeeking() {
    if (seekInterval.value) {
      clearInterval(seekInterval.value)
      seekInterval.value = null
    }

    isSeeking.value = false
    seekDirection.value = null
  }

  // Handle keyboard events for seeking
  function handleKeyDown(event: KeyboardEvent) {
    // Don't handle keyboard events if user is typing in input fields
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return
    }

    // Video navigation with arrow keys (continuous seeking)
    if (videoSrc.value && duration.value) {
      if (event.key === 'ArrowLeft' && !isSeeking.value) {
        event.preventDefault()
        startContinuousSeeking('reverse')
      } else if (event.key === 'ArrowRight' && !isSeeking.value) {
        event.preventDefault()
        startContinuousSeeking('forward')
      }
    }
  }

  // Handle keyboard key up events
  function handleKeyUp(event: KeyboardEvent) {
    // Don't handle keyboard events if user is typing in input fields
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return
    }

    // Stop continuous seeking when arrow keys are released
    if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && isSeeking.value) {
      event.preventDefault()
      stopContinuousSeeking()
    }
  }

  // Cleanup function
  function cleanup() {
    stopContinuousSeeking()
  }

  return {
    // State
    isSeeking,
    seekDirection,

    // Methods
    startContinuousSeeking,
    stopContinuousSeeking,
    handleKeyDown,
    handleKeyUp,
    cleanup
  }
}