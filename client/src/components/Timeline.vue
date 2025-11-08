<template>
  <div
    class="bg-[#0a0a0a]/30 transition-all duration-300 ease-in-out"
    :style="{
      height: calculatedHeight + 'px',
    }"
  >
    <div class="pt-3 px-4 h-full flex flex-col">
      <!-- Timeline Header -->
      <TimelineHeader
        :isCutToolActive="isCutToolActive"
        :isSeeking="isSeeking"
        :seekDirection="seekDirection"
        :zoomLevel="zoomLevel"
        :minZoom="minZoom"
        :maxZoom="maxZoom"
        :zoomStep="zoomStep"
        :clipCount="displayClips.length"
        @toggleCutTool="toggleCutTool"
        @startContinuousSeeking="startContinuousSeeking"
        @stopContinuousSeeking="stopContinuousSeeking"
        @zoomChanged="onZoomSliderChange"
        ref="timelineHeaderRef"
      />
      <!-- Timeline Tracks Container -->
      <div
        :class="[
          'flex-1 pr-1 bg-muted/20 border border-border/40 rounded-lg relative overflow-x-auto',
          shouldShowScrollbar
            ? 'overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800'
            : 'overflow-y-hidden',
        ]"
        ref="timelineScrollContainer"
        :style="{ maxHeight: calculatedHeight - 86 + 'px' }"
        @mousemove="onTimelineMouseMove"
        @mouseleave="onTimelineMouseLeaveGlobal"
        @mousedown="onDragStart"
        @wheel="onTimelineWheel"
        @contextmenu.prevent
      >
        <!-- Timeline Content Wrapper - handles zoom width -->
        <div
          class="timeline-content-wrapper"
          :class="{ dragging: isDragging }"
          :style="{ width: `${100 * zoomLevel}%` }"
        >
          <!-- Shared Timestamp Ruler -->
          <TimelineRuler :duration="duration" :zoomLevel="zoomLevel" @rulerWheel="onRulerWheel" />

          <!-- Main Video Track -->
          <TimelineVideoTrack
            :videoSrc="videoSrc"
            :currentTime="currentTime"
            :duration="duration"
            :timelineHoverTime="timelineHoverTime"
            :timelineHoverPosition="timelineHoverPosition"
            @videoTrackClick="onVideoTrackClick"
            @timelineTrackHover="onTimelineTrackHover"
            @timelineMouseLeave="onTimelineMouseLeave"
          />

          <!-- Clip Tracks -->
          <TimelineClipTrack
            :clips="displayClips"
            :duration="duration"
            :currentlyPlayingClipId="props.currentlyPlayingClipId"
            :hoveredClipId="hoveredClipId"
            :hoveredTimelineClipId="props.hoveredTimelineClipId"
            :isDraggingSegment="isDraggingSegment"
            :draggedSegmentInfo="draggedSegmentInfo"
            :isResizingSegment="isResizingSegment"
            :resizeHandleInfo="resizeHandleInfo"
            :isCutToolActive="isCutToolActive"
            :cutHoverInfo="cutHoverInfo"
            :getSegmentAdjacency="getSegmentAdjacency"
            :setTimelineClipRef="setTimelineClipRef"
            :onSegmentHoverForCut="onSegmentHoverForCut"
            :onSegmentClickForCut="onSegmentClickForCut"
            :onSegmentMouseDown="onSegmentMouseDown"
            :onResizeMouseDown="onResizeMouseDown"
            @timelineClipClick="onTimelineClipClick"
            @clipTrackClick="onClipTrackClick"
          />
        </div>
        <!-- End Timeline Content Wrapper -->
      </div>

      <!-- Timeline Hover Line - positioned relative to viewport but constrained to timeline bounds -->
      <TimelineHoverLine
        :showLine="showTimelineHoverLine"
        :position="timelineHoverLinePosition"
        :timelineBoundsTop="timelineBounds.top"
        :timelineBoundsBottom="timelineBounds.bottom"
        :isPanning="isPanning"
        :isDragging="isDragging"
      />

      <!-- Global Playhead Line - positioned like hover line but follows video time -->
      <TimelinePlayhead
        :videoSrc="videoSrc"
        :duration="duration"
        :position="globalPlayheadPosition"
        :timelineBoundsTop="timelineBounds.top"
        :timelineBoundsBottom="timelineBounds.bottom"
      />

      <!-- Drag Selection Area -->
      <TimelineDragSelection
        :isDragging="isDragging"
        :dragStartX="dragStartX"
        :dragEndX="dragEndX"
        :dragStartPercent="dragStartPercent"
        :dragEndPercent="dragEndPercent"
        :timelineBoundsTop="timelineBounds.top"
        :timelineBoundsBottom="timelineBounds.bottom"
        :duration="duration"
      />

      <!-- Custom Timeline Tooltip -->
      <TimelineTooltip
        :showTooltip="showTimelineTooltip"
        :position="tooltipPosition"
        :time="tooltipTime"
        :transcriptWords="tooltipTranscriptWords"
        :centerWordIndex="centerWordIndex"
        :isPanning="isPanning"
        :isDragging="isDragging"
        :isDraggingSegment="isDraggingSegment"
        :isResizingSegment="isResizingSegment"
      />

      <!-- Segment Drag Tooltip -->
      <TimelineDragTooltip
        :isDraggingSegment="isDraggingSegment"
        :draggedSegmentInfo="draggedSegmentInfo"
        :timelineBoundsTop="timelineBounds.top"
        :dragTooltipTranscriptWords="dragTooltipTranscriptWords"
        :dragTooltipCenterWordIndex="dragTooltipCenterWordIndex"
      />
      <!-- Segment Resize Tooltip -->
      <TimelineResizeTooltip
        :isResizingSegment="isResizingSegment"
        :resizeHandleInfo="resizeHandleInfo"
        :timelineBoundsTop="timelineBounds.top"
        :resizeTooltipTranscriptWords="resizeTooltipTranscriptWords"
        :resizeTooltipCenterWordIndex="resizeTooltipCenterWordIndex"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
  import TimelineHeader from './TimelineHeader.vue';
  import TimelineRuler from './TimelineRuler.vue';
  import TimelineVideoTrack from './TimelineVideoTrack.vue';
  import TimelineClipTrack from './TimelineClipTrack.vue';
  import TimelineResizeTooltip from './TimelineResizeTooltip.vue';
  import TimelineDragTooltip from './TimelineDragTooltip.vue';
  import TimelineTooltip from './TimelineTooltip.vue';
  import TimelineDragSelection from './TimelineDragSelection.vue';
  import TimelinePlayhead from './TimelinePlayhead.vue';
  import TimelineHoverLine from './TimelineHoverLine.vue';
  import {
    updateClipSegment,
    getAdjacentClipSegments,
    realignClipSegment,
    splitClipSegment,
  } from '../services/database';
  import { debounce, throttle, type ClipSegment } from '../utils/timelineUtils';
  import { createSeekEvent } from '../utils/videoSeekUtils';
  import { TIMELINE_HEIGHTS, TIMELINE_BOUNDS, TRACK_DIMENSIONS, SELECTORS } from '../utils/timelineConstants';
  import { TIMELINE_CONSTANTS, SEEK_CONFIG } from '../constants/timelineConstants';
  import { useTranscriptData } from '../composables/useTranscriptData';
  import { useTimelineInteraction } from '../composables/useTimelineInteraction';
  import { getXPositionAtTime, calculateTimePercent, canPositionPlayhead } from '../utils/timelinePlayhead';
  import {
    calculateMovementConstraints as calcMovementConstraints,
    calculateResizeConstraints as calcResizeConstraints,
  } from '../utils/timelineConstraints';
  import { createCutHoverInfo } from '../utils/timelineCut';

  interface Clip {
    id: string;
    title: string;
    filename: string;
    type: 'continuous' | 'spliced';
    segments: ClipSegment[];
    total_duration: number;
    combined_transcript: string;
    virality_score: number;
    reason: string;
    socialMediaPost: string;
    run_number?: number;
    run_color?: string;
  }

  interface Props {
    videoSrc: string | null;
    currentTime: number;
    duration: number;
    timelineHoverTime: number | null;
    timelineHoverPosition: number;
    clips?: Clip[];
    hoveredClipId?: string | null;
    hoveredTimelineClipId?: string | null;
    currentlyPlayingClipId?: string | null;
    projectId?: string | null;
  }

  const props = withDefaults(defineProps<Props>(), {
    clips: () => [],
  });

  // Calculate timeline height dynamically based on tracks
  const calculatedHeight = computed(() => {
    const numberOfClips = displayClips.value.length;

    // Calculate total needed height with consistent padding
    const totalHeight =
      TIMELINE_HEIGHTS.HEADER + // Header section
      TIMELINE_HEIGHTS.RULER + // Timeline ruler
      TIMELINE_HEIGHTS.MAIN_TRACK + // Main video track
      numberOfClips * TIMELINE_HEIGHTS.CLIP_TRACK + // Clip tracks
      TIMELINE_HEIGHTS.BASE_BOTTOM_PADDING; // Consistent bottom padding

    // Account for layout overflow (padding, margins, borders, sticky positioning)
    const adjustedHeight = totalHeight - 14; // Subtract 30px to prevent overflow

    // Apply reasonable bounds
    const finalHeight = Math.max(TIMELINE_BOUNDS.MIN_HEIGHT, Math.min(TIMELINE_BOUNDS.MAX_HEIGHT, adjustedHeight));
    return finalHeight;
  });

  // Determine if scrollbar should be shown based on content vs container height
  const shouldShowScrollbar = computed(() => {
    const numberOfClips = displayClips.value.length;

    // Calculate the actual content height within the tracks container
    const tracksContentHeight =
      TIMELINE_HEIGHTS.RULER + // Ruler (inside tracks container)
      TIMELINE_HEIGHTS.MAIN_TRACK + // Main video track
      numberOfClips * TIMELINE_HEIGHTS.CLIP_TRACK; // Clip tracks

    // Available height within tracks container (accounting for header + padding)
    const availableTracksHeight = calculatedHeight.value - 86; // Matches the maxHeight calculation

    // Only show scrollbar when tracks content actually exceeds available tracks height
    return tracksContentHeight > availableTracksHeight + 5; // 5px buffer to prevent premature scrollbar
  });

  interface Emits {
    (e: 'seekTimeline', event: MouseEvent): void;
    (e: 'timelineTrackHover', event: MouseEvent): void;
    (e: 'timelineMouseLeave'): void;
    (e: 'timelineClipHover', clipId: string): void;
    (e: 'scrollToClipsPanel', clipId: string): void;
    (e: 'zoomChanged', zoomLevel: number): void;
    (e: 'segmentUpdated', clipId: string, segmentIndex: number, newStartTime: number, newEndTime: number): void;
    (e: 'refreshClipsData'): void;
  }

  const emit = defineEmits<Emits>();

  // Refs for scroll containers
  const timelineScrollContainer = ref<HTMLElement | null>(null);
  const timelineClipElements = ref<Map<string, HTMLElement>>(new Map());
  const timelineHeaderRef = ref<{ zoomSlider: HTMLInputElement | null } | null>(null);
  const zoomSlider = computed(() => timelineHeaderRef.value?.zoomSlider || null);

  // Use timeline interaction composable
  const {
    zoomState,
    panState,
    dragSelectionState,
    timelineBounds,
    handleRulerWheel,
    updateSliderProgress,
    movePan,
    endPan,
    startDragSelection,
    moveDragSelection,
    endDragSelection,
    setTimelineBoundsWhenStable,
    setZoomLevel,
  } = useTimelineInteraction(
    timelineScrollContainer,
    computed(() => props.duration),
    {
      onZoomChange: (zoomLevel) => emit('zoomChanged', zoomLevel),
      onDragSelection: () => {
        // Handle drag selection zoom if needed
      },
    }
  );

  // Zoom, pan, and drag selection state is now managed by useTimelineInteraction composable
  const zoomLevel = computed(() => zoomState.value.zoomLevel);
  const minZoom = computed(() => zoomState.value.minZoom);
  const maxZoom = computed(() => zoomState.value.maxZoom);
  const zoomStep = computed(() => zoomState.value.zoomStep);

  const isPanning = computed(() => panState.value.isPanning);
  const isDragging = computed(() => dragSelectionState.value.isDragging);
  const dragStartX = computed(() => dragSelectionState.value.dragStartX);
  const dragEndX = computed(() => dragSelectionState.value.dragEndX);
  const dragStartPercent = computed(() => dragSelectionState.value.dragStartPercent);
  const dragEndPercent = computed(() => dragSelectionState.value.dragEndPercent);

  // Timeline bounds for constraining interactions
  // timelineBounds is now managed by useTimelineInteraction composable

  // Local reactive copy of clips for immediate visual updates
  const localClips = ref(props.clips ? [...props.clips] : []);

  // Sync localClips with props.clips
  watch(
    () => props.clips,
    (newClips) => {
      if (newClips) {
        localClips.value = [...newClips];
      }
    },
    { immediate: true, deep: true }
  );

  // Computed clips that updates during dragging or resizing
  const displayClips = computed(() => {
    // Handle dragging
    if (isDraggingSegment.value && draggedSegmentInfo.value) {
      const updatedClips = [...localClips.value];
      const { clipId, segmentIndex, currentStartTime, currentEndTime } = draggedSegmentInfo.value;

      const clipIndex = updatedClips.findIndex((clip) => clip.id === clipId);
      if (clipIndex !== -1 && updatedClips[clipIndex].segments[segmentIndex]) {
        updatedClips[clipIndex] = {
          ...updatedClips[clipIndex],
          segments: [...updatedClips[clipIndex].segments],
        };
        updatedClips[clipIndex].segments[segmentIndex] = {
          ...updatedClips[clipIndex].segments[segmentIndex],
          start_time: currentStartTime,
          end_time: currentEndTime,
          duration: currentEndTime - currentStartTime,
        };
      }

      return updatedClips;
    }

    // Handle resizing
    if (isResizingSegment.value && resizeHandleInfo.value) {
      const updatedClips = [...localClips.value];
      const { clipId, segmentIndex, currentStartTime, currentEndTime } = resizeHandleInfo.value;

      const clipIndex = updatedClips.findIndex((clip) => clip.id === clipId);
      if (clipIndex !== -1 && updatedClips[clipIndex].segments[segmentIndex]) {
        updatedClips[clipIndex] = {
          ...updatedClips[clipIndex],
          segments: [...updatedClips[clipIndex].segments],
        };
        updatedClips[clipIndex].segments[segmentIndex] = {
          ...updatedClips[clipIndex].segments[segmentIndex],
          start_time: currentStartTime,
          end_time: currentEndTime,
          duration: currentEndTime - currentStartTime,
        };
      }

      return updatedClips;
    }

    return localClips.value;
  });

  // Global playhead state
  const globalPlayheadPosition = ref(0); // X position in pixels for the global playhead line
  const isPlayheadInitialized = ref(false); // Track if playhead has been properly initialized
  const isTimelineStable = ref(false); // Track if timeline height has stabilized

  // Timeline hover line state
  const showTimelineHoverLine = ref(false);
  const timelineHoverLinePosition = ref(0); // X position in pixels relative to timeline container

  // Custom tooltip state
  const showTimelineTooltip = ref(false);
  const tooltipPosition = ref({ x: 0, y: 0 });
  const tooltipTime = ref(0);

  // Segment hover state
  const hoveredSegmentKey = ref<string | null>(null); // Track which specific segment is hovered

  // Segment dragging state
  const isDraggingSegment = ref(false);
  const draggedSegmentInfo = ref<{
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
  } | null>(null);

  // Segment resizing state
  const isResizingSegment = ref(false);
  const resizeHandleInfo = ref<{
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
  } | null>(null);

  // Cut tool state
  const isCutToolActive = ref(false);
  const cutHoverInfo = ref<{
    clipId: string;
    segmentIndex: number;
    cutTime: number;
    cutPosition: number; // percentage (0-100)
    cursorPosition: number; // percentage (0-100) for custom cursor position
  } | null>(null);

  // Continuous seeking state
  const isSeeking = ref(false);
  const seekDirection = ref<'forward' | 'reverse' | null>(null);
  const seekInterval = ref<NodeJS.Timeout | null>(null);
  const currentSeekTime = ref(0); // Track our current seek position for continuous seeking

  // Movement constraints
  const movementConstraints = ref<{
    minStartTime: number;
    maxEndTime: number;
  }>({
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
  ); // Debounce for smoother performance

  // Transcript-related state is now managed by useTranscriptData composable

  // Use transcript data composable
  const {
    transcriptData,
    tooltipTranscriptWords,
    centerWordIndex,
    dragTooltipTranscriptWords,
    dragTooltipCenterWordIndex,
    resizeTooltipTranscriptWords,
    resizeTooltipCenterWordIndex,
    debouncedUpdateTooltipWords,
    updateDragTooltipWords,
    updateResizeTooltipWords,
    clearTooltipData,
    clearDragTooltipData,
    clearResizeTooltipData,
    loadTranscriptData,
  } = useTranscriptData(computed(() => props.projectId || null));

  // Check if a segment has adjacent segments using local data (synchronous)
  function getSegmentAdjacencySync(clipId: string, segmentIndex: number): { hasPrevious: boolean; hasNext: boolean } {
    const clip = localClips.value.find((c) => c.id === clipId);
    if (!clip || !clip.segments || clip.segments.length <= 1) {
      return { hasPrevious: false, hasNext: false };
    }

    const currentSegment = clip.segments[segmentIndex];
    if (!currentSegment) {
      return { hasPrevious: false, hasNext: false };
    }

    // Check if previous segment exists and is touching in time
    let hasPrevious = false;
    if (segmentIndex > 0) {
      const previousSegment = clip.segments[segmentIndex - 1];
      // Check if segments are touching (allowing for very small gaps due to floating point precision)
      hasPrevious = Math.abs(previousSegment.end_time - currentSegment.start_time) < 0.01;
    }

    // Check if next segment exists and is touching in time
    let hasNext = false;
    if (segmentIndex < clip.segments.length - 1) {
      const nextSegment = clip.segments[segmentIndex + 1];
      // Check if segments are touching (allowing for very small gaps due to floating point precision)
      hasNext = Math.abs(nextSegment.start_time - currentSegment.end_time) < 0.01;
    }

    return { hasPrevious, hasNext };
  }

  // Get adjacency status for a segment
  function getSegmentAdjacency(clipId: string, segmentIndex: number): { hasPrevious: boolean; hasNext: boolean } {
    return getSegmentAdjacencySync(clipId, segmentIndex);
  }

  function setTimelineClipRef(el: any, clipId: string) {
    if (el && el instanceof HTMLElement) {
      timelineClipElements.value.set(clipId, el);
    } else {
      timelineClipElements.value.delete(clipId);
    }
  }

  // Transcript-related functions are now managed by useTranscriptData composable

  // Throttled function for immediate tooltip updates (position)
  const throttledUpdateTooltipPosition = throttle((timestamp: number) => {
    tooltipTime.value = timestamp;
  }, TRACK_DIMENSIONS.TOOLTIP_THROTTLE); // ~60fps

  // Function to scroll timeline clip into view
  function scrollTimelineClipIntoView(clipId: string) {
    const clipElement = timelineClipElements.value.get(clipId);
    const container = timelineScrollContainer.value;

    if (clipElement && container) {
      // Get the position of the clip relative to the container
      const clipRect = clipElement.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // Check if the clip is partially or fully outside the visible area
      const isAboveVisible = clipRect.top < containerRect.top;
      const isBelowVisible = clipRect.bottom > containerRect.bottom;

      if (isAboveVisible || isBelowVisible) {
        // Scroll the clip into view with smooth behavior
        clipElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest',
        });
      }
    }
  }

  // Expose functions to parent
  defineExpose({
    scrollTimelineClipIntoView,
    zoomLevel,
    loadTranscriptData,
  });

  // formatDuration is now imported from timelineUtils

  function onSeekTimeline(event: MouseEvent) {
    emit('seekTimeline', event);
  }

  function onVideoTrackClick(event: MouseEvent) {
    // Only seek if we're not in the middle of a drag selection
    if (!isDragging.value) {
      onSeekTimeline(event);
    } else {
      console.log('[Timeline] Not seeking - currently dragging');
    }
  }

  function onTimelineTrackHover(event: MouseEvent) {
    emit('timelineTrackHover', event);
  }

  function onTimelineMouseLeave() {
    emit('timelineMouseLeave');
  }

  function onClipTrackClick(event: MouseEvent) {
    // Only seek if we're not in the middle of a drag selection
    if (!isDragging.value) {
      onSeekTimeline(event);
    }
  }

  // Timeline clip click event handler
  function onTimelineClipClick(clipId: string) {
    emit('timelineClipHover', clipId);
    emit('scrollToClipsPanel', clipId);
  }

  // Zoom, pan, and drag selection functions are now managed by useTimelineInteraction composable

  // Zoom slider change handler
  function onZoomSliderChange(newZoomLevel: number) {
    // Update the zoom level in the composable
    setZoomLevel(newZoomLevel);

    // Update CSS variable for filled track
    updateSliderProgress(zoomSlider.value);
  }

  // Event handler wrappers that call composable functions
  function onTimelineWheel(event: WheelEvent) {
    // Check if Ctrl/Cmd key is pressed for horizontal scrolling
    const isCtrlPressed = event.ctrlKey || event.metaKey; // metaKey is Cmd on Mac

    // Check if Alt key is pressed for vertical scrolling
    const isAltPressed = event.altKey; // Alt key works on all platforms

    if (isCtrlPressed) {
      // Prevent default vertical scrolling
      event.preventDefault();

      // Handle horizontal scrolling/panning
      const container = timelineScrollContainer.value;
      if (container) {
        // Scroll horizontally based on wheel delta
        const scrollAmount = event.deltaY * TIMELINE_CONSTANTS.HORIZONTAL_SCROLL_MULTIPLIER; // Adjust multiplier for desired speed
        container.scrollLeft -= scrollAmount;
      }
    } else if (isAltPressed) {
      // Prevent default vertical scrolling
      event.preventDefault();

      // Handle vertical scrolling through clips
      const container = timelineScrollContainer.value;
      if (container) {
        // Scroll vertically based on wheel delta (inverted for natural scrolling)
        const scrollAmount = event.deltaY * TIMELINE_CONSTANTS.VERTICAL_SCROLL_MULTIPLIER;
        container.scrollTop += scrollAmount;
      }
    }
    // Regular zoom functionality removed - zoom now only works on the ruler
  }

  // Ruler wheel handler - handles zoom functionality
  function onRulerWheel(event: WheelEvent) {
    // Check if Ctrl/Cmd key is pressed for horizontal scrolling
    const isCtrlPressed = event.ctrlKey || event.metaKey; // metaKey is Cmd on Mac

    // Check if Alt key is pressed for vertical scrolling
    const isAltPressed = event.altKey; // Alt key works on all platforms

    if (isCtrlPressed) {
      // Prevent default vertical scrolling
      event.preventDefault();

      // Handle horizontal scrolling/panning
      const container = timelineScrollContainer.value;
      if (container) {
        // Scroll horizontally based on wheel delta
        const scrollAmount = event.deltaY * TIMELINE_CONSTANTS.HORIZONTAL_SCROLL_MULTIPLIER; // Adjust multiplier for desired speed
        container.scrollLeft -= scrollAmount;
      }
    } else if (isAltPressed) {
      // Prevent default vertical scrolling
      event.preventDefault();

      // Handle vertical scrolling through clips
      const container = timelineScrollContainer.value;
      if (container) {
        // Scroll vertically based on wheel delta (inverted for natural scrolling)
        const scrollAmount = event.deltaY * TIMELINE_CONSTANTS.VERTICAL_SCROLL_MULTIPLIER;
        container.scrollTop += scrollAmount;
      }
    } else {
      // Regular zoom functionality - only available on ruler
      handleRulerWheel(event);
    }
  }

  function onDragStart(event: MouseEvent) {
    // Hide tooltip when dragging starts
    showTimelineTooltip.value = false;
    clearTooltipData();
    startDragSelection(event);
    // Hide hover line during drag
    showTimelineHoverLine.value = false;
  }

  // Timeline hover line handlers
  function onTimelineMouseMove(event: MouseEvent) {
    if (isPanning.value || isDragging.value) return;

    const container = timelineScrollContainer.value;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const relativeX = event.clientX - rect.left;

    // Update timeline bounds - either immediately if stable, or set them when stability is achieved
    if (isTimelineStable.value) {
      setTimelineBoundsWhenStable(rect.top, rect.bottom);
    } else {
      // If timeline isn't stable yet, set bounds but they might be incorrect
      // This will be corrected when timeline becomes stable
      timelineBounds.value = { top: rect.top, bottom: rect.bottom };
    }

    // Only show hover line if we're in the timeline content area (after track labels)
    if (relativeX >= TRACK_DIMENSIONS.LABEL_WIDTH) {
      showTimelineHoverLine.value = true;
      // Position the line exactly where the cursor is (absolute viewport position)
      timelineHoverLinePosition.value = event.clientX;

      // Calculate time for tooltip using more accurate positioning
      const timelineContent = container.querySelector('.timeline-content-wrapper');
      if (timelineContent) {
        const contentRect = timelineContent.getBoundingClientRect();

        // Account for track label width - only the area after track labels represents the timeline
        const contentRelativeX = Math.max(0, event.clientX - contentRect.left - TRACK_DIMENSIONS.LABEL_WIDTH);
        const contentWidth = Math.max(1, contentRect.width - TRACK_DIMENSIONS.LABEL_WIDTH);
        const timePercent = Math.max(0, Math.min(1, contentRelativeX / contentWidth));
        const hoverTime = timePercent * props.duration;

        // Update custom tooltip
        showTimelineTooltip.value = true;
        tooltipPosition.value = {
          x: event.clientX,
          y: event.clientY - TIMELINE_CONSTANTS.TOOLTIP_OFFSET_Y, // Position further above cursor to avoid text
        };

        // Update timestamp immediately (throttled)
        throttledUpdateTooltipPosition(hoverTime);

        // Update transcript words for enhanced tooltip
        if (transcriptData.value && transcriptData.value.words.length > 0) {
          debouncedUpdateTooltipWords(hoverTime);
        } else {
          tooltipTranscriptWords.value = [];
          centerWordIndex.value = 0;
        }
      }
    } else {
      showTimelineHoverLine.value = false;
      showTimelineTooltip.value = false;
      clearTooltipData();
    }
  }

  function onTimelineMouseLeaveGlobal() {
    showTimelineHoverLine.value = false;
    showTimelineTooltip.value = false;
    clearTooltipData();
    // Cancel drag if mouse leaves timeline
    if (isDragging.value) {
      endDragSelection();
    }
  }

  // Detect timeline height stability by monitoring height changes over time
  function waitForTimelineStability(callback: () => void) {
    const container = timelineScrollContainer.value;
    if (!container) return;

    let lastHeight = 0;
    let stableCount = 0;
    const stabilityThreshold = 5; // Number of consecutive stable measurements required
    const checkInterval = 50; // Check every 50ms

    const stabilityChecker = setInterval(() => {
      const currentRect = container.getBoundingClientRect();
      const currentHeight = currentRect.height;

      if (currentHeight === lastHeight) {
        stableCount++;
        if (stableCount >= stabilityThreshold) {
          // Timeline height is stable
          clearInterval(stabilityChecker);
          isTimelineStable.value = true;
          callback();
        }
      } else {
        // Height changed, reset stability counter
        stableCount = 0;
        lastHeight = currentHeight;
      }
    }, checkInterval);

    // Fallback timeout in case timeline never stabilizes
    setTimeout(() => {
      clearInterval(stabilityChecker);
      if (!isTimelineStable.value) {
        isTimelineStable.value = true;
        callback();
      }
    }, 2000); // 2 second timeout
  }

  // Update global playhead position based on current time
  function updateGlobalPlayheadPosition() {
    if (!canPositionPlayhead(props.videoSrc, props.duration, props.currentTime)) {
      return;
    }

    const container = timelineScrollContainer.value;
    if (!container) return;

    // Only update playhead position if timeline is stable or if it's the first initialization
    if (!isTimelineStable.value && !isPlayheadInitialized.value) {
      return;
    }

    // Find the video track content element to get its current playhead position as reference
    const videoTrack = container.querySelector(SELECTORS.VIDEO_TRACK) as HTMLElement;
    if (!videoTrack) {
      // Video track doesn't exist yet, retry during initialization
      if (!isPlayheadInitialized.value && isTimelineStable.value) {
        requestAnimationFrame(() => {
          updateGlobalPlayheadPosition();
        });
      }
      return;
    }

    // Calculate the time percentage
    const timePercent = calculateTimePercent(props.currentTime, props.duration);

    // Get the absolute position using the extracted utility
    const targetX = getXPositionAtTime(videoTrack, timePercent);
    globalPlayheadPosition.value = targetX;
    isPlayheadInitialized.value = true;
  }

  // Watch for changes that affect global playhead position and slider
  watch(
    [() => props.currentTime, () => props.duration, () => props.videoSrc, zoomLevel],
    () => {
      updateGlobalPlayheadPosition();
      updateSliderProgress(zoomSlider.value);
    },
    { immediate: true }
  );

  // Update tooltip position when zoom changes during drag
  watch(zoomLevel, () => {
    if (isDraggingSegment.value) {
      updateSegmentDragTooltip();
    }
  });

  // projectId watching is now handled by useTranscriptData composable

  // Handle scroll events to update global playhead position
  function handleScroll() {
    // Only update playhead position if timeline is stable
    if (isTimelineStable.value) {
      updateGlobalPlayheadPosition();
    }
  }

  // Global mouse event handlers for better panning and drag selection experience
  function handleGlobalMouseMove(event: MouseEvent) {
    if (isPanning.value) {
      movePan(event);
    } else if (isDragging.value) {
      moveDragSelection(event);
    } else if (isDraggingSegment.value) {
      onSegmentMouseMove(event);
    } else if (isResizingSegment.value) {
      onResizeMouseMove(event);
    } else {
      // Check if we're still over the timeline area
      const container = timelineScrollContainer.value;
      if (container) {
        const rect = container.getBoundingClientRect();
        if (
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom
        ) {
          onTimelineMouseMove(event);
        } else {
          showTimelineHoverLine.value = false;
          showTimelineTooltip.value = false;
          clearTooltipData();
        }
      }
    }
  }

  function handleGlobalMouseUp() {
    if (isDragging.value) {
      endDragSelection();
    } else if (isDraggingSegment.value) {
      onSegmentMouseUp();
    } else if (isResizingSegment.value) {
      onResizeMouseUp();
    } else {
      endPan();
    }
  }

  // Handle keyboard events
  function handleKeyDown(event: KeyboardEvent) {
    // Don't handle keyboard events if user is typing in input fields
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    // Activate cut tool when 'x' key is pressed
    if (event.key === 'x' || event.key === 'X') {
      event.preventDefault();
      if (!isCutToolActive.value) {
        toggleCutTool();
      }
    }

    // Deactivate cut tool when Escape key is pressed
    if (event.key === 'Escape' && isCutToolActive.value) {
      event.preventDefault();
      toggleCutTool();
    }

    // Video navigation with arrow keys (continuous seeking)
    if (!isCutToolActive.value && props.videoSrc && props.duration) {
      if (event.key === 'ArrowLeft' && !isSeeking.value) {
        event.preventDefault();
        startContinuousSeeking('reverse');
      } else if (event.key === 'ArrowRight' && !isSeeking.value) {
        event.preventDefault();
        startContinuousSeeking('forward');
      }
    }
  }

  // Handle keyboard key up events
  function handleKeyUp(event: KeyboardEvent) {
    // Don't handle keyboard events if user is typing in input fields
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    // Stop continuous seeking when arrow keys are released
    if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && isSeeking.value) {
      event.preventDefault();
      stopContinuousSeeking();
    }
  }

  // Setup and cleanup global event listeners
  onMounted(() => {
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // Initialize timeline bounds for hover line
    const container = timelineScrollContainer.value;
    if (container) {
      // Add scroll listener to update global playhead position
      container.addEventListener('scroll', handleScroll);

      // Add resize observer to update positions when container resizes
      const resizeObserver = new ResizeObserver(() => {
        // Update timeline bounds if timeline is stable
        if (isTimelineStable.value) {
          const rect = container.getBoundingClientRect();
          setTimelineBoundsWhenStable(rect.top, rect.bottom);

          // Update global playhead position
          updateGlobalPlayheadPosition();
        }
      });

      resizeObserver.observe(container);
      (container as any)._resizeObserver = resizeObserver;

      // Wait for timeline height to stabilize before initializing bounds and playhead
      waitForTimelineStability(() => {
        // Set final bounds after timeline is stable
        const rect = container.getBoundingClientRect();
        setTimelineBoundsWhenStable(rect.top, rect.bottom);

        // Initialize playhead position with stable timeline
        nextTick(() => {
          updateGlobalPlayheadPosition();
        });
      });
    }
  });

  onUnmounted(() => {
    document.removeEventListener('mousemove', handleGlobalMouseMove);
    document.removeEventListener('mouseup', handleGlobalMouseUp);
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);

    // Clean up continuous seeking
    stopContinuousSeeking();

    // Clean up event listeners and observers
    const container = timelineScrollContainer.value;
    if (container) {
      container.removeEventListener('scroll', handleScroll);

      const resizeObserver = (container as any)._resizeObserver;
      if (resizeObserver) {
        resizeObserver.disconnect();
        delete (container as any)._resizeObserver;
      }
    }

    // Reset cursor in case component is unmounted while panning
    document.body.style.cursor = '';

    // Transcript cleanup is now handled by useTranscriptData composable
  });

  // hexToDarkerHex, generateClipGradient, and getSegmentDisplayTime are now imported from timelineUtils

  // Calculate movement constraints for a segment
  async function calculateMovementConstraints(clipId: string, segmentIndex: number): Promise<void> {
    try {
      const adjacent = await getAdjacentClipSegments(clipId, segmentIndex);

      // Get original duration from the dragged segment info
      const originalDuration =
        (draggedSegmentInfo.value?.originalEndTime || 0) - (draggedSegmentInfo.value?.originalStartTime || 0) || 0;

      // Use the extracted utility function
      const constraints = calcMovementConstraints(
        originalDuration,
        adjacent.previous,
        adjacent.next,
        props.duration || Infinity
      );

      movementConstraints.value = constraints;

      // Constraints calculated successfully
    } catch (error) {
      movementConstraints.value = {
        minStartTime: 0,
        maxEndTime: props.duration || Infinity,
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

      // Get the current segment
      const currentSegment = localClips.value.find((clip) => clip.id === clipId)?.segments[segmentIndex];

      if (!currentSegment) {
        throw new Error('Current segment not found');
      }

      // Use the extracted utility function
      const constraints = calcResizeConstraints(
        handleType,
        currentSegment,
        adjacent.previous,
        adjacent.next,
        props.duration || Infinity
      );

      return constraints;
    } catch (error) {
      return {
        minStartTime: 0,
        maxEndTime: props.duration || Infinity,
      };
    }
  }

  // Handle mouse down on segment
  async function onSegmentMouseDown(event: MouseEvent, clipId: string, segmentIndex: number, segment: ClipSegment) {
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

    // Hide tooltip during drag
    showTimelineTooltip.value = false;
    clearTooltipData();

    // Initialize tooltip position
    updateSegmentDragTooltip();
  }

  // Update segment drag tooltip position to follow the segment
  function updateSegmentDragTooltip() {
    if (!isDraggingSegment.value || !draggedSegmentInfo.value || !timelineScrollContainer.value) return;

    const { currentStartTime } = draggedSegmentInfo.value;
    const container = timelineScrollContainer.value;

    // Find the video track content element to use as positioning reference
    const videoTrack = container.querySelector(SELECTORS.VIDEO_TRACK) as HTMLElement;
    if (!videoTrack) return;

    // Calculate the time percentage for the segment start time
    const timePercent = props.duration ? currentStartTime / props.duration : 0;

    // Get the absolute position using the extracted utility
    const targetX = getXPositionAtTime(videoTrack, timePercent);

    // Update tooltip position
    draggedSegmentInfo.value.tooltipX = targetX;
    draggedSegmentInfo.value.tooltipY =
      container.getBoundingClientRect().top - TIMELINE_CONSTANTS.DRAG_TOOLTIP_OFFSET_Y;

    // Update transcript words for drag tooltip
    updateDragTooltipWords(currentStartTime);
  }

  // Handle mouse move for segment dragging
  function onSegmentMouseMove(event: MouseEvent) {
    if (!isDraggingSegment.value || !draggedSegmentInfo.value || !props.duration) return;

    const { clipId, segmentIndex } = draggedSegmentInfo.value;
    const deltaX = event.clientX - draggedSegmentInfo.value.originalMouseX;
    const timelineWidth = timelineScrollContainer.value?.clientWidth || 1;
    const timeDelta = ((deltaX / timelineWidth) * props.duration) / zoomLevel.value;

    let newStartTime = draggedSegmentInfo.value.originalStartTime + timeDelta;
    let newEndTime = draggedSegmentInfo.value.originalEndTime + timeDelta;

    // Preserve original duration
    const originalDuration = draggedSegmentInfo.value.originalEndTime - draggedSegmentInfo.value.originalStartTime;

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
      newEndTime = Math.min(originalDuration, props.duration);
    } else if (newEndTime > props.duration) {
      newEndTime = props.duration;
      newStartTime = Math.max(props.duration - originalDuration, 0);
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

    const { clipId, segmentIndex, currentStartTime, currentEndTime, originalStartTime, originalEndTime } =
      draggedSegmentInfo.value;

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

    // Clear drag transcript data
    clearDragTooltipData();

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
        emit('segmentUpdated', clipId, segmentIndex, currentStartTime, currentEndTime);
      } catch (error) {
        console.error('[Timeline] Error in final segment update:', error);
      }
    }
  }

  // Handle mouse down on resize handle
  async function onResizeMouseDown(
    event: MouseEvent,
    clipId: string,
    segmentIndex: number,
    segment: ClipSegment,
    handleType: 'left' | 'right'
  ) {
    // Only start resize with left mouse button
    if (event.button !== 0) return;

    // Prevent text selection and stop event propagation
    event.preventDefault();
    event.stopPropagation();

    // Calculate resize constraints
    const constraints = await calculateResizeConstraints(clipId, segmentIndex, handleType);

    // Initialize resize state
    isResizingSegment.value = true;
    resizeHandleInfo.value = {
      clipId,
      segmentIndex,
      handleType,
      originalStartTime: segment.start_time,
      originalEndTime: segment.end_time,
      originalMouseX: event.clientX,
      resizeStartTime: Date.now(),
      currentStartTime: segment.start_time,
      currentEndTime: segment.end_time,
      minStartTime: constraints.minStartTime,
      maxEndTime: constraints.maxEndTime,
    };

    // Change cursor globally
    document.body.style.cursor = 'ew-resize';

    // Hide tooltip during resize
    showTimelineTooltip.value = false;
    clearTooltipData();

    // Initialize tooltip position
    updateResizeTooltip();
  }

  // Update resize tooltip position to follow the handle
  function updateResizeTooltip() {
    if (!isResizingSegment.value || !resizeHandleInfo.value || !timelineScrollContainer.value) return;

    const { currentStartTime, currentEndTime, handleType } = resizeHandleInfo.value;
    const container = timelineScrollContainer.value;

    // Find the video track content element to use as positioning reference
    const videoTrack = container.querySelector(SELECTORS.VIDEO_TRACK) as HTMLElement;
    if (!videoTrack) return;

    // Calculate the position of the handle being dragged
    const handleTime = handleType === 'left' ? currentStartTime : currentEndTime;
    const timePercent = props.duration ? handleTime / props.duration : 0;

    // Get the absolute position using the extracted utility
    const targetX = getXPositionAtTime(videoTrack, timePercent);

    // Update tooltip position
    resizeHandleInfo.value.tooltipX = targetX;
    resizeHandleInfo.value.tooltipY = container.getBoundingClientRect().top - TIMELINE_CONSTANTS.DRAG_TOOLTIP_OFFSET_Y;

    // Update transcript words for resize tooltip
    updateResizeTooltipWords(handleTime);
  }

  // Handle mouse move for segment resizing
  function onResizeMouseMove(event: MouseEvent) {
    if (!isResizingSegment.value || !resizeHandleInfo.value || !props.duration) return;

    const { clipId, segmentIndex, handleType, originalStartTime, originalEndTime } = resizeHandleInfo.value;
    const deltaX = event.clientX - resizeHandleInfo.value.originalMouseX;
    const timelineWidth = timelineScrollContainer.value?.clientWidth || 1;
    const timeDelta = ((deltaX / timelineWidth) * props.duration) / zoomLevel.value;

    let newStartTime = originalStartTime;
    let newEndTime = originalEndTime;

    if (handleType === 'left') {
      // Resize left handle: change start_time, keep end_time fixed
      newStartTime = originalStartTime + timeDelta;

      // Apply constraints
      newStartTime = Math.max(resizeHandleInfo.value.minStartTime, newStartTime);
      newStartTime = Math.min(resizeHandleInfo.value.maxEndTime, newStartTime);

      // Ensure minimum duration
      if (newEndTime - newStartTime < TIMELINE_CONSTANTS.MIN_SEGMENT_DURATION) {
        newStartTime = newEndTime - TIMELINE_CONSTANTS.MIN_SEGMENT_DURATION;
      }
    } else {
      // Resize right handle: change end_time, keep start_time fixed
      newEndTime = originalEndTime + timeDelta;

      // Apply constraints
      newEndTime = Math.max(resizeHandleInfo.value.minStartTime, newEndTime);
      newEndTime = Math.min(resizeHandleInfo.value.maxEndTime, newEndTime);

      // Ensure minimum duration
      if (newEndTime - newStartTime < TIMELINE_CONSTANTS.MIN_SEGMENT_DURATION) {
        newEndTime = newStartTime + TIMELINE_CONSTANTS.MIN_SEGMENT_DURATION;
      }
    }

    // Update resize state
    resizeHandleInfo.value.currentStartTime = newStartTime;
    resizeHandleInfo.value.currentEndTime = newEndTime;

    // Update tooltip position to follow the handle
    updateResizeTooltip();

    // Use debounced update for smoother performance during resize
    debouncedUpdateClip(clipId, segmentIndex, newStartTime, newEndTime);
  }

  // Handle mouse up to finish segment resizing
  async function onResizeMouseUp() {
    if (!isResizingSegment.value || !resizeHandleInfo.value) return;

    const { clipId, segmentIndex, currentStartTime, currentEndTime, originalStartTime, originalEndTime } =
      resizeHandleInfo.value;

    // Cancel any pending debounced updates to prevent ghost flashing
    debouncedUpdateClip.cancel();

    // Reset resize state
    isResizingSegment.value = false;
    resizeHandleInfo.value = null;
    document.body.style.cursor = '';

    // Clear resize transcript data
    clearResizeTooltipData();

    // Final database update and transcript realignment (only if significant change)
    if (Math.abs(currentStartTime - originalStartTime) > 0.1 || Math.abs(currentEndTime - originalEndTime) > 0.1) {
      try {
        // Final immediate database update to ensure latest state is saved
        await updateClipSegment(clipId, segmentIndex, currentStartTime, currentEndTime);

        // Realign transcript if needed
        await realignClipSegment(
          clipId,
          segmentIndex,
          originalStartTime,
          originalEndTime,
          currentStartTime,
          currentEndTime
        );

        // Emit update to parent
        emit('segmentUpdated', clipId, segmentIndex, currentStartTime, currentEndTime);
      } catch (error) {
        console.error('[Timeline] Error in final segment resize update:', error);
      }
    }
  }

  // Video seek functions

  // Seek video to specific time (used for continuous seeking)
  function seekVideoToTime(targetTime: number) {
    if (!props.videoSrc || !props.duration) {
      return;
    }

    // Find the video element directly and set its currentTime
    const container = timelineScrollContainer.value;
    if (container) {
      // Look for the video element in the page
      const videoElement = document.querySelector('video') as HTMLVideoElement;
      if (videoElement) {
        videoElement.currentTime = targetTime;
      } else {
        // Fall back to the original synthetic event approach
        const videoTrack = container.querySelector(SELECTORS.VIDEO_TRACK) as HTMLElement;
        if (videoTrack) {
          const syntheticEvent = createSeekEvent(targetTime, props.duration, videoTrack);
          if (syntheticEvent) {
            onVideoTrackClick(syntheticEvent);
          }
        }
      }
    }
  }

  // Start continuous seeking
  function startContinuousSeeking(direction: 'forward' | 'reverse') {
    if (!props.videoSrc || !props.duration) {
      return;
    }

    isSeeking.value = true;
    seekDirection.value = direction;

    // Initialize our seek position from the current video time
    currentSeekTime.value = props.currentTime;

    // Start continuous seeking at high speed immediately (no initial jump)
    seekInterval.value = setInterval(() => {
      const seekAmount =
        seekDirection.value === 'forward' ? SEEK_CONFIG.SECONDS_PER_INTERVAL : -SEEK_CONFIG.SECONDS_PER_INTERVAL;

      // Update our tracked seek position
      currentSeekTime.value += seekAmount;
      currentSeekTime.value = Math.max(0, Math.min(props.duration, currentSeekTime.value));

      seekVideoToTime(currentSeekTime.value);
    }, SEEK_CONFIG.INTERVAL_MS);
  }

  // Stop continuous seeking
  function stopContinuousSeeking() {
    if (seekInterval.value) {
      clearInterval(seekInterval.value);
      seekInterval.value = null;
    }

    isSeeking.value = false;
    seekDirection.value = null;
  }

  // Cut tool functions

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
  function onSegmentHoverForCut(event: MouseEvent, clipId: string, segmentIndex: number, segment: ClipSegment) {
    if (!isCutToolActive.value || !props.duration) return;

    // Find the actual segment element, not a child element
    let segmentElement = event.target as HTMLElement;

    // If the target is a child element, traverse up to find the segment container
    while (segmentElement && !segmentElement.classList.contains('clip-segment')) {
      segmentElement = segmentElement.parentElement as HTMLElement;
    }

    if (!segmentElement) return;

    // Use the extracted utility function
    const cutInfo = createCutHoverInfo(event, segmentElement, segment, props.duration, clipId, segmentIndex);

    cutHoverInfo.value = cutInfo;
  }

  // Handle segment click for cut operation
  async function onSegmentClickForCut(event: MouseEvent, clipId: string, segmentIndex: number, _segment: ClipSegment) {
    if (!isCutToolActive.value || !cutHoverInfo.value) return;

    event.preventDefault();
    event.stopPropagation();

    try {
      // Perform the cut operation
      await splitClipSegment(clipId, segmentIndex, cutHoverInfo.value.cutTime);

      // Refresh the clips data to show the split segments
      emit('refreshClipsData');

      // Reset cut tool state
      isCutToolActive.value = false;
      cutHoverInfo.value = null;
    } catch (error) {
      // Show error feedback to user (could add a toast/notification here)
      alert(`Failed to split segment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
</script>

<style scoped>
  /* Timeline controls */
  .timeline-controls {
    background: rgba(10, 10, 10, 0.5);
    backdrop-filter: blur(4px);
    border-radius: 0.5rem;
    padding: 0.75rem;
  }

  .timeline-seek-bar {
    position: relative;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .timeline-seek-bar:hover .seek-thumb {
    opacity: 1;
  }

  .seek-thumb {
    position: absolute;
    top: 50%;
    width: 12px;
    height: 12px;
    background: white;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    opacity: 0;
    transition: all 0.2s ease;
    transform: translate(-50%, -50%);
    border: 2px solid rgb(147, 51, 234);
  }

  /* Timeline track */
  .timeline-track {
    position: relative;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .timeline-track:hover {
    background: rgba(0, 0, 0, 0.7);
  }

  /* Smooth transitions */
  .transition-all {
    transition-property: all;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 200ms;
  }

  .transition-colors {
    transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 150ms;
  }

  .backdrop-blur-sm {
    backdrop-filter: blur(4px);
  }

  /* Custom scrollbar for timeline */
  .overflow-y-auto::-webkit-scrollbar {
    width: 8px;
  }

  .overflow-y-auto::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.3);
    border-radius: 4px;
  }

  .overflow-y-auto::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .overflow-y-auto::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.5);
  }

  /* Custom scrollbar classes */
  .scrollbar-thin::-webkit-scrollbar {
    width: 6px;
  }

  .scrollbar-thin::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.3);
    border-radius: 3px;
  }

  .scrollbar-thin::-webkit-scrollbar-thumb {
    background: rgba(156, 163, 175, 0.5);
    border-radius: 3px;
  }

  .scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background: rgba(156, 163, 175, 0.7);
  }

  .scrollbar-thumb-gray-600::-webkit-scrollbar-thumb {
    background: rgb(75 85 99 / 0.7);
  }

  .scrollbar-track-gray-800::-webkit-scrollbar-track {
    background: rgb(31 41 55 / 0.5);
  }

  /* Timeline content wrapper for zoom */
  .timeline-content-wrapper {
    min-width: 100%;
  }

  /* Timeline cursor changes */
  .timeline-content-wrapper {
    user-select: none;
  }

  .timeline-content-wrapper.dragging {
    cursor: crosshair;
  }

  /* Prevent text selection during drag */
  .timeline-content-wrapper.dragging,
  .timeline-content-wrapper.dragging * {
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
  }

  /* Collision warning styles */
  .clip-segment.collision-previous {
    border-left: 3px solid #ef4444 !important;
    box-shadow: -4px 0 12px rgba(239, 68, 68, 0.4);
  }

  .clip-segment.collision-next {
    border-right: 3px solid #ef4444 !important;
    box-shadow: 4px 0 12px rgba(239, 68, 68, 0.4);
  }

  /* Prevent text selection during drag */
  .timeline-content-wrapper.dragging-segment {
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
  }

  /* Snap indicator */
  .snap-indicator {
    position: absolute;
    width: 2px;
    height: 100%;
    background: #3b82f6;
    z-index: 25;
    pointer-events: none;
    animation: snap-pulse 1s ease-in-out infinite;
  }

  @keyframes snap-pulse {
    0%,
    100% {
      opacity: 0.6;
    }
    50% {
      opacity: 1;
    }
  }
</style>
