/**
 * Composable for managing timeline interactions: zoom, pan, and drag selection
 * Handles user interactions with the timeline content area
 */
import { ref, nextTick, type Ref } from 'vue'

export interface DragSelectionState {
  isDragging: boolean
  dragStartX: number
  dragEndX: number
  dragStartPercent: number
  dragEndPercent: number
}

export interface PanState {
  isPanning: boolean
  panStartX: number
  panScrollLeft: number
}

export interface ZoomState {
  zoomLevel: number
  minZoom: number
  maxZoom: number
  zoomStep: number
}

export interface TimelineInteractionOptions {
  minZoom?: number
  maxZoom?: number
  zoomStep?: number
  onZoomChange?: (zoomLevel: number) => void
  onDragSelection?: (startPercent: number, endPercent: number) => void
}

export function useTimelineInteraction(
  timelineContainer: Ref<HTMLElement | null>,
  duration: Ref<number>,
  options: TimelineInteractionOptions = {}
) {
  const { minZoom = 1.0, maxZoom = 10.0, zoomStep = 0.1, onZoomChange, onDragSelection } = options

  // Zoom state
  const zoomState = ref<ZoomState>({
    zoomLevel: 1.0,
    minZoom,
    maxZoom,
    zoomStep
  })

  // Pan state
  const panState = ref<PanState>({
    isPanning: false,
    panStartX: 0,
    panScrollLeft: 0
  })

  // Drag selection state
  const dragSelectionState = ref<DragSelectionState>({
    isDragging: false,
    dragStartX: 0,
    dragEndX: 0,
    dragStartPercent: 0,
    dragEndPercent: 0
  })

  // Timeline bounds for constraining interactions
  const timelineBounds = ref({ top: 0, bottom: 0 })

  // Zoom functions
  function setZoomLevel(newZoom: number) {
    const clampedZoom = Math.max(minZoom, Math.min(maxZoom, newZoom))
    zoomState.value.zoomLevel = clampedZoom
    onZoomChange?.(clampedZoom)
  }

  // Zoom handler for timeline ruler wheel
  function handleRulerWheel(event: WheelEvent) {
    event.preventDefault()

    if (!timelineContainer.value) return

    // Determine zoom direction
    const delta = event.deltaY > 0 ? -zoomStep : zoomStep
    const newZoom = Math.max(minZoom, Math.min(maxZoom, zoomState.value.zoomLevel + delta))

    // Get current hover position as a percentage of the visible timeline
    const container = timelineContainer.value
    const timelineContent = container?.querySelector('.timeline-content-wrapper')
    if (container && timelineContent) {
      const contentRect = timelineContent.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      const relativeX = event.clientX - containerRect.left

      // Calculate the timeline position being hovered over
      const currentScrollLeft = container.scrollLeft
      const currentContentWidth = contentRect.width
      const hoveredTimelinePosition = currentScrollLeft + relativeX
      const hoveredPercentOfContent = Math.max(
        0,
        Math.min(1, hoveredTimelinePosition / currentContentWidth)
      )

      // Update zoom level
      setZoomLevel(newZoom)

      // Wait for DOM to update, then calculate new scroll position
      nextTick(() => {
        if (container && timelineContent) {
          const newContentRect = timelineContent.getBoundingClientRect()
          const newContentWidth = newContentRect.width

          // Calculate new scroll position to keep the same content position under cursor
          const newScrollLeft = hoveredPercentOfContent * newContentWidth - relativeX

          // Apply smooth scrolling to new position
          container.scrollLeft = Math.max(0, newScrollLeft)
        }
      })
    } else {
      // Fallback: just update zoom level
      setZoomLevel(newZoom)
    }
  }

  // Update slider progress background (for zoom slider)
  function updateSliderProgress(sliderElement: HTMLInputElement | null) {
    if (sliderElement) {
      const percentage = ((zoomState.value.zoomLevel - minZoom) / (maxZoom - minZoom)) * 100
      const background = `linear-gradient(to right,
        rgba(255, 255, 255, 0.6) 0%,
        rgba(255, 255, 255, 0.6) ${percentage}%,
        rgba(255, 255, 255, 0.2) ${percentage}%,
        rgba(255, 255, 255, 0.2) 100%)`
      sliderElement.style.background = background
    }
  }

  // Pan handlers
  function startPan(event: MouseEvent) {
    // Only pan with left mouse button
    if (event.button !== 0) return

    panState.value.isPanning = true
    panState.value.panStartX = event.clientX
    panState.value.panScrollLeft = timelineContainer.value?.scrollLeft || 0

    // Change cursor to indicate panning
    document.body.style.cursor = 'grabbing'
    event.preventDefault()
  }

  function movePan(event: MouseEvent) {
    if (!panState.value.isPanning || !timelineContainer.value) return

    event.preventDefault()

    const deltaX = event.clientX - panState.value.panStartX
    const newScrollLeft = panState.value.panScrollLeft - deltaX

    timelineContainer.value.scrollLeft = newScrollLeft
  }

  function endPan() {
    if (panState.value.isPanning) {
      panState.value.isPanning = false
      // Reset cursor
      document.body.style.cursor = ''
    }
  }

  // Drag selection handlers
  function startDragSelection(event: MouseEvent) {
    // Only start drag with left mouse button and not on clips
    if (
      event.button !== 0 ||
      (event.target instanceof HTMLElement && event.target.closest('.clip-segment'))
    ) {
      return
    }

    const container = timelineContainer.value
    if (!container) return

    const rect = container.getBoundingClientRect()
    const relativeX = event.clientX - rect.left

    // Only allow drag selection in timeline content area (after track labels)
    const trackLabelWidth = 64 // 4rem = 64px (w-16)
    if (relativeX < trackLabelWidth) return

    // Initialize drag selection
    dragSelectionState.value.isDragging = true
    dragSelectionState.value.dragStartX = event.clientX
    dragSelectionState.value.dragEndX = event.clientX

    // Calculate percentages relative to the zoomed timeline content
    const timelineContent = container.querySelector('.timeline-content-wrapper')
    if (timelineContent) {
      const contentRect = timelineContent.getBoundingClientRect()
      const contentRelativeX = event.clientX - contentRect.left
      dragSelectionState.value.dragStartPercent = Math.max(
        0,
        Math.min(1, contentRelativeX / contentRect.width)
      )
      dragSelectionState.value.dragEndPercent = dragSelectionState.value.dragStartPercent
    }

    // Update timeline bounds for selection area
    timelineBounds.value = {
      top: rect.top,
      bottom: rect.bottom
    }

    event.preventDefault()
  }

  function moveDragSelection(event: MouseEvent) {
    if (!dragSelectionState.value.isDragging || !timelineContainer.value) return

    dragSelectionState.value.dragEndX = event.clientX

    const container = timelineContainer.value
    if (!container) return

    // Update end percentage based on current mouse position
    const timelineContent = container.querySelector('.timeline-content-wrapper')
    if (timelineContent) {
      const contentRect = timelineContent.getBoundingClientRect()
      const contentRelativeX = event.clientX - contentRect.left
      dragSelectionState.value.dragEndPercent = Math.max(
        0,
        Math.min(1, contentRelativeX / contentRect.width)
      )
    }

    event.preventDefault()
  }

  function endDragSelection() {
    if (!dragSelectionState.value.isDragging) return

    // Calculate the selected time range
    const startPercent = Math.min(
      dragSelectionState.value.dragStartPercent,
      dragSelectionState.value.dragEndPercent
    )
    const endPercent = Math.max(
      dragSelectionState.value.dragStartPercent,
      dragSelectionState.value.dragEndPercent
    )
    const selectionDuration = endPercent - startPercent

    // Only zoom if the selection is meaningful (at least 5% of timeline)
    if (selectionDuration >= 0.05 && duration.value > 0) {
      // Calculate new zoom level to fit the selection
      const targetZoom = Math.min(maxZoom, Math.max(minZoom, 1.0 / selectionDuration))

      // Update zoom level first
      setZoomLevel(targetZoom)

      // Wait for the zoom to be applied and DOM to update, then set scroll position
      nextTick(() => {
        if (timelineContainer.value) {
          const container = timelineContainer.value
          const timelineContent = container.querySelector('.timeline-content-wrapper')
          if (timelineContent) {
            const contentWidth = container.scrollWidth // This will be updated after zoom
            const containerWidth = container.clientWidth
            const maxScrollLeft = contentWidth - containerWidth

            // Calculate the position of the selection in the zoomed content
            const selectionStartPositionInContent = startPercent * contentWidth
            const selectionWidthInContent = selectionDuration * contentWidth

            // Calculate the target scroll position to show the selection
            let targetScrollLeft: number
            if (selectionWidthInContent >= containerWidth) {
              // Selection is wider than container, show it starting from left
              targetScrollLeft = Math.max(
                0,
                Math.min(maxScrollLeft, selectionStartPositionInContent - 20)
              ) // 20px padding
            } else {
              // Center the selection in the viewport
              const centerOfSelection =
                selectionStartPositionInContent + selectionWidthInContent / 2
              targetScrollLeft = Math.max(
                0,
                Math.min(maxScrollLeft, centerOfSelection - containerWidth / 2)
              )
            }

            container.scrollLeft = targetScrollLeft
          }
        }
      })

      onDragSelection?.(startPercent, endPercent)
    }

    // Reset drag state
    dragSelectionState.value.isDragging = false
    dragSelectionState.value.dragStartX = 0
    dragSelectionState.value.dragEndX = 0
    dragSelectionState.value.dragStartPercent = 0
    dragSelectionState.value.dragEndPercent = 0
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

  // Set timeline bounds only when timeline is stable (to be called from parent)
  function setTimelineBoundsWhenStable(top: number, bottom: number) {
    timelineBounds.value = { top, bottom }
  }

  return {
    // State
    zoomState,
    panState,
    dragSelectionState,
    timelineBounds,

    // Zoom functions
    setZoomLevel,
    handleRulerWheel,
    updateSliderProgress,

    // Pan functions
    startPan,
    movePan,
    endPan,

    // Drag selection functions
    startDragSelection,
    moveDragSelection,
    endDragSelection,

    // Utility functions
    updateTimelineBounds,
    setTimelineBoundsWhenStable
  }
}
