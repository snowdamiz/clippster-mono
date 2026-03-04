<template>
  <div
    class="bg-gradient-to-t from-[#0a0a0b]/50 to-[#0a0a0b]/20 transition-all duration-300 ease-in-out mb-4"
    :style="{
      height: calculatedHeight + 'px',
    }"
  >
    <div class="pt-3 px-4 h-full flex flex-col">
      <!-- Timeline Header -->
      <TimelineHeader
        :isCutToolActive="isCutToolActive"
        :isAddClipModeActive="isAddClipModeActive"
        :canAddClip="canAddClip"
        :isSeeking="isSeeking"
        :seekDirection="seekDirection"
        :sliderPosition="sliderPosition"
        :clipCount="displayClips.length"
        :canMergeSegments="canMergeSegments"
        @toggleCutTool="toggleCutTool"
        @toggleAddClipMode="toggleAddClipMode"
        @startContinuousSeeking="startContinuousSeeking"
        @stopContinuousSeeking="stopContinuousSeeking"
        @sliderChanged="onSliderChange"
        @mergeSegments="mergeSelectedSegments"
        ref="timelineHeaderRef"
      />
      <!-- Timeline Tracks Container -->
      <div
        class="flex-1 pr-1 mt-1 bg-[#141416] border border-white/[0.04] rounded-lg relative overflow-x-auto overflow-y-hidden backdrop-blur-sm"
        ref="timelineScrollContainer"
        @mousemove="onTimelineMouseMove"
        @mouseleave="onTimelineMouseLeaveGlobal"
        @mousedown="onDragStart"
        @wheel="onTimelineWheel"
        @contextmenu.prevent
      >
        <!-- Timeline Content Wrapper - handles zoom width -->
        <div
          class="timeline-content-wrapper"
          :class="{
            dragging: isDragging,
            'add-clip-mode': isAddClipModeActive,
          }"
          :style="{ width: `${Math.max(1, zoomLevel) * 100}%` }"
        >
          <!-- Shared Timestamp Ruler -->
          <TimelineRuler :duration="duration" :zoomLevel="zoomLevel" @rulerWheel="onRulerWheel" />

          <!-- Main Video Track -->
          <TimelineVideoTrack
            :videoSrc="videoSrc"
            :currentTime="currentTime"
            :duration="duration"
            :zoomLevel="zoomLevel"
            :audioGainDb="props.audioGainDb"
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
            :selectedSegmentKeys="selectedSegmentKeys"
            :isMovingSegment="isMovingSegment"
            :segmentMoveDirection="segmentMoveDirection"
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
            @timelineSegmentClick="onTimelineSegmentClick"
            @clipTrackClick="onClipTrackClick"
            @deselectAllSegments="deselectAllSegments"
            @segmentContextMenu="onSegmentContextMenu"
            @clipContextMenu="onClipContextMenu"
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
        :timelineBoundsLeft="timelineBounds.left"
        :isPanning="isPanning"
        :isDragging="isDragging"
        :isCutToolActive="isCutToolActive"
      />

      <!-- Global Playhead Line - positioned like hover line but follows video time -->
      <TimelinePlayhead
        ref="timelinePlayheadRef"
        :videoSrc="videoSrc"
        :duration="duration"
        :position="globalPlayheadPosition"
        :timelineBoundsTop="timelineBounds.top"
        :timelineBoundsBottom="timelineBounds.bottom"
        :timelineBoundsLeft="timelineBounds.left"
        :isCutToolActive="isCutToolActive"
        :isDraggingToZoom="isDragging"
        @playheadDragStart="onPlayheadDragStart"
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
        :isAddClipMode="isAddClipModeActive"
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

    <!-- Delete Segment Confirmation Modal -->
    <ConfirmationModal
      :show="showDeleteSegmentDialog"
      title="Delete Segments"
      :message="`Are you sure you want to delete ${segmentToDelete?.clipTitle || ''}?`"
      suffix="This action cannot be undone."
      confirm-text="Delete"
      variant="destructive"
      @close="handleDeleteSegmentDialogClose"
      @confirm="deleteSegmentConfirmed"
    />

    <!-- Warning Modal -->
    <ConfirmationModal
      :show="showWarningDialog"
      title="Cannot Delete Segment"
      :message="warningMessage"
      :suffix="''"
      :show-only-close-button="true"
      :show-cannot-undone-text="false"
      close-text="Close"
      @close="handleWarningDialogClose"
    />

    <!-- Merge Segments Confirmation Dialog -->
    <ConfirmationModal
      :show="showMergeSegmentsDialog"
      title="Merge Segments"
      message="Are you sure you want to merge the selected"
      suffix="segments?"
      confirm-text="Merge"
      close-text="Cancel"
      @confirm="mergeSegmentsConfirmed"
      @close="cancelMergeSegments"
    />

    <!-- Create Clip Dialog -->
    <CreateClipDialog
      :show="showCreateClipDialog"
      :startTime="createClipStartTime"
      :endTime="createClipEndTime"
      :existingClips="existingClipsForDialog"
      @close="cancelCreateClip"
      @create="confirmCreateClip"
      @addSegment="confirmAddSegment"
    />

    <!-- Segment Context Menu -->
    <TimelineContextMenu
      :show="showContextMenu"
      :info="contextMenuInfo"
      @close="closeContextMenu"
      @action="handleContextMenuAction"
    />

    <!-- Clip Context Menu (for right-click on clip track) -->
    <TimelineClipContextMenu
      :show="showClipContextMenu"
      :info="clipContextMenuInfo"
      @close="closeClipContextMenu"
      @playClip="handlePlayClip"
      @editClip="handleEditClip"
    />
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
  import TimelineContextMenu from './TimelineContextMenu.vue';
  import TimelineClipContextMenu from './TimelineClipContextMenu.vue';
  import ConfirmationModal from './ConfirmationModal.vue';
  import CreateClipDialog from './CreateClipDialog.vue';
  import {
    updateClipSegment,
    getAdjacentClipSegments,
    realignClipSegment,
    splitClipSegment,
    deleteClipSegment,
    deleteClip,
    createManualClip,
    addSegmentToClip,
  } from '../services/database';
  import { debounce, throttle } from '../utils/timelineUtils';
  import { createSeekEvent } from '../utils/videoSeekUtils';
  import { TRACK_DIMENSIONS, SELECTORS } from '../utils/timelineConstants';
  import { TIMELINE_CONSTANTS, SEEK_CONFIG } from '../constants/timelineConstants';
  import { useTranscriptData } from '../composables/useTranscriptData';
  import { useTimelineInteraction } from '../composables/useTimelineInteraction';
  import { getXPositionAtTime, calculateTimePercent, canPositionPlayhead } from '../utils/timelinePlayhead';
  import {
    calculateMovementConstraints as calcMovementConstraints,
    calculateResizeConstraints as calcResizeConstraints,
  } from '../utils/timelineConstraints';
  import { createCutHoverInfo } from '../utils/timelineCut';
  import { applySnapToSegment, applySnapToTime } from '../utils/timelineSnap';
  import type {
    Clip,
    ClipSegment,
    TimelineProps,
    TimelineEmits,
    DraggedSegmentInfo,
    ResizeHandleInfo,
    CutHoverInfo,
    MovementConstraints,
    SegmentToDelete,
    SegmentsToMerge,
    TooltipPosition,
    ContextMenuInfo,
    ClipContextMenuInfo,
  } from '../types';

  const props = withDefaults(defineProps<TimelineProps>(), {
    clips: () => [],
  });

  // Simple two-state height: compact when no clip is visible, expanded when a clip is shown
  const TIMELINE_HEIGHT_COMPACT = 155; // Just header + ruler + main video track
  const TIMELINE_HEIGHT_EXPANDED = 204; // Adds space for one clip track

  const calculatedHeight = computed(() => {
    return displayClips.value.length > 0 ? TIMELINE_HEIGHT_EXPANDED : TIMELINE_HEIGHT_COMPACT;
  });

  // With fixed heights sized appropriately, scrollbar is never needed
  const shouldShowScrollbar = computed(() => false);

  // Computed property to check if merge is possible
  const canMergeSegments = computed(() => canMergeSelectedSegments());

  const emit = defineEmits<TimelineEmits>();

  // Refs for scroll containers
  const timelineScrollContainer = ref<HTMLElement | null>(null);
  const timelineClipElements = ref<Map<string, HTMLElement>>(new Map());
  const timelineHeaderRef = ref<{ zoomSlider: HTMLInputElement | null } | null>(null);
  const timelinePlayheadRef = ref<{ setDraggingState: (dragging: boolean) => void } | null>(null);
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
    setZoomFromSlider,
  } = useTimelineInteraction(
    timelineScrollContainer,
    computed(() => props.duration),
    {
      onZoomChange: (zoomLevel) => emit('zoomChanged', zoomLevel),
      onDragSelection: (startPercent: number, endPercent: number) => {
        // When in add clip mode, open the create clip dialog
        if (isAddClipModeActive.value && props.duration > 0) {
          const startTime = startPercent * props.duration;
          const endTime = endPercent * props.duration;
          openCreateClipDialog(startTime, endTime);
        }
      },
      // Skip zoom when in add clip mode - we want to create a clip instead
      skipZoom: () => isAddClipModeActive.value,
    }
  );

  // Zoom, pan, and drag selection state is now managed by useTimelineInteraction composable
  const zoomLevel = computed(() => zoomState.value.zoomLevel);
  const minZoom = computed(() => zoomState.value.minZoom);
  const maxZoom = computed(() => zoomState.value.maxZoom);
  const zoomStep = computed(() => zoomState.value.zoomStep);
  const sliderPosition = computed(() => zoomState.value.sliderPosition);

  const isPanning = computed(() => panState.value.isPanning);
  const isDragging = computed(() => dragSelectionState.value.isDragging);
  const dragStartX = computed(() => dragSelectionState.value.dragStartX);
  const dragEndX = computed(() => dragSelectionState.value.dragEndX);
  const dragStartPercent = computed(() => dragSelectionState.value.dragStartPercent);
  const dragEndPercent = computed(() => dragSelectionState.value.dragEndPercent);
  const justFinishedDragging = computed(() => dragSelectionState.value.justFinishedDragging);

  // Timeline bounds for constraining interactions
  // timelineBounds is now managed by useTimelineInteraction composable

  // Helper function to sort clips: manual clips at bottom, then by run_number descending, then by virality descending
  // IMPORTANT: This must match the sorting in ClipsTab.vue exactly for consistent clip ordering
  function sortClips(clips: Clip[]): Clip[] {
    return [...clips].sort((a, b) => {
      // First, put manual clips at the bottom
      const aIsManual = (a as any).session_prompt === 'Manual clip creation';
      const bIsManual = (b as any).session_prompt === 'Manual clip creation';
      if (aIsManual !== bIsManual) {
        return aIsManual ? 1 : -1; // Manual clips go to the bottom
      }

      // For non-manual clips: sort by run_number descending (newest run first)
      const runA = a.run_number || 0;
      const runB = b.run_number || 0;
      if (runB !== runA) {
        return runB - runA;
      }

      // Then sort by virality score descending (highest first)
      // Use current_version_virality_score to match ClipsTab.vue sorting
      const viralityA = (a as any).current_version_virality_score || a.virality_score || 0;
      const viralityB = (b as any).current_version_virality_score || b.virality_score || 0;
      return viralityB - viralityA;
    });
  }

  // Local reactive copy of clips for immediate visual updates (sorted)
  const localClips = ref(props.clips ? sortClips(props.clips) : []);

  // Track which clips are visible in the timeline (by default, none are visible)
  const visibleClipIds = ref<Set<string>>(new Set());

  // Sync localClips with props.clips (sorted)
  watch(
    () => props.clips,
    (newClips) => {
      if (newClips) {
        localClips.value = sortClips(newClips);
      }
    },
    { immediate: true, deep: true }
  );

  // Computed clips that updates during dragging or resizing
  const allClipsWithUpdates = computed(() => {
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

  // Filter clips to only show visible ones (clips are hidden by default until selected)
  const displayClips = computed(() => {
    // If no clips are explicitly visible, show none
    if (visibleClipIds.value.size === 0) {
      return [];
    }
    // Filter to only show visible clips, maintaining their original order
    return allClipsWithUpdates.value.filter((clip) => visibleClipIds.value.has(clip.id));
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
  const tooltipPosition = ref<TooltipPosition>({ x: 0, y: 0 });
  const tooltipTime = ref(0);

  // Segment hover state
  const hoveredSegmentKey = ref<string | null>(null); // Track which specific segment is hovered

  // Segment selection state
  const selectedSegmentKeys = ref<Set<string>>(new Set()); // Track multiple selected segments (format: clipId_segmentIndex)

  // Delete segment confirmation dialog state
  const showDeleteSegmentDialog = ref(false);
  const segmentToDelete = ref<SegmentToDelete | null>(null);

  // Merge segments confirmation dialog state
  const showMergeSegmentsDialog = ref(false);
  const segmentsToMerge = ref<SegmentsToMerge | null>(null);

  // Warning dialog for last segment protection
  const showWarningDialog = ref(false);
  const warningMessage = ref('');

  // Context menu state (for segments)
  const showContextMenu = ref(false);
  const contextMenuInfo = ref<ContextMenuInfo | null>(null);

  // Clip context menu state (for entire clips)
  const showClipContextMenu = ref(false);
  const clipContextMenuInfo = ref<ClipContextMenuInfo | null>(null);

  // Segment dragging state
  const isDraggingSegment = ref(false);
  const draggedSegmentInfo = ref<DraggedSegmentInfo | null>(null);

  // Segment resizing state
  const isResizingSegment = ref(false);
  const resizeHandleInfo = ref<ResizeHandleInfo | null>(null);

  // Playhead dragging state
  const isDraggingPlayhead = ref(false);
  const playheadDragStartTime = ref(0);
  const originalPlayheadTime = ref(0);

  // Cut tool state
  const isCutToolActive = ref(false);
  const cutHoverInfo = ref<CutHoverInfo | null>(null);

  // Add clip mode state
  const isAddClipModeActive = ref(false);
  const showCreateClipDialog = ref(false);
  const createClipStartTime = ref(0);
  const createClipEndTime = ref(0);

  // Computed: Can add clip (only when video is loaded)
  const canAddClip = computed(() => !!props.videoSrc && props.duration > 0);

  // Computed: Existing clips for the dialog (format needed by CreateClipDialog)
  const existingClipsForDialog = computed(() => {
    return displayClips.value.map((clip) => ({
      id: clip.id,
      title: clip.title,
      name: (clip as any).current_version_name || clip.title,
      segmentCount: clip.segments?.length || 0,
    }));
  });

  // Continuous seeking state
  const isSeeking = ref(false);
  const seekDirection = ref<'forward' | 'reverse' | null>(null);
  const seekInterval = ref<NodeJS.Timeout | null>(null);
  const currentSeekTime = ref(0); // Track our current seek position for continuous seeking

  // Auto-pan state
  const isAutoPanEnabled = ref(true); // Enable auto-pan by default
  const autoPanMargin = 0.15; // 15% margin from edge before panning

  // Segment keyboard movement state
  const isMovingSegment = ref(false);
  const segmentMoveDirection = ref<'left' | 'right' | null>(null);
  const segmentMoveInterval = ref<NodeJS.Timeout | null>(null);
  const SEGMENT_MOVE_AMOUNT = 0.25; // 0.25 seconds per key press
  const SEGMENT_MOVE_DELAY = 100; // ms between moves when key is held down

  // Movement constraints
  const movementConstraints = ref<MovementConstraints>({
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

  // Reveal a clip in the timeline (makes it visible, hides all others)
  function revealClip(clipId: string) {
    // Clear all previously visible clips - only one clip visible at a time
    visibleClipIds.value.clear();
    visibleClipIds.value.add(clipId);
  }

  // Hide a clip from the timeline
  function hideClip(clipId: string) {
    visibleClipIds.value.delete(clipId);
  }

  // Hide all clips from the timeline
  function hideAllClips() {
    visibleClipIds.value.clear();
  }

  // Check if a clip is visible
  function isClipVisible(clipId: string): boolean {
    return visibleClipIds.value.has(clipId);
  }

  // Expose functions to parent
  defineExpose({
    scrollTimelineClipIntoView,
    zoomLevel,
    loadTranscriptData,
    revealClip,
    hideClip,
    hideAllClips,
    isClipVisible,
    toggleAddClipMode,
    openCreateClipDialog,
  });

  // formatDuration is now imported from timelineUtils

  function onSeekTimeline(event: MouseEvent) {
    emit('seekTimeline', event);
  }

  function onVideoTrackClick(event: MouseEvent) {
    // Only seek if we're not in the middle of a drag selection and didn't just finish dragging
    // Also don't seek when add clip mode is active
    if (!isDragging.value && !justFinishedDragging.value && !isAddClipModeActive.value) {
      onSeekTimeline(event);
    } else {
      console.log('[Timeline] Not seeking - currently dragging or just finished dragging or in add clip mode');
    }
  }

  function onTimelineTrackHover(event: MouseEvent) {
    emit('timelineTrackHover', event);
  }

  function onTimelineMouseLeave() {
    emit('timelineMouseLeave');
  }

  function onClipTrackClick(event: MouseEvent) {
    // Only seek if we're not in the middle of a drag selection and didn't just finish dragging
    // Also don't seek when add clip mode is active
    if (!isDragging.value && !justFinishedDragging.value && !isAddClipModeActive.value) {
      onSeekTimeline(event);
    }
  }

  // Timeline clip click event handler
  function onTimelineClipClick(clipId: string) {
    emit('timelineClipHover', clipId);
    emit('scrollToMediaPanel', clipId);
  }

  // Timeline segment click event handler
  function onTimelineSegmentClick(clipId: string, segmentIndex: number, event?: MouseEvent) {
    const segmentKey = `${clipId}_${segmentIndex}`;

    // Check if Ctrl/Cmd is pressed for multi-selection
    const isMultiSelect = event && (event.ctrlKey || event.metaKey);

    if (isMultiSelect) {
      // Multi-selection mode: toggle the segment if it's from the same clip, otherwise replace selection
      const currentClipTracks = new Set(Array.from(selectedSegmentKeys.value).map((key) => key.split('_')[0]));

      if (currentClipTracks.has(clipId)) {
        // Same clip: toggle selection
        if (selectedSegmentKeys.value.has(segmentKey)) {
          selectedSegmentKeys.value.delete(segmentKey);
        } else {
          selectedSegmentKeys.value.add(segmentKey);
        }
      } else {
        // Different clip: replace selection with just this segment
        selectedSegmentKeys.value.clear();
        selectedSegmentKeys.value.add(segmentKey);
      }
    } else {
      // Single selection mode: clear all and select only this segment
      selectedSegmentKeys.value.clear();
      selectedSegmentKeys.value.add(segmentKey);
    }

    // Emit to parent for any additional handling
    emit('timelineSegmentClick', clipId, segmentIndex);
  }

  // Deselect all segments
  function deselectAllSegments() {
    selectedSegmentKeys.value.clear();
  }

  // Zoom, pan, and drag selection functions are now managed by useTimelineInteraction composable

  // Slider change handler (receives slider position 0-1)
  function onSliderChange(newSliderPosition: number) {
    // Anchor zoom to the current viewport center so content doesn't jump away
    const container = timelineScrollContainer.value;
    const timelineContent = container?.querySelector('.timeline-content-wrapper') as HTMLElement | null;

    const oldContentWidth = timelineContent?.getBoundingClientRect().width ?? container?.scrollWidth ?? 1;
    const containerWidth = container?.clientWidth ?? 1;
    const oldScrollLeft = container?.scrollLeft ?? 0;
    // Anchor in absolute content space (including track label area)
    const anchorContentX = oldScrollLeft + containerWidth / 2;

    // Update the zoom level from slider position (exponential mapping)
    setZoomFromSlider(newSliderPosition);

    nextTick(() => {
      if (!container) return;
      const newContentWidth =
        (container.querySelector('.timeline-content-wrapper') as HTMLElement | null)?.getBoundingClientRect().width ??
        container.scrollWidth ??
        oldContentWidth;
      const scale = newContentWidth / oldContentWidth;
      const targetCenter = anchorContentX * scale;
      const newScrollLeft = Math.max(0, targetCenter - containerWidth / 2);
      const maxScrollLeft = Math.max(0, newContentWidth - containerWidth);
      container.scrollLeft = Math.min(newScrollLeft, maxScrollLeft);
    });

    // Update CSS variable for filled track
    updateSliderProgress(zoomSlider.value);
  }

  // Event handler wrappers that call composable functions
  function onTimelineWheel(event: WheelEvent) {
    // Disable all wheel actions when in add clip mode for cleaner selection
    if (isAddClipModeActive.value) {
      event.preventDefault();
      return;
    }

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
    // Disable zoom when in add clip mode
    if (isAddClipModeActive.value) {
      event.preventDefault();
      return;
    }

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
    // Force start drag selection when in add clip mode (allows clicking on segments)
    startDragSelection(event, isAddClipModeActive.value);
    // Hide hover line during drag
    showTimelineHoverLine.value = false;
  }

  // Timeline hover line handlers
  function onTimelineMouseMove(event: MouseEvent) {
    // Don't show hover effects when in add clip mode or other active states
    if (isPanning.value || isDragging.value || isCutToolActive.value || isAddClipModeActive.value) return;

    const container = timelineScrollContainer.value;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const relativeX = event.clientX - rect.left;

    // Update timeline bounds - either immediately if stable, or set them when stability is achieved
    if (isTimelineStable.value) {
      setTimelineBoundsWhenStable(rect.top, rect.bottom, rect.left + TRACK_DIMENSIONS.LABEL_WIDTH);
    } else {
      // If timeline isn't stable yet, set bounds but they might be incorrect
      // This will be corrected when timeline becomes stable
      timelineBounds.value = { top: rect.top, bottom: rect.bottom, left: timelineBounds.value.left || 0 };
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
          showTimelineTooltip.value = true;
        } else {
          tooltipTranscriptWords.value = [];
          centerWordIndex.value = 0;
          showTimelineTooltip.value = false;
        }
      }
    } else {
      showTimelineHoverLine.value = false;
      showTimelineTooltip.value = false;
      clearTooltipData();
    }
  }

  function onTimelineMouseLeaveGlobal() {
    // Don't clear hover states if cutting tool is active
    if (!isCutToolActive.value) {
      showTimelineHoverLine.value = false;
      showTimelineTooltip.value = false;
      clearTooltipData();
    }
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

  // Auto-pan the timeline to keep playhead visible when zoomed in
  function autoPanToPlayhead() {
    if (!isAutoPanEnabled.value || !timelineScrollContainer.value || !props.duration || !isTimelineStable.value) {
      return;
    }

    // Don't auto-pan if user is interacting with the timeline
    if (
      isDragging.value ||
      isDraggingSegment.value ||
      isResizingSegment.value ||
      isDraggingPlayhead.value ||
      isPanning.value
    ) {
      return;
    }

    const container = timelineScrollContainer.value;
    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;

    // Calculate the playhead's position relative to the content
    const timePercent = props.currentTime / props.duration;
    const contentWidth = containerWidth * zoomLevel.value;
    const playheadPositionInContent = timePercent * contentWidth;

    // Account for the track label width
    const labelWidth = TRACK_DIMENSIONS.LABEL_WIDTH;
    const visibleStart = container.scrollLeft;
    const visibleEnd = visibleStart + containerWidth - labelWidth;

    // Calculate margin (area where we should start panning)
    const visibleWidth = containerWidth - labelWidth;
    const marginPixels = visibleWidth * autoPanMargin;

    // Check if playhead is near the right edge (need to scroll right)
    const rightThreshold = visibleEnd - marginPixels;
    if (playheadPositionInContent > rightThreshold) {
      // Scroll to keep playhead at the margin from right edge
      const targetScrollLeft = playheadPositionInContent - visibleWidth + marginPixels;
      container.scrollLeft = Math.min(targetScrollLeft, contentWidth - containerWidth + labelWidth);
    }

    // Check if playhead is near the left edge (need to scroll left)
    const leftThreshold = visibleStart + marginPixels;
    if (playheadPositionInContent < leftThreshold && container.scrollLeft > 0) {
      // Scroll to keep playhead at the margin from left edge
      const targetScrollLeft = playheadPositionInContent - marginPixels;
      container.scrollLeft = Math.max(0, targetScrollLeft);
    }
  }

  // Watch for changes that affect global playhead position and slider
  watch(
    [() => props.currentTime, () => props.duration, () => props.videoSrc, zoomLevel],
    () => {
      updateGlobalPlayheadPosition();
      updateSliderProgress(zoomSlider.value);
      // Auto-pan when zoomed in (only auto-pan if zoom level > 1)
      if (zoomLevel.value > 1) {
        autoPanToPlayhead();
      }
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
    } else if (isDraggingPlayhead.value) {
      onPlayheadMouseMove(event);
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
    } else if (isDraggingPlayhead.value) {
      onPlayheadMouseUp();
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

    // Toggle add clip mode when 'n' key is pressed (n for "new clip")
    if ((event.key === 'n' || event.key === 'N') && canAddClip.value) {
      event.preventDefault();
      toggleAddClipMode();
    }

    // Deactivate cut tool when Escape key is pressed
    if (event.key === 'Escape' && isCutToolActive.value) {
      event.preventDefault();
      toggleCutTool();
    }

    // Deactivate add clip mode when Escape key is pressed
    if (event.key === 'Escape' && isAddClipModeActive.value) {
      event.preventDefault();
      isAddClipModeActive.value = false;
    }

    // Handle merge segments when 'j' key is pressed
    if (event.key === 'j' || event.key === 'J') {
      event.preventDefault();
      mergeSelectedSegments();
    }

    // Handle arrow keys - prioritize segment movement over playhead seeking
    if (!isCutToolActive.value && props.videoSrc && props.duration) {
      // If segments are selected, move them instead of seeking
      if (selectedSegmentKeys.value.size > 0) {
        if (event.key === 'ArrowLeft' && !isMovingSegment.value) {
          event.preventDefault();
          startContinuousSegmentMove('left');
        } else if (event.key === 'ArrowRight' && !isMovingSegment.value) {
          event.preventDefault();
          startContinuousSegmentMove('right');
        }
      } else {
        // No segments selected, use regular playhead seeking
        if (event.key === 'ArrowLeft' && !isSeeking.value) {
          event.preventDefault();
          startContinuousSeeking('reverse');
        } else if (event.key === 'ArrowRight' && !isSeeking.value) {
          event.preventDefault();
          startContinuousSeeking('forward');
        }
      }
    }

    // Handle backspace key to delete selected segments
    if (event.key === 'Backspace' && selectedSegmentKeys.value.size > 0 && !isCutToolActive.value) {
      event.preventDefault();
      deleteSelectedSegments();
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

    // Stop continuous segment movement when arrow keys are released
    if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && isMovingSegment.value) {
      event.preventDefault();
      stopContinuousSegmentMove();
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
          setTimelineBoundsWhenStable(rect.top, rect.bottom, rect.left + TRACK_DIMENSIONS.LABEL_WIDTH);

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
        setTimelineBoundsWhenStable(rect.top, rect.bottom, rect.left + TRACK_DIMENSIONS.LABEL_WIDTH);

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

    // Clean up continuous segment movement
    stopContinuousSegmentMove();

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

    // Apply snapping to both edges before updating drag state
    const videoTrack = timelineScrollContainer.value?.querySelector(SELECTORS.VIDEO_TRACK) as HTMLElement;
    if (videoTrack && props.duration) {
      const snapResult = applySnapToSegment(newStartTime, newEndTime, props.currentTime, props.duration, videoTrack);

      if (snapResult.didSnap) {
        newStartTime = snapResult.startTime;
        newEndTime = snapResult.endTime;

        // After snapping, re-check constraints to ensure we still respect them
        if (newStartTime < movementConstraints.value.minStartTime) {
          const shift = movementConstraints.value.minStartTime - newStartTime;
          newStartTime = movementConstraints.value.minStartTime;
          newEndTime = newEndTime + shift;
        } else if (newEndTime > movementConstraints.value.maxEndTime) {
          const shift = newEndTime - movementConstraints.value.maxEndTime;
          newEndTime = movementConstraints.value.maxEndTime;
          newStartTime = Math.max(movementConstraints.value.minStartTime, newStartTime - shift);
        }

        // Final duration check after snap and constraint adjustment
        if (newEndTime - newStartTime < originalDuration * 0.99) {
          // If snapping breaks constraints, revert to original position
          newStartTime = draggedSegmentInfo.value.originalStartTime;
          newEndTime = draggedSegmentInfo.value.originalEndTime;
        }
      }
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

    // Apply snapping to the edge being resized
    const videoTrack = timelineScrollContainer.value?.querySelector(SELECTORS.VIDEO_TRACK) as HTMLElement;
    if (videoTrack && props.duration) {
      const targetTime = handleType === 'left' ? newStartTime : newEndTime;
      const snapResult = applySnapToTime(targetTime, props.currentTime, props.duration, videoTrack);

      if (snapResult.didSnap) {
        if (handleType === 'left') {
          newStartTime = snapResult.time;

          // Re-check constraints after snap
          newStartTime = Math.max(resizeHandleInfo.value.minStartTime, newStartTime);
          newStartTime = Math.min(resizeHandleInfo.value.maxEndTime, newStartTime);

          // Ensure minimum duration after snap
          if (newEndTime - newStartTime < TIMELINE_CONSTANTS.MIN_SEGMENT_DURATION) {
            newStartTime = newEndTime - TIMELINE_CONSTANTS.MIN_SEGMENT_DURATION;
          }
        } else {
          newEndTime = snapResult.time;

          // Re-check constraints after snap
          newEndTime = Math.max(resizeHandleInfo.value.minStartTime, newEndTime);
          newEndTime = Math.min(resizeHandleInfo.value.maxEndTime, newEndTime);

          // Ensure minimum duration after snap
          if (newEndTime - newStartTime < TIMELINE_CONSTANTS.MIN_SEGMENT_DURATION) {
            newEndTime = newStartTime + TIMELINE_CONSTANTS.MIN_SEGMENT_DURATION;
          }
        }
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

  // Playhead dragging functions

  // Handle playhead drag start
  function onPlayheadDragStart(event: MouseEvent) {
    // Prevent collision with other drag operations
    if (isDragging.value || isDraggingSegment.value || isResizingSegment.value) {
      return;
    }

    // Prevent text selection during drag
    event.preventDefault();
    event.stopPropagation();

    // Initialize drag state
    isDraggingPlayhead.value = true;
    playheadDragStartTime.value = Date.now();
    originalPlayheadTime.value = props.currentTime;

    // Change cursor globally
    document.body.style.cursor = 'grabbing';

    // Hide tooltip during drag
    showTimelineTooltip.value = false;
    clearTooltipData();
    showTimelineHoverLine.value = false;

    // Update playhead component drag state
    if (timelinePlayheadRef.value) {
      timelinePlayheadRef.value.setDraggingState(true);
    }

    // Immediately seek to the initial drag position
    seekVideoFromMousePosition(event);
  }

  // Handle mouse move during playhead drag
  function onPlayheadMouseMove(event: MouseEvent) {
    if (!isDraggingPlayhead.value || !props.duration) return;

    // Update video time based on mouse position
    seekVideoFromMousePosition(event);
  }

  // Handle mouse up to finish playhead drag
  function onPlayheadMouseUp() {
    if (!isDraggingPlayhead.value) return;

    // Reset drag state
    isDraggingPlayhead.value = false;
    playheadDragStartTime.value = 0;
    originalPlayheadTime.value = 0;
    document.body.style.cursor = '';

    // Update playhead component drag state
    if (timelinePlayheadRef.value) {
      timelinePlayheadRef.value.setDraggingState(false);
    }
  }

  // Seek video based on current mouse position
  function seekVideoFromMousePosition(event: MouseEvent) {
    if (!props.videoSrc || !props.duration || !timelineScrollContainer.value) {
      return;
    }

    const container = timelineScrollContainer.value;

    // Get the video track element for accurate positioning
    const videoTrack = container.querySelector(SELECTORS.VIDEO_TRACK) as HTMLElement;
    if (!videoTrack) {
      return;
    }

    const videoTrackRect = videoTrack.getBoundingClientRect();

    // Calculate relative position within the video track
    const relativeX = Math.max(0, Math.min(videoTrackRect.width, event.clientX - videoTrackRect.left));
    const timePercent = relativeX / videoTrackRect.width;
    const targetTime = timePercent * props.duration;

    // Constrain to video bounds
    const constrainedTime = Math.max(0, Math.min(props.duration, targetTime));

    // Update playhead visual position immediately during drag
    const targetX = videoTrackRect.left + relativeX;
    globalPlayheadPosition.value = targetX;

    // Seek video to the calculated time
    seekVideoToTime(constrainedTime);
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

  // Segment keyboard movement functions

  // Parse selected segment key to get clip ID and segment index
  function parseSelectedSegmentKey(key: string | null): { clipId: string; segmentIndex: number } | null {
    if (!key) return null;

    const parts = key.split('_');
    if (parts.length !== 2) return null;

    const clipId = parts[0];
    const segmentIndex = parseInt(parts[1], 10);

    if (isNaN(segmentIndex)) return null;

    return { clipId, segmentIndex };
  }

  // Get all selected segments grouped by clip
  function getSelectedSegmentsByClip(): Map<string, number[]> {
    const segmentsByClip = new Map<string, number[]>();

    selectedSegmentKeys.value.forEach((segmentKey) => {
      const parsed = parseSelectedSegmentKey(segmentKey);
      if (parsed) {
        const { clipId, segmentIndex } = parsed;
        if (!segmentsByClip.has(clipId)) {
          segmentsByClip.set(clipId, []);
        }
        segmentsByClip.get(clipId)!.push(segmentIndex);
      }
    });

    // Sort segment indices for each clip
    segmentsByClip.forEach((indices) => indices.sort((a, b) => a - b));

    return segmentsByClip;
  }

  // Check if segments from different clips are selected
  function hasMultipleSegmentsFromDifferentClips(): boolean {
    const segmentsByClip = getSelectedSegmentsByClip();
    return segmentsByClip.size > 1;
  }

  // Check if selected segments can be merged (touching or within 2 seconds)
  function canMergeSelectedSegments(): boolean {
    if (selectedSegmentKeys.value.size < 2) return false;

    const segmentsByClip = getSelectedSegmentsByClip();

    // Only allow merging segments from the same clip
    if (segmentsByClip.size !== 1) return false;

    const [[clipId, segmentIndices]] = segmentsByClip.entries();
    const clip = localClips.value.find((c) => c.id === clipId);
    if (!clip || !clip.segments) return false;

    // Sort indices to check adjacency
    const sortedIndices = [...segmentIndices].sort((a, b) => a - b);

    // Check if all segments are touching or within 2 seconds of each other
    for (let i = 0; i < sortedIndices.length - 1; i++) {
      const currentIndex = sortedIndices[i];
      const nextIndex = sortedIndices[i + 1];

      const currentSegment = clip.segments[currentIndex];
      const nextSegment = clip.segments[nextIndex];

      if (!currentSegment || !nextSegment) return false;

      // Check if segments are touching or have a gap <= 2 seconds
      const gap = nextSegment.start_time - currentSegment.end_time;
      if (gap > 2.0) return false;
    }

    return true;
  }

  // Move multiple selected segments by keyboard
  async function moveSelectedSegments(direction: 'left' | 'right') {
    if (selectedSegmentKeys.value.size === 0) return;

    const segmentsByClip = getSelectedSegmentsByClip();
    const moveAmount = direction === 'left' ? -SEGMENT_MOVE_AMOUNT : SEGMENT_MOVE_AMOUNT;

    try {
      // Process each clip's selected segments
      for (const [clipId, segmentIndices] of segmentsByClip.entries()) {
        // Find the clip
        const clip = localClips.value.find((c) => c.id === clipId);
        if (!clip || !clip.segments) continue;

        // Sort segment indices in descending order when moving left to avoid index conflicts
        const sortedIndices =
          direction === 'left' ? [...segmentIndices].sort((a, b) => b - a) : [...segmentIndices].sort((a, b) => a - b);

        // Move each segment
        for (const segmentIndex of sortedIndices) {
          if (!clip.segments[segmentIndex]) continue;

          const segment = clip.segments[segmentIndex];
          let newStartTime = segment.start_time + moveAmount;
          let newEndTime = segment.end_time + moveAmount;

          // Apply boundaries
          newStartTime = Math.max(0, newStartTime);
          newEndTime = Math.min(props.duration || Infinity, newEndTime);

          // Ensure minimum duration
          const minDuration = 0.5;
          if (newEndTime - newStartTime < minDuration) {
            if (direction === 'left') {
              newStartTime = newEndTime - minDuration;
            } else {
              newEndTime = newStartTime + minDuration;
            }
          }

          // Update database
          await updateClipSegment(clipId, segmentIndex, newStartTime, newEndTime);

          // Update local state for visual feedback
          const clipIndex = localClips.value.findIndex((c) => c.id === clipId);
          if (clipIndex !== -1) {
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
        }
      }
    } catch (error) {
      console.error('Error moving segments:', error);
      showWarning(`Failed to move segments: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Refresh clips data to revert to correct state
      emit('refreshClipsData');
    }
  }

  // Start continuous segment movement
  function startContinuousSegmentMove(direction: 'left' | 'right') {
    if (selectedSegmentKeys.value.size === 0 || isMovingSegment.value) return;

    // Prevent moving multiple segments from different clips
    if (hasMultipleSegmentsFromDifferentClips()) {
      showWarning(
        'Cannot move segments from different clips simultaneously. Please select segments from only one clip.'
      );
      return;
    }

    isMovingSegment.value = true;
    segmentMoveDirection.value = direction;

    // Initial move (fire and forget for continuous movement)
    moveSelectedSegments(direction).catch(console.error);

    // Start continuous movement
    segmentMoveInterval.value = setInterval(() => {
      moveSelectedSegments(direction).catch(console.error);
    }, SEGMENT_MOVE_DELAY);
  }

  // Stop continuous segment movement
  function stopContinuousSegmentMove() {
    if (segmentMoveInterval.value) {
      clearInterval(segmentMoveInterval.value);
      segmentMoveInterval.value = null;
    }

    isMovingSegment.value = false;
    segmentMoveDirection.value = null;
  }

  // Delete selected segments
  function deleteSelectedSegments() {
    if (selectedSegmentKeys.value.size === 0) return;

    const segmentsByClip = getSelectedSegmentsByClip();
    const totalSegments = selectedSegmentKeys.value.size;

    // Check if any clips will be fully deleted (all segments selected)
    const clipsToFullyDelete: string[] = [];
    for (const [clipId, segmentIndices] of segmentsByClip.entries()) {
      const clip = localClips.value.find((c) => c.id === clipId);
      if (clip && clip.segments && segmentIndices.length >= clip.segments.length) {
        clipsToFullyDelete.push(clip.title || clipId);
      }
    }

    // Build descriptive message for the dialog
    let deleteTitle: string;
    if (clipsToFullyDelete.length > 0) {
      // Some clips will be fully deleted
      if (clipsToFullyDelete.length === 1 && totalSegments === 1) {
        deleteTitle = `"${clipsToFullyDelete[0]}" (entire clip)`;
      } else {
        deleteTitle = `${totalSegments} segment${totalSegments > 1 ? 's' : ''} (will delete ${clipsToFullyDelete.length} clip${clipsToFullyDelete.length > 1 ? 's' : ''})`;
      }
    } else {
      deleteTitle = totalSegments === 1 ? '1 segment' : `${totalSegments} segments`;
    }

    // Store the deletion info for the dialog
    segmentToDelete.value = {
      clipId: '', // Not used for multi-delete
      segmentIndex: totalSegments, // Store count instead
      clipTitle: deleteTitle,
    };

    // Show the confirmation dialog
    showDeleteSegmentDialog.value = true;
  }

  // Handle segment deletion confirmation
  async function deleteSegmentConfirmed() {
    if (!segmentToDelete.value) return;

    const segmentsByClip = getSelectedSegmentsByClip();

    try {
      // Delete segments from database, process in reverse order to avoid index conflicts
      const sortedEntries = Array.from(segmentsByClip.entries());

      for (const [clipId, segmentIndices] of sortedEntries) {
        const clip = localClips.value.find((c) => c.id === clipId);

        // If deleting all segments of a clip, delete the entire clip instead
        if (clip && clip.segments && segmentIndices.length >= clip.segments.length) {
          await deleteClip(clipId);
          console.log(`Deleted entire clip ${clipId} (all segments selected)`);
        } else {
          // Sort segment indices in descending order to avoid index shifting issues
          const sortedIndices = [...segmentIndices].sort((a, b) => b - a);

          for (const segmentIndex of sortedIndices) {
            await deleteClipSegment(clipId, segmentIndex);
            console.log(`Deleted segment ${segmentIndex} from clip ${clipId}`);
          }
        }
      }

      // Clear the selection since segments are being deleted
      selectedSegmentKeys.value.clear();

      // Refresh clips data to show updated segments
      emit('refreshClipsData');
    } catch (error) {
      console.error('Error deleting segments:', error);
      showWarning(`Failed to delete segments: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // Close the dialog and clear the stored info
      showDeleteSegmentDialog.value = false;
      segmentToDelete.value = null;
    }
  }

  // Handle segment deletion dialog close
  function handleDeleteSegmentDialogClose() {
    showDeleteSegmentDialog.value = false;
    segmentToDelete.value = null;
    // Don't clear selection here - user might cancel the deletion
  }

  // Handle segment merge confirmation
  async function mergeSegmentsConfirmed() {
    if (!segmentsToMerge.value) return;

    const { clipId, segmentIndices, clipTitle } = segmentsToMerge.value;

    try {
      // We need to create a mergeSegments function in the database
      // For now, we'll use the existing database structure by deleting intermediate segments
      // and updating the first and last segments to cover the merged range

      const clip: Clip | undefined = localClips.value.find((c) => c.id === clipId);
      if (!clip || !clip.segments) throw new Error('Clip not found');

      // Sort indices in descending order for deletion to avoid index conflicts
      const sortedIndices = [...segmentIndices].sort((a, b) => b - a);

      // Get the first and last segments that will remain
      const firstIndex = sortedIndices[sortedIndices.length - 1];
      const lastIndex = sortedIndices[0];

      const firstSegment = clip.segments[firstIndex];
      const lastSegment = clip.segments[lastIndex];

      // Calculate the merged segment times
      const mergedStartTime = firstSegment.start_time;
      const mergedEndTime = lastSegment.end_time;

      // Update the first segment to cover the merged range
      await updateClipSegment(clipId, firstIndex, mergedStartTime, mergedEndTime);

      // Realign transcript for the merged segment if needed
      await realignClipSegment(
        clipId,
        firstIndex,
        firstSegment.start_time,
        firstSegment.end_time,
        mergedStartTime,
        mergedEndTime
      );

      // Delete all intermediate segments (except the first one which we updated)
      for (let i = 0; i < sortedIndices.length - 1; i++) {
        const indexToDelete = sortedIndices[i];
        if (indexToDelete !== firstIndex) {
          await deleteClipSegment(clipId, indexToDelete);
        }
      }

      // Clear the selection
      selectedSegmentKeys.value.clear();

      // Refresh clips data to show updated segments
      emit('refreshClipsData');

      console.log(`Merged ${segmentIndices.length} segments from ${clipTitle}`);
    } catch (error) {
      console.error('Error merging segments:', error);
      showWarning(`Failed to merge segments: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // Close the dialog and clear the stored info
      showMergeSegmentsDialog.value = false;
      segmentsToMerge.value = null;
    }
  }

  // Cancel merge segments
  function cancelMergeSegments() {
    showMergeSegmentsDialog.value = false;
    segmentsToMerge.value = null;
    // Don't clear selection here - user might cancel the merge
  }

  // Handle warning dialog close
  function handleWarningDialogClose() {
    showWarningDialog.value = false;
    warningMessage.value = '';
  }

  // Show warning dialog
  function showWarning(message: string) {
    warningMessage.value = message;
    showWarningDialog.value = true;
  }

  // Merge selected segments
  function mergeSelectedSegments() {
    if (!canMergeSelectedSegments()) {
      showWarning(
        'Cannot merge segments: Please select at least 2 segments from the same clip that are touching or within 2 seconds of each other.'
      );
      return;
    }

    const segmentsByClip = getSelectedSegmentsByClip();
    const [[clipId, segmentIndices]] = segmentsByClip.entries();
    const clip = localClips.value.find((c) => c.id === clipId);

    // Store merge info for the dialog
    segmentsToMerge.value = {
      clipId,
      segmentIndices: [...segmentIndices].sort((a, b) => a - b), // Sort indices
      clipTitle: clip?.title || 'Unknown clip',
    };

    // Show the confirmation dialog
    showMergeSegmentsDialog.value = true;
  }

  // Cut tool functions

  // Toggle cut tool on/off
  function toggleCutTool() {
    isCutToolActive.value = !isCutToolActive.value;
    console.log(`[CUTTING] toggleCutTool - isCutToolActive: ${isCutToolActive.value}`);

    // Reset cut hover state when deactivating
    if (!isCutToolActive.value) {
      cutHoverInfo.value = null;
      hoveredSegmentKey.value = null;
    }

    // Clear timeline hover states when activating
    if (isCutToolActive.value) {
      // Deactivate add clip mode if it was active
      isAddClipModeActive.value = false;

      showTimelineHoverLine.value = false;
      showTimelineTooltip.value = false;
      clearTooltipData();
      // Clear parent hover state
      emit('timelineMouseLeave');
      // Clear any existing drag/resize states
      isDraggingSegment.value = false;
      isResizingSegment.value = false;
      draggedSegmentInfo.value = null;
      resizeHandleInfo.value = null;
    }
  }

  // Handle segment hover for cut preview
  function onSegmentHoverForCut(event: MouseEvent, clipId: string, segmentIndex: number, segment: ClipSegment) {
    console.log(
      `[CUTTING] onSegmentHoverForCut called for ${clipId}_${segmentIndex}, isCutToolActive: ${isCutToolActive.value}`
    );
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
    console.log(`[CUTTING] createCutHoverInfo returned:`, cutInfo);

    cutHoverInfo.value = cutInfo;
    console.log(`[CUTTING] cutHoverInfo.value set to:`, cutHoverInfo.value);
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

  // Manual clip creation functions

  // Toggle add clip mode
  function toggleAddClipMode() {
    isAddClipModeActive.value = !isAddClipModeActive.value;
    console.log(`[Timeline] Add clip mode: ${isAddClipModeActive.value ? 'activated' : 'deactivated'}`);

    if (isAddClipModeActive.value) {
      // Deactivate cut tool if add clip mode is activated
      if (isCutToolActive.value) {
        isCutToolActive.value = false;
        cutHoverInfo.value = null;
      }

      // Clear any existing hover/selection states
      showTimelineHoverLine.value = false;
      showTimelineTooltip.value = false;
      clearTooltipData();

      // Clear segment selection to avoid confusion
      selectedSegmentKeys.value.clear();

      // Clear any segment hover states
      hoveredSegmentKey.value = null;
    }
  }

  // Open create clip dialog with selected time range
  function openCreateClipDialog(startTime: number, endTime: number) {
    // Ensure start is before end
    createClipStartTime.value = Math.min(startTime, endTime);
    createClipEndTime.value = Math.max(startTime, endTime);
    showCreateClipDialog.value = true;

    // Deactivate add clip mode while dialog is open
    isAddClipModeActive.value = false;

    console.log(
      `[Timeline] Opening create clip dialog: ${createClipStartTime.value.toFixed(2)}s - ${createClipEndTime.value.toFixed(2)}s`
    );
  }

  // Cancel create clip
  function cancelCreateClip() {
    showCreateClipDialog.value = false;
    createClipStartTime.value = 0;
    createClipEndTime.value = 0;
  }

  // Confirm create clip
  async function confirmCreateClip(data: { name: string; description: string }) {
    if (!props.projectId) {
      console.error('[Timeline] Cannot create clip: no project ID');
      showWarning('Cannot create clip: no project selected');
      cancelCreateClip();
      return;
    }

    try {
      console.log('[Timeline] Creating manual clip:', {
        name: data.name,
        startTime: createClipStartTime.value,
        endTime: createClipEndTime.value,
        projectId: props.projectId,
      });

      // Create the clip in the database
      const clipId = await createManualClip(props.projectId, {
        name: data.name,
        startTime: createClipStartTime.value,
        endTime: createClipEndTime.value,
        description: data.description,
      });

      console.log('[Timeline] Manual clip created successfully:', clipId);

      // Close the dialog
      showCreateClipDialog.value = false;
      createClipStartTime.value = 0;
      createClipEndTime.value = 0;

      // Refresh clips data to show the new clip
      emit('refreshClipsData');
    } catch (error) {
      console.error('[Timeline] Error creating manual clip:', error);
      showWarning(`Failed to create clip: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Confirm adding segment to existing clip
  async function confirmAddSegment(data: { clipId: string }) {
    if (!props.projectId) {
      console.error('[Timeline] Cannot add segment: no project ID');
      showWarning('Cannot add segment: no project selected');
      cancelCreateClip();
      return;
    }

    try {
      console.log('[Timeline] Adding segment to clip:', {
        clipId: data.clipId,
        startTime: createClipStartTime.value,
        endTime: createClipEndTime.value,
        projectId: props.projectId,
      });

      // Add the segment to the existing clip
      const segmentId = await addSegmentToClip(data.clipId, props.projectId, {
        startTime: createClipStartTime.value,
        endTime: createClipEndTime.value,
      });

      console.log('[Timeline] Segment added successfully:', segmentId);

      // Close the dialog
      showCreateClipDialog.value = false;
      createClipStartTime.value = 0;
      createClipEndTime.value = 0;

      // Refresh clips data to show the updated clip
      emit('refreshClipsData');
    } catch (error) {
      console.error('[Timeline] Error adding segment to clip:', error);
      showWarning(`Failed to add segment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Context menu functions

  // Handle segment context menu (right-click)
  function onSegmentContextMenu(
    event: MouseEvent,
    clipId: string,
    segmentIndex: number,
    segment: ClipSegment,
    clipTitle: string
  ) {
    // Don't show context menu during other operations
    if (isCutToolActive.value || isDraggingSegment.value || isResizingSegment.value || isAddClipModeActive.value) {
      return;
    }

    // Select the segment if not already selected
    const segmentKey = `${clipId}_${segmentIndex}`;
    if (!selectedSegmentKeys.value.has(segmentKey)) {
      selectedSegmentKeys.value.clear();
      selectedSegmentKeys.value.add(segmentKey);
    }

    // Set context menu info
    contextMenuInfo.value = {
      clipId,
      segmentIndex,
      clipTitle,
      segmentStart: segment.start_time,
      segmentEnd: segment.end_time,
      x: event.clientX,
      y: event.clientY,
    };
    showContextMenu.value = true;
  }

  // Close context menu
  function closeContextMenu() {
    showContextMenu.value = false;
    contextMenuInfo.value = null;
  }

  // Handle context menu action
  function handleContextMenuAction(action: string, info: ContextMenuInfo) {
    console.log(`[Timeline] Context menu action: ${action}`, info);

    switch (action) {
      case 'play':
        // Seek to segment start and play the video
        playSegmentFromTime(info.segmentStart);
        break;

      case 'split':
        // Split at the current playhead position if it's within the segment
        splitSegmentAtPlayhead(info);
        break;

      case 'delete':
        // Delete the segment
        deleteSelectedSegments();
        break;

      default:
        console.log(`[Timeline] Unknown context menu action: ${action}`);
    }
  }

  // Play video starting from a specific time
  function playSegmentFromTime(startTime: number) {
    // Emit event to parent to handle seeking and playback
    // This ensures the parent's isPlaying state is properly updated
    emit('playFromTime', startTime);
  }

  // Split segment at the current playhead position
  async function splitSegmentAtPlayhead(info: ContextMenuInfo) {
    const currentTime = props.currentTime;

    // Check if playhead is within the segment bounds
    if (currentTime <= info.segmentStart || currentTime >= info.segmentEnd) {
      showWarning(
        `Cannot split: Playhead must be within the segment (${formatDurationForWarning(info.segmentStart)} - ${formatDurationForWarning(info.segmentEnd)}). Current position: ${formatDurationForWarning(currentTime)}`
      );
      return;
    }

    try {
      // Perform the split at the current playhead position
      await splitClipSegment(info.clipId, info.segmentIndex, currentTime);

      // Clear the segment selection
      selectedSegmentKeys.value.clear();

      // Refresh clips data to show the split segments
      emit('refreshClipsData');

      console.log(`[Timeline] Split segment at ${currentTime.toFixed(2)}s`);
    } catch (error) {
      console.error('[Timeline] Error splitting segment:', error);
      showWarning(`Failed to split segment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Format duration for warning messages
  function formatDurationForWarning(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }

  // Clip context menu functions

  // Handle clip track context menu (right-click on empty area of clip track)
  function onClipContextMenu(event: MouseEvent, clipId: string, clipTitle: string) {
    // Don't show context menu during other operations
    if (isCutToolActive.value || isDraggingSegment.value || isResizingSegment.value || isAddClipModeActive.value) {
      return;
    }

    // Close any open segment context menu
    showContextMenu.value = false;
    contextMenuInfo.value = null;

    // Set clip context menu info
    clipContextMenuInfo.value = {
      clipId,
      clipTitle,
      x: event.clientX,
      y: event.clientY,
    };
    showClipContextMenu.value = true;
  }

  // Close clip context menu
  function closeClipContextMenu() {
    showClipContextMenu.value = false;
    clipContextMenuInfo.value = null;
  }

  // Handle play clip action from context menu
  function handlePlayClip(clipId: string) {
    // Find the clip and get its first segment's start time
    const clip = localClips.value.find((c) => c.id === clipId);
    if (!clip || !clip.segments || clip.segments.length === 0) {
      showWarning('Cannot play clip: No segments found.');
      return;
    }

    // Get the earliest start time from all segments
    const earliestStart = Math.min(...clip.segments.map((s) => s.start_time));

    // Emit play from the start of the clip
    emit('playFromTime', earliestStart);

    console.log(`[Timeline] Playing clip "${clip.title}" from ${earliestStart.toFixed(2)}s`);
  }

  // Handle edit clip action from context menu
  function handleEditClip(clipId: string) {
    emit('editClip', clipId);
    console.log(`[Timeline] Opening clip editor for clip "${clipId}"`);
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

  /* Add clip mode - show crosshair cursor to indicate selection mode */
  .timeline-content-wrapper.add-clip-mode {
    cursor: crosshair;
  }

  .timeline-content-wrapper.add-clip-mode * {
    cursor: crosshair !important;
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
