/**
 * Composable for managing segment manipulation operations on the timeline
 * Handles dragging, resizing, cutting of clip segments
 */
import { ref, computed, type Ref } from 'vue';
import {
  updateClipSegment,
  getAdjacentClipSegments,
  realignClipSegment,
  splitClipSegment,
} from '../services/database';
import { TRACK_DIMENSIONS, CUT_CONFIG, SELECTORS } from '../utils/timelineConstants';
import { debounce, getSegmentDisplayTime, type ClipSegment } from '../utils/timelineUtils';

export interface DraggedSegmentInfo {
  clipId: string;
  segmentIndex: number;
  originalStartTime: number;
  originalEndTime: number;
  originalMouseX: number;
  dragStartTime: number;
  currentStartTime: number;
  currentEndTime: number;
  tooltipX?: number;
  tooltipY?: number;
}

export interface ResizeHandleInfo {
  clipId: string;
  segmentIndex: number;
  handleType: 'left' | 'right';
  originalStartTime: number;
  originalEndTime: number;
  originalMouseX: number;
  resizeStartTime: number;
  currentStartTime: number;
  currentEndTime: number;
  minStartTime: number;
  maxEndTime: number;
  tooltipX?: number;
  tooltipY?: number;
}

export interface CutHoverInfo {
  clipId: string;
  segmentIndex: number;
  cutTime: number;
  cutPosition: number; // percentage (0-100)
  cursorPosition: number; // percentage (0-100) for custom cursor position
}

export interface SegmentManipulationOptions {
  duration: Ref<number>;
  zoomLevel: Ref<number>;
  timelineContainer: Ref<HTMLElement | null>;
  onSegmentUpdated?: (
    clipId: string,
    segmentIndex: number,
    newStartTime: number,
    newEndTime: number
  ) => void;
  onRefreshClipsData?: () => void;
}

export function useSegmentManipulation(options: SegmentManipulationOptions) {
  const { duration, zoomLevel, timelineContainer, onSegmentUpdated, onRefreshClipsData } = options;

  // Local reactive copy of clips for immediate visual updates
  const localClips = ref<any[]>([]);

  // Segment hover state
  const hoveredSegmentKey = ref<string | null>(null);

  // Segment dragging state
  const isDraggingSegment = ref(false);
  const draggedSegmentInfo = ref<DraggedSegmentInfo | null>(null);

  // Segment resizing state
  const isResizingSegment = ref(false);
  const resizeHandleInfo = ref<ResizeHandleInfo | null>(null);

  // Cut tool state
  const isCutToolActive = ref(false);
  const cutHoverInfo = ref<CutHoverInfo | null>(null);

  // Movement constraints
  const movementConstraints = ref({
    minStartTime: 0,
    maxEndTime: Infinity,
  });

  // Debounced database update function for smoother performance
  const debouncedUpdateClip = debounce(
    async (clipId: string, segmentIndex: number, newStartTime: number, newEndTime: number) => {
      try {
        await updateClipSegment(clipId, segmentIndex, newStartTime, newEndTime);

        // Update local clip data for immediate visual feedback
        const clipIndex = localClips.value.findIndex((clip) => clip.id === clipId);
        if (clipIndex !== -1 && localClips.value[clipIndex].segments[segmentIndex]) {
          // Create a new clips array to trigger reactivity
          const updatedClips = [...localClips.value];
          updatedClips[clipIndex] = {
            ...updatedClips[clipIndex],
            segments: [...updatedClips[clipIndex].segments],
          };
          updatedClips[clipIndex].segments[segmentIndex] = {
            ...updatedClips[clipIndex].segments[segmentIndex],
            start_time: newStartTime,
            end_time: newEndTime,
            duration: newEndTime - newStartTime,
          };
          localClips.value = updatedClips;
        }
      } catch (error) {
        console.error('Error updating clip segment:', error);
      }
    },
    TRACK_DIMENSIONS.DEBOUNCE_DELAY
  );

  // Computed clips that updates during dragging or resizing
  const displayClips = computed(() => {
    let clips = [...localClips.value];

    // Handle dragging
    if (isDraggingSegment.value && draggedSegmentInfo.value) {
      const { clipId, segmentIndex, currentStartTime, currentEndTime } = draggedSegmentInfo.value;
      const clipIndex = clips.findIndex((clip) => clip.id === clipId);
      if (clipIndex !== -1 && clips[clipIndex].segments[segmentIndex]) {
        clips = [...clips];
        clips[clipIndex] = {
          ...clips[clipIndex],
          segments: [...clips[clipIndex].segments],
        };
        clips[clipIndex].segments[segmentIndex] = {
          ...clips[clipIndex].segments[segmentIndex],
          start_time: currentStartTime,
          end_time: currentEndTime,
          duration: currentEndTime - currentStartTime,
        };
      }
    }

    // Handle resizing
    if (isResizingSegment.value && resizeHandleInfo.value) {
      const { clipId, segmentIndex, currentStartTime, currentEndTime } = resizeHandleInfo.value;
      const clipIndex = clips.findIndex((clip) => clip.id === clipId);
      if (clipIndex !== -1 && clips[clipIndex].segments[segmentIndex]) {
        clips = [...clips];
        clips[clipIndex] = {
          ...clips[clipIndex],
          segments: [...clips[clipIndex].segments],
        };
        clips[clipIndex].segments[segmentIndex] = {
          ...clips[clipIndex].segments[segmentIndex],
          start_time: currentStartTime,
          end_time: currentEndTime,
          duration: currentEndTime - currentStartTime,
        };
      }
    }

    return clips;
  });

  // Update local clips
  function setLocalClips(clips: any[]) {
    localClips.value = [...clips];
  }

  // Calculate movement constraints for a segment
  async function calculateMovementConstraints(clipId: string, segmentIndex: number): Promise<void> {
    try {
      const adjacent = await getAdjacentClipSegments(clipId, segmentIndex);

      let minStartTime = 0;
      let maxEndTime = duration.value || Infinity;

      // Can't go past previous segment's end time
      if (adjacent.previous) {
        minStartTime = adjacent.previous.end_time;
      }

      // Can't go past next segment's start time
      if (adjacent.next) {
        maxEndTime = adjacent.next.start_time;
      }

      // Get original duration from the dragged segment info
      const originalDuration =
        (draggedSegmentInfo.value?.originalEndTime || 0) -
          (draggedSegmentInfo.value?.originalStartTime || 0) || 0;

      // IMPORTANT: Ensure we have enough space for the original duration
      if (maxEndTime < minStartTime + originalDuration) {
        maxEndTime = minStartTime + originalDuration;
      }

      movementConstraints.value = {
        minStartTime,
        maxEndTime,
      };
    } catch (error) {
      console.error('Error calculating movement constraints:', error);
      movementConstraints.value = {
        minStartTime: 0,
        maxEndTime: duration.value || Infinity,
      };
    }
  }

  // Calculate resize constraints for a segment
  async function calculateResizeConstraints(
    clipId: string,
    segmentIndex: number,
    handleType: 'left' | 'right'
  ): Promise<{
    minStartTime: number;
    maxEndTime: number;
  }> {
    try {
      const adjacent = await getAdjacentClipSegments(clipId, segmentIndex);

      let minStartTime = 0;
      let maxEndTime = duration.value || Infinity;

      // Can't go past previous segment's end time
      if (adjacent.previous) {
        minStartTime = adjacent.previous.end_time;
      }

      // Can't go past next segment's start time
      if (adjacent.next) {
        maxEndTime = adjacent.next.start_time;
      }

      // For left handle, we need to consider the current segment's end_time
      // For right handle, we need to consider the current segment's start_time
      const currentSegment = localClips.value.find((clip) => clip.id === clipId)?.segments[
        segmentIndex
      ];

      if (currentSegment) {
        if (handleType === 'left') {
          // Left handle can't go past current end_time - minimum duration
          maxEndTime = Math.min(
            maxEndTime,
            currentSegment.end_time - CUT_CONFIG.MIN_SEGMENT_DURATION
          );
        } else {
          // Right handle can't go before current start_time + minimum duration
          minStartTime = Math.max(
            minStartTime,
            currentSegment.start_time + CUT_CONFIG.MIN_SEGMENT_DURATION
          );
        }
      }

      return { minStartTime, maxEndTime };
    } catch (error) {
      console.error('Error calculating resize constraints:', error);
      return {
        minStartTime: 0,
        maxEndTime: duration.value || Infinity,
      };
    }
  }

  // Update segment drag tooltip position to follow the segment
  function updateSegmentDragTooltip() {
    if (!isDraggingSegment.value || !draggedSegmentInfo.value || !timelineContainer.value) return;

    const { currentStartTime } = draggedSegmentInfo.value;
    const container = timelineContainer.value;

    // Find the video track content element to use as positioning reference
    const videoTrack = container.querySelector(SELECTORS.VIDEO_TRACK) as HTMLElement;
    if (!videoTrack) return;

    // Calculate the time percentage for the segment start time
    const timePercent = duration.value ? currentStartTime / duration.value : 0;

    // Create a temporary div positioned at the time percentage within the video track
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = `${timePercent * 100}%`;
    tempDiv.style.top = '0';
    tempDiv.style.width = '1px';
    tempDiv.style.height = '1px';
    tempDiv.style.pointerEvents = 'none';
    tempDiv.style.opacity = '0';

    videoTrack.appendChild(tempDiv);

    // Get the absolute position of this temp div
    const tempRect = tempDiv.getBoundingClientRect();
    const targetX = tempRect.left + tempRect.width / 2;

    // Clean up
    videoTrack.removeChild(tempDiv);

    // Update tooltip position
    draggedSegmentInfo.value.tooltipX = targetX;
    draggedSegmentInfo.value.tooltipY = container.getBoundingClientRect().top - 60;
  }

  // Handle mouse move for segment dragging
  function onSegmentMouseMove(event: MouseEvent) {
    if (!isDraggingSegment.value || !draggedSegmentInfo.value || !duration.value) return;

    const { clipId, segmentIndex } = draggedSegmentInfo.value;
    const deltaX = event.clientX - draggedSegmentInfo.value.originalMouseX;
    const timelineWidth = timelineContainer.value?.clientWidth || 1;
    const timeDelta = ((deltaX / timelineWidth) * duration.value) / zoomLevel.value;

    let newStartTime = draggedSegmentInfo.value.originalStartTime + timeDelta;
    let newEndTime = draggedSegmentInfo.value.originalEndTime + timeDelta;

    // Preserve original duration
    const originalDuration =
      draggedSegmentInfo.value.originalEndTime - draggedSegmentInfo.value.originalStartTime;

    // Apply constraints that prevent shrinking
    if (newStartTime < movementConstraints.value.minStartTime) {
      // Moving left would violate constraint, stop at boundary
      newStartTime = movementConstraints.value.minStartTime;
      newEndTime = newStartTime + originalDuration;
    } else if (newEndTime > movementConstraints.value.maxEndTime) {
      // Moving right would violate constraint, stop at boundary
      newEndTime = movementConstraints.value.maxEndTime;
      newStartTime = newEndTime - originalDuration;
    }

    // Also ensure we stay within video bounds while preserving duration
    if (newStartTime < 0) {
      newStartTime = 0;
      newEndTime = Math.min(originalDuration, duration.value);
    } else if (newEndTime > duration.value) {
      newEndTime = duration.value;
      newStartTime = Math.max(duration.value - originalDuration, 0);
    }

    // Final check: if we still can't maintain original duration, don't move at all
    if (newEndTime - newStartTime < originalDuration * 0.99) {
      // Allow tiny floating point errors
      // Revert to original position - constraint hit, can't move further in this direction
      newStartTime = draggedSegmentInfo.value.originalStartTime;
      newEndTime = draggedSegmentInfo.value.originalEndTime;
    }

    // Update drag state
    draggedSegmentInfo.value.currentStartTime = newStartTime;
    draggedSegmentInfo.value.currentEndTime = newEndTime;

    // Update tooltip position to follow the segment
    updateSegmentDragTooltip();

    // Use debounced update for smoother performance during drag
    debouncedUpdateClip(clipId, segmentIndex, newStartTime, newEndTime);
  }

  // Handle mouse up to finish segment dragging
  async function onSegmentMouseUp() {
    if (!isDraggingSegment.value || !draggedSegmentInfo.value) return;

    const {
      clipId,
      segmentIndex,
      currentStartTime,
      currentEndTime,
      originalStartTime,
      originalEndTime,
    } = draggedSegmentInfo.value;

    // Store the original values before we modify them
    const originalOriginalStartTime = originalStartTime;
    const originalOriginalEndTime = originalEndTime;

    // Update the drag info to commit the final position first
    if (draggedSegmentInfo.value) {
      draggedSegmentInfo.value.originalStartTime = currentStartTime;
      draggedSegmentInfo.value.originalEndTime = currentEndTime;
    }

    // Cancel any pending debounced updates to prevent ghost flashing
    debouncedUpdateClip.cancel();

    // Now reset drag state (the final position is now the "original" position)
    isDraggingSegment.value = false;
    draggedSegmentInfo.value = null;
    document.body.style.cursor = '';

    // Final database update and transcript realignment (only if significant change)
    if (
      Math.abs(currentStartTime - originalOriginalStartTime) > 0.1 ||
      Math.abs(currentEndTime - originalOriginalEndTime) > 0.1
    ) {
      try {
        // Final immediate database update to ensure latest state is saved
        await updateClipSegment(clipId, segmentIndex, currentStartTime, currentEndTime);

        // Realign transcript if needed
        await realignClipSegment(
          clipId,
          segmentIndex,
          originalOriginalStartTime,
          originalOriginalEndTime,
          currentStartTime,
          currentEndTime
        );

        // Emit update to parent
        onSegmentUpdated?.(clipId, segmentIndex, currentStartTime, currentEndTime);
      } catch (error) {
        console.error('[useSegmentManipulation] Error in final segment update:', error);
      }
    }
  }

  // Handle mouse down on segment
  async function onSegmentMouseDown(
    event: MouseEvent,
    clipId: string,
    segmentIndex: number,
    segment: ClipSegment
  ) {
    // Only start drag with left mouse button
    if (event.button !== 0) return;

    // Prevent text selection during drag
    event.preventDefault();
    event.stopPropagation();

    // Initialize drag state
    isDraggingSegment.value = true;
    draggedSegmentInfo.value = {
      clipId,
      segmentIndex,
      originalStartTime: segment.start_time,
      originalEndTime: segment.end_time,
      originalMouseX: event.clientX,
      dragStartTime: Date.now(),
      currentStartTime: segment.start_time,
      currentEndTime: segment.end_time,
    };

    // Calculate movement constraints
    await calculateMovementConstraints(clipId, segmentIndex);

    // Change cursor globally
    document.body.style.cursor = 'grabbing';

    // Initialize tooltip position
    updateSegmentDragTooltip();
  }

  // Toggle cut tool on/off
  function toggleCutTool() {
    isCutToolActive.value = !isCutToolActive.value;

    // Reset cut hover state when deactivating
    if (!isCutToolActive.value) {
      cutHoverInfo.value = null;
      hoveredSegmentKey.value = null;
    }

    // Disable other interactions when cut tool is active
    if (isCutToolActive.value) {
      // Clear any existing drag/resize states
      isDraggingSegment.value = false;
      isResizingSegment.value = false;
      draggedSegmentInfo.value = null;
      resizeHandleInfo.value = null;
    }
  }

  // Handle segment hover for cut preview
  function onSegmentHoverForCut(
    event: MouseEvent,
    clipId: string,
    segmentIndex: number,
    segment: ClipSegment
  ) {
    if (!isCutToolActive.value || !duration.value) return;

    const segmentElement = event.target as HTMLElement;
    if (!segmentElement) return;

    const rect = segmentElement.getBoundingClientRect();
    const relativeX = event.clientX - rect.left;
    const segmentWidth = rect.width;

    // Calculate the cut position as a percentage within the segment
    const cutPositionPercent = (relativeX / segmentWidth) * 100;

    // Calculate the actual cut time within the video
    const segmentStartTime = getSegmentDisplayTime(segment, 'start');
    const segmentEndTime = getSegmentDisplayTime(segment, 'end');
    const segmentDuration = segmentEndTime - segmentStartTime;
    const cutTime = segmentStartTime + (segmentDuration * cutPositionPercent) / 100;

    // Validate minimum segment durations (0.5 seconds each)
    const leftDuration = cutTime - segmentStartTime;
    const rightDuration = segmentEndTime - cutTime;

    if (
      leftDuration >= CUT_CONFIG.MIN_SEGMENT_DURATION &&
      rightDuration >= CUT_CONFIG.MIN_SEGMENT_DURATION
    ) {
      cutHoverInfo.value = {
        clipId,
        segmentIndex,
        cutTime,
        cutPosition: cutPositionPercent,
        cursorPosition: cutPositionPercent,
      };
    } else {
      // Not enough space for a valid cut
      cutHoverInfo.value = null;
    }
  }

  // Handle segment click for cut operation
  async function onSegmentClickForCut(
    _event: MouseEvent,
    clipId: string,
    segmentIndex: number,
    _segment: ClipSegment
  ) {
    if (!isCutToolActive.value || !cutHoverInfo.value) return;

    try {
      // Perform the cut operation
      const result = await splitClipSegment(clipId, segmentIndex, cutHoverInfo.value.cutTime);

      // Refresh the clips data to show the split segments
      onRefreshClipsData?.();

      // Reset cut tool state
      isCutToolActive.value = false;
      cutHoverInfo.value = null;
    } catch (error) {
      console.error('[useSegmentManipulation] Failed to split segment:', error);
      // Show error feedback to user (could add a toast/notification here)
      alert(`Failed to split segment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return {
    // State
    localClips: computed(() => localClips.value),
    displayClips,
    hoveredSegmentKey,
    isDraggingSegment,
    draggedSegmentInfo: computed(() => draggedSegmentInfo.value),
    isResizingSegment,
    resizeHandleInfo: computed(() => resizeHandleInfo.value),
    isCutToolActive,
    cutHoverInfo: computed(() => cutHoverInfo.value),
    movementConstraints: computed(() => movementConstraints.value),

    // Methods
    setLocalClips,
    onSegmentMouseDown,
    onSegmentMouseMove,
    onSegmentMouseUp,
    toggleCutTool,
    onSegmentHoverForCut,
    onSegmentClickForCut,
    calculateResizeConstraints,
    updateSegmentDragTooltip,

    // Debounced function
    debouncedUpdateClip,
  };
}
