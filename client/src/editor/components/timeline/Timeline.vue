<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
  import { useEditor } from '../../composables/useEditor';
  import { useTimelineTracks } from '../../composables/timeline/useTimelineTracks';
  import { useTimelineZoom } from '../../composables/timeline/useTimelineZoom';
  import { useElementInteraction } from '../../composables/timeline/element/useElementInteraction';
  import { useElementSelection } from '../../composables/timeline/element/useElementSelection';
  import { useTimelinePlayhead } from '../../composables/timeline/useTimelinePlayhead';
  import { useTimelineSeek } from '../../composables/timeline/useTimelineSeek';
  import { useTimelineDragDrop } from '../../composables/timeline/useTimelineDragDrop';
  import { useSelectionBox } from '../../composables/timeline/useSelectionBox';
  import { useScrollSync } from '../../composables/timeline/useScrollSync';
  import { useTimelineTools } from '../../composables/timeline/useTimelineTools';
  import { useTimelineViewport } from '../../composables/timeline/useTimelineViewport';
  import { UpdateCoverTimestampCommand } from '../../lib/commands/project/update-cover-timestamp';
  import { TIMELINE_CONSTANTS } from '../../constants/timeline-constants';
  import {
    getTrackHeight,
    getCumulativeHeightBefore,
    getTotalTracksHeight,
    getTimelineZoomMin,
    getTimelinePaddingPx,
    canTracktHaveAudio,
    canTrackBeHidden,
  } from '../../lib/timeline';
  import type { TrackType } from '../../types/timeline';
  import type { SnapPoint } from '../../composables/timeline/useTimelineSnapping';

  import TimelineToolbar from './TimelineToolbar.vue';
  import TimelineRuler from './TimelineRuler.vue';
  import TimelinePlayhead from './TimelinePlayhead.vue';
  import TimelineTrackContent from './TimelineTrackContent.vue';
  import SnapIndicator from './SnapIndicator.vue';
  import DragLine from './DragLine.vue';
  import SelectionBox from '../SelectionBox.vue';
  import TimelineScrollbar from './TimelineScrollbar.vue';
  import TimelineContextMenu from './TimelineContextMenu.vue';
  import KeyframePopup from './KeyframePopup.vue';
  import {
    Lock,
    Unlock,
    Volume2,
    VolumeX,
    Eye,
    EyeOff,
    Plus,
    Trash2,
    ImageIcon,
    ArrowRightLeft,
    Film,
    Music,
    Type,
    Smile,
    Sparkles,
    MessageSquare,
  } from 'lucide-vue-next';
  import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
  import { useToast } from '@/composables/useToast';

  const tracksContainerHeight = { min: 0 };

  const { success: toastSuccess } = useToast();

  const { editor, version } = useEditor({
    subscribe: {
      playback: false,
      timeline: false,
      scenes: true,
      project: false,
      media: false,
      selection: false,
    },
  });
  const { tracks, totalDuration: timelineDuration } = useTimelineTracks();
  const { clearElementSelection, setElementSelection, selectedElements, selectedTransitionId, selectAllInTrack, selectTransition } = useElementSelection();

  // Context menu state
  const contextMenuPos = ref<{ x: number; y: number } | null>(null);
  const contextMenuElement = ref<{ trackId: string; elementId: string } | null>(null);

  function handleContextMenu(params: { event: MouseEvent; element: { id: string }; track: { id: string } }) {
    params.event.preventDefault();
    params.event.stopPropagation();
    contextMenuPos.value = { x: params.event.clientX, y: params.event.clientY };
    contextMenuElement.value = { trackId: params.track.id, elementId: params.element.id };
  }

  function handleEmptyContextMenu(event: MouseEvent) {
    event.preventDefault();
    contextMenuPos.value = { x: event.clientX, y: event.clientY };
    contextMenuElement.value = null;
  }

  function closeContextMenu() {
    contextMenuPos.value = null;
    contextMenuElement.value = null;
  }

  // Track management
  function addTrack(type: TrackType) {
    editor.timeline.addTrack({ type });
  }

  function getTrackAccentColor(type: TrackType): string {
    const colors: Record<TrackType, string> = {
      video: '#71717a',
      text: '#7CCDB8',
      audio: '#A87BD4',
      sticker: '#F59E0B',
      effect: '#E040FB',
      caption: '#38BDF8',
    };
    return colors[type];
  }

  function getTrackPaddingY(type: TrackType): string {
    const h = getTrackHeight({ type });
    if (h >= 70) return '12px';
    if (h >= 45) return '8px';
    if (h >= 30) return '4px';
    return '2px';
  }

  function removeTrack(trackId: string) {
    editor.timeline.removeTrack({ trackId });
  }

  function toggleTrackLock(trackId: string) {
    editor.timeline.toggleTrackLock({ trackId });
  }

  function toggleTrackMute(trackId: string) {
    editor.timeline.toggleTrackMute({ trackId });
  }

  function toggleTrackVisibility(trackId: string) {
    editor.timeline.toggleTrackVisibility({ trackId });
  }

  function openCoverEditor() {
    const currentTime = editor.playback.getCurrentTime();
    const command = new UpdateCoverTimestampCommand(currentTime);
    editor.command.execute({ command });
    const seconds = currentTime.toFixed(2);
    toastSuccess(
      'Cover image set',
      `Export will use the frame at ${seconds}s (current playhead).`,
    );
  }

  // Refs
  const timelineRef = ref<HTMLDivElement | null>(null);
  const timelineHeaderRef = ref<HTMLDivElement | null>(null);
  const rulerRef = ref<HTMLDivElement | null>(null);
  const tracksContainerRef = ref<HTMLDivElement | null>(null);
  const tracksScrollRef = ref<HTMLDivElement | null>(null);
  const trackLabelsRef = ref<HTMLDivElement | null>(null);
  const playheadRef = ref<HTMLDivElement | null>(null);
  const trackLabelsScrollRef = ref<HTMLDivElement | null>(null);

  /** Observed height of the tracks scroll viewport — drives vertical centering offset. */
  const tracksContainerClientHeight = ref(0);
  const tracksViewportWidth = ref(1000);
  const totalTracksHeight = computed(() => getTotalTracksHeight({ tracks: tracks.value }));
  const tracksVerticalOffset = computed(() => {
    const containerH = tracksContainerClientHeight.value;
    const contentH = totalTracksHeight.value;
    if (containerH <= 0 || contentH >= containerH) return 0;
    return Math.min(16, Math.floor(containerH - contentH));
  });

  // State
  const isResizing = ref(false);
  const currentSnapPoint = ref<SnapPoint | null>(null);
  const { mainTrackMagnet, autoSnapping, linkage, toggleMainTrackMagnet, toggleAutoSnapping, toggleLinkage } =
    useTimelineTools();
  const razorMode = ref(false);
  const autoFollow = ref(true);

  function toggleAutoFollow() {
    autoFollow.value = !autoFollow.value;
  }

  function toggleRazorMode() {
    razorMode.value = !razorMode.value;
  }

  function handleRazorCut(params: { trackId: string; elementId: string; time: number }) {
    editor.timeline.splitElements({
      elements: [{ trackId: params.trackId, elementId: params.elementId }],
      splitTime: params.time,
    });
  }

  function handleSnapPointChange(snapPoint: SnapPoint | null) {
    currentSnapPoint.value = snapPoint;
  }

  function handleResizeStateChange({ isResizing: nextIsResizing }: { isResizing: boolean }) {
    isResizing.value = nextIsResizing;
    if (!nextIsResizing) {
      currentSnapPoint.value = null;
    }
  }

  const containerWidth = computed(() => tracksContainerRef.value?.clientWidth || 1000);

  const minZoomLevel = computed(() =>
    getTimelineZoomMin({
      duration: timelineDuration.value,
      containerWidth: containerWidth.value,
    })
  );

  const savedViewState = editor.project.getTimelineViewState();

  const { zoomLevel, setZoomLevel, handleWheel, saveScrollPosition } = useTimelineZoom({
    containerRef: timelineRef,
    minZoom: minZoomLevel,
    initialZoom: savedViewState?.zoomLevel,
    initialScrollLeft: savedViewState?.scrollLeft,
    initialPlayheadTime: savedViewState?.playheadTime,
    tracksScrollRef,
    rulerScrollRef: tracksScrollRef,
  });

  const { dragState, dragDropTarget, dragRippleShifts, handleElementMouseDown, handleElementClick, getLastMouseX } =
    useElementInteraction({
      zoomLevel,
      timelineRef,
      tracksContainerRef,
      tracksScrollRef,
      headerRef: timelineHeaderRef,
      tracksVerticalOffset,
      snappingEnabled: autoSnapping,
      onSnapPointChange: handleSnapPointChange,
    });

  const {
    duration: playheadDuration,
    isPlaying: isTimelinePlaying,
    playheadPosition,
    handlePlayheadMouseDown: handlePlayheadRulerMouseDown,
    handleRulerMouseDown: handleRulerScrubMouseDown,
    isScrubbing: isPlayheadScrubbing,
  } = useTimelinePlayhead({
    zoomLevel,
    rulerRef,
    rulerScrollRef: tracksScrollRef,
    tracksScrollRef,
    playheadRef,
    autoFollow,
  });

  const scrollLeft = ref(0);
  const { visibleRange } = useTimelineViewport({
    scrollLeft,
    viewportWidth: tracksViewportWidth,
    zoomLevel,
  });
  const trackLabelsWidth = computed(() =>
    tracks.value.length > 0 && trackLabelsRef.value ? trackLabelsRef.value.offsetWidth : 0
  );
  const timelineHeight = computed(() => timelineRef.value?.offsetHeight ?? 400);

  const { isDragOver, dropTarget, dragElementType, transitionDropPreview, handleFileDrop } =
    useTimelineDragDrop({
      containerRef: tracksContainerRef,
      headerRef: timelineHeaderRef,
      scrollRef: tracksScrollRef,
      zoomLevel,
      tracksVerticalOffset,
    });

  const {
    selectionBox,
    handleMouseDown: handleSelectionMouseDown,
    isSelecting,
    shouldIgnoreClick,
  } = useSelectionBox({
    containerRef: tracksContainerRef,
    onSelectionComplete: (elements) => {
      setElementSelection({ elements });
    },
    tracksScrollRef,
    zoomLevel,
  });

  // Derive element type for internal element drag (reorder/move)
  const dragElementTypeForReorder = computed(() => {
    if (!dragState.value.isDragging || !dragState.value.trackId || !dragState.value.elementId) return null;
    const track = tracks.value.find(t => t.id === dragState.value.trackId);
    if (!track) return null;
    const element = track.elements.find(e => e.id === dragState.value.elementId);
    return element?.type ?? null;
  });

  // ── New-track insert gap: spread tracks apart to show insertion point ──
  const INSERT_GAP_SIZE = 20;

  const DROP_COLORS: Record<string, string> = {
    video: '#3b82f6', image: '#3b82f6', audio: '#22c55e',
    text: '#f59e0b', sticker: '#ec4899', effect: '#a855f7',
  };

  const activeNewTrackDrop = computed(() => {
    if (isDragOver.value && dropTarget.value?.isNewTrack) {
      return { index: dropTarget.value.trackIndex, elementType: dragElementType.value };
    }
    if (dragState.value.isDragging && dragDropTarget.value?.isNewTrack) {
      return { index: dragDropTarget.value.trackIndex, elementType: dragElementTypeForReorder.value };
    }
    return null;
  });

  const insertIndicatorColor = computed(() => {
    const type = activeNewTrackDrop.value?.elementType;
    if (!type) return '#3b82f6';
    return DROP_COLORS[type] ?? '#3b82f6';
  });

  function getTrackTopWithInsertGap(trackIndex: number): number {
    const base = getCumulativeHeightBefore({ tracks: tracks.value, trackIndex }) + tracksVerticalOffset.value;
    if (activeNewTrackDrop.value && trackIndex >= activeNewTrackDrop.value.index) {
      return base + INSERT_GAP_SIZE;
    }
    return base;
  }

  const insertLineTop = computed(() => {
    if (!activeNewTrackDrop.value) return 0;
    const idx = activeNewTrackDrop.value.index;
    const base = getCumulativeHeightBefore({ tracks: tracks.value, trackIndex: idx }) + tracksVerticalOffset.value;
    // Center the line in the total gap (original TRACK_GAP + INSERT_GAP_SIZE)
    return base + INSERT_GAP_SIZE / 2;
  });

  const effectDropTargetId = computed(() => {
    if (!isDragOver.value || !dropTarget.value?.targetElementId) return null;
    return dropTarget.value.targetElementId;
  });

  const effectDropTargetTrackId = computed(() => {
    if (!isDragOver.value || !dropTarget.value?.targetTrackId) return null;
    return dropTarget.value.targetTrackId;
  });

  /**
   * Existing transitions rendered as badges on the timeline between segments.
   * Includes a duration span centered at the clip junction.
   */
  const transitionBadgesByTrack = computed(() => {
    void version.value;
    let scene;
    try {
      scene = editor.scenes.getActiveSceneOrNull();
    } catch {
      return new Map();
    }
    if (!scene?.transitions?.length) return new Map();

    type TransitionBadge = {
      trackId: string;
      transitionId: string;
      xPx: number;
      startPx: number;
      widthPx: number;
      label: string;
      targetElementId: string;
    };
    const result = new Map<string, TransitionBadge[]>();
    const pps = TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel.value;
    const targets = new Map<string, { trackId: string; startTime: number }>();
    for (const track of tracks.value) {
      for (const element of track.elements) {
        targets.set(element.id, { trackId: track.id, startTime: element.startTime });
      }
    }

    for (const transition of scene.transitions) {
      const target = targets.get(transition.targetElementId);
      if (!target) continue;

      const xPx = target.startTime * pps;
      // Keep the complete transition span selectable even when zoomed out.
      const widthPx = Math.max(32, transition.duration * pps);
      const startPx = xPx - widthPx / 2;
      const endPx = startPx + widthPx;
      const visibleStartPx = visibleRange.value.startTime * pps;
      const visibleEndPx = visibleRange.value.endTime * pps;
      if (endPx < visibleStartPx || startPx > visibleEndPx) continue;

      const badge: TransitionBadge = {
        trackId: target.trackId,
        transitionId: transition.id,
        xPx,
        startPx,
        widthPx,
        label: transition.type,
        targetElementId: transition.targetElementId,
      };
      const trackBadges = result.get(target.trackId);
      if (trackBadges) trackBadges.push(badge);
      else result.set(target.trackId, [badge]);
    }
    return result;
  });

  /** Centered CapCut-style preview spanning both clips at the target junction. */
  const transitionDropVisual = computed(() => {
    const preview = transitionDropPreview.value;
    if (!isDragOver.value || !preview) return null;
    const pps = TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel.value;
    const width = Math.max(48, preview.duration * pps);
    return {
      ...preview,
      x: preview.junctionTime * pps,
      left: preview.junctionTime * pps - width / 2,
      width,
    };
  });

  const contentWidth = computed(() => timelineDuration.value * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel.value);

  const paddingPx = computed(() =>
    getTimelinePaddingPx({
      containerWidth: containerWidth.value,
      zoomLevel: zoomLevel.value,
      minZoom: minZoomLevel.value,
    })
  );

  const dynamicTimelineWidth = computed(() => Math.max(contentWidth.value + paddingPx.value, containerWidth.value));

  const showSnapIndicator = computed(
    () =>
      autoSnapping.value && // Use the shared autoSnapping
      currentSnapPoint.value !== null &&
      (dragState.value.isDragging || isResizing.value)
  );

  const { handleTracksMouseDown, handleTracksClick, handleRulerMouseDown, handleRulerClick } = useTimelineSeek({
    playheadRef,
    trackLabelsRef,
    rulerScrollRef: tracksScrollRef,
    tracksScrollRef,
    zoomLevel,
    duration: timelineDuration,
    isSelecting,
    clearSelectedElements: clearElementSelection,
    seek: (time: number) => editor.playback.seek({ time }),
  });

  /** Ruler inner surface: record click-to-seek tracking, then scrub (playhead composable skips the handle). */
  function onRulerSurfaceMouseDown(event: MouseEvent) {
    handleRulerMouseDown(event);
    handleRulerScrubMouseDown(event);
  }

  useScrollSync({
    tracksScrollRef,
    trackLabelsScrollRef,
  });

  const tracksAreaHeight = computed(() => {
    const base = Math.max(tracksContainerHeight.min, totalTracksHeight.value);
    if (activeNewTrackDrop.value) return base + INSERT_GAP_SIZE;
    return base;
  });

  const playheadTotalHeight = computed(() => {
    // Full scrollable track stack (not viewport) so the line reaches every track.
    return Math.max(0, tracksAreaHeight.value + tracksVerticalOffset.value + 24);
  });

  let tracksResizeObserver: ResizeObserver | null = null;

  onMounted(() => {
    tracksResizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        tracksContainerClientHeight.value = entry.contentRect.height;
        tracksViewportWidth.value = entry.contentRect.width;
      }
    });
    if (tracksScrollRef.value) {
      tracksResizeObserver.observe(tracksScrollRef.value);
    }
  });

  onUnmounted(() => {
    tracksResizeObserver?.disconnect();
    if (isTimelineInteractive.value) editor.setInteractiveDrag(false);
  });

  const isTimelineInteractive = computed(() => dragState.value.isDragging || isResizing.value);
  watch(isTimelineInteractive, (interactive) => {
    editor.setInteractiveDrag(interactive);
  });

  function onTracksScroll() {
    scrollLeft.value = tracksScrollRef.value?.scrollLeft ?? 0;
    saveScrollPosition();
  }

  function onTrackLabelsWheel(event: WheelEvent) {
    const tracksEl = tracksScrollRef.value;
    if (!tracksEl) return;
    tracksEl.scrollTop += event.deltaY;
  }

  function onScrollAreaWheel(event: WheelEvent) {
    const isZoomGesture = event.ctrlKey || event.metaKey;

    if (isZoomGesture) {
      handleWheel(event);
      return;
    }

    const scrollEl = tracksScrollRef.value;
    if (!scrollEl) return;

    event.preventDefault();

    if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      // Shift+scroll or trackpad horizontal swipe
      scrollEl.scrollLeft += event.shiftKey ? event.deltaY : event.deltaX;
    } else {
      // Vertical scroll: scroll tracks vertically when overflowing, else scroll horizontally
      const canScrollVertically = scrollEl.scrollHeight > scrollEl.clientHeight;
      if (canScrollVertically) {
        scrollEl.scrollTop += event.deltaY;
      } else {
        scrollEl.scrollLeft += event.deltaY;
      }
    }
  }

  function onScrollAreaMouseDown(event: MouseEvent) {
    if (event.target !== event.currentTarget) return;
    event.stopPropagation();
    handleTracksMouseDown(event);
    handleSelectionMouseDown(event);
  }

  function onScrollAreaClick(event: MouseEvent) {
    if (event.target !== event.currentTarget) return;
    event.stopPropagation();
    handleTracksClick(event);
  }

  // Keyframe popup state
  const keyframePopup = ref<{ elementId: string; offset: number; rect: DOMRect } | null>(null);

  function handleKeyframeClick(payload: { elementId: string; offset: number; rect: DOMRect }) {
    keyframePopup.value = payload;
  }

  function closeKeyframePopup() {
    keyframePopup.value = null;
  }

  function scrollToPlayhead() {
    const scrollEl = tracksScrollRef.value;
    if (!scrollEl) return;
    const playheadPx = editor.playback.getCurrentTime() * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel.value;
    const viewportWidth = scrollEl.clientWidth;
    scrollEl.scrollLeft = Math.max(0, playheadPx - viewportWidth / 2);
  }

  function zoomToFit() {
    setZoomLevel(minZoomLevel.value);
    if (tracksScrollRef.value) {
      tracksScrollRef.value.scrollLeft = 0;
    }
  }

  // Track reorder via pointer events
  const trackDragId = ref<string | null>(null);
  const trackDragOverId = ref<string | null>(null);
  const TRACK_DRAG_THRESHOLD = 5;

  function onTrackLabelPointerDown(e: PointerEvent, trackId: string) {
    if (e.button !== 0) return;

    // Prevent dragging Track 0 (main video track)
    const track = tracks.value.find((t) => t.id === trackId);
    if (track && 'isMain' in track && track.isMain) return;

    const startY = e.clientY;
    let started = false;

    function onMove(ev: PointerEvent) {
      if (!started) {
        if (Math.abs(ev.clientY - startY) < TRACK_DRAG_THRESHOLD) return;
        started = true;
        trackDragId.value = trackId;
      }

      // Hit-test: find which track label the cursor is over
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      if (!el) return;
      const labelEl = (el as HTMLElement).closest('[data-track-label-id]') as HTMLElement | null;
      if (labelEl) {
        const overId = labelEl.dataset.trackLabelId!;
        if (overId !== trackId) {
          trackDragOverId.value = overId;
        } else {
          trackDragOverId.value = null;
        }
      }
    }

    function onUp() {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);

      if (started && trackDragId.value && trackDragOverId.value) {
        const targetTrackId = trackDragOverId.value;

        // Prevent dropping onto Track 0 (main video track)
        const targetTrack = tracks.value.find((t) => t.id === targetTrackId);
        if (!(targetTrack && 'isMain' in targetTrack && targetTrack.isMain)) {
          const oldIndex = tracks.value.findIndex((t) => t.id === trackDragId.value);
          const targetIndex = tracks.value.findIndex((t) => t.id === targetTrackId);
          if (oldIndex !== -1 && targetIndex !== -1) {
            editor.timeline.reorderTrack({ trackId: trackDragId.value, newIndex: targetIndex });
          }
        }
      }

      trackDragId.value = null;
      trackDragOverId.value = null;
    }

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }
</script>

<template>
  <section
    class="relative flex h-full flex-col overflow-hidden rounded-sm bg-[#18181b]"
    aria-label="Timeline"
    @dragover.prevent
    @drop="handleFileDrop"
  >
    <TimelineToolbar
      :zoom-level="zoomLevel"
      :min-zoom="minZoomLevel"
      :razor-mode="razorMode"
      :auto-follow="autoFollow"
      :main-track-magnet="mainTrackMagnet"
      :auto-snapping="autoSnapping"
      :linkage="linkage"
      @set-zoom-level="setZoomLevel($event)"
      @toggle-razor-mode="toggleRazorMode"
      @toggle-auto-follow="toggleAutoFollow"
      @toggle-main-track-magnet="toggleMainTrackMagnet"
      @toggle-auto-snapping="toggleAutoSnapping"
      @toggle-linkage="toggleLinkage"
      @scroll-to-playhead="scrollToPlayhead"
      @zoom-to-fit="zoomToFit"
    />

    <div ref="timelineRef" class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <SnapIndicator
        :snap-point="currentSnapPoint"
        :zoom-level="zoomLevel"
        :scroll-left="scrollLeft"
        :track-labels-width="trackLabelsWidth"
        :timeline-height="timelineHeight"
        :is-visible="showSnapIndicator"
      />

      <div class="flex flex-1 overflow-hidden">
        <!-- Track labels sidebar -->
        <div class="flex w-44 shrink-0 flex-col border-r border-white/10 bg-[#18181b]" @wheel.prevent="onTrackLabelsWheel">
          <!-- Header — same h-4 as TimelineRuler so track list starts at identical offset -->
          <div class="flex h-4 shrink-0 items-end justify-between bg-[#18181b] pb-px pl-3 pr-1 mt-2">
            <span class="text-[10px] font-semibold uppercase tracking-widest text-white/25">Tracks</span>
            <div class="flex items-center gap-0.5">
              <button
                class="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 transition-colors hover:bg-white/10 hover:text-zinc-300"
                @click="addTrack('video')"
                title="Add video track"
              >
                <Plus class="size-2.5" />
                V
              </button>
              <button
                class="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 transition-colors hover:bg-white/10 hover:text-zinc-300"
                @click="addTrack('audio')"
                title="Add audio track"
              >
                <Plus class="size-2.5" />
                A
              </button>
              <button
                class="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 transition-colors hover:bg-white/10 hover:text-zinc-300"
                @click="addTrack('text')"
                title="Add text track"
              >
                <Plus class="size-2.5" />
                T
              </button>
            </div>
          </div>

          <!-- Track labels list -->
          <div v-if="tracks.length > 0" ref="trackLabelsRef" class="relative flex-1 min-h-0 -mt-2">
            <div ref="trackLabelsScrollRef" class="absolute inset-0 overflow-y-hidden overflow-x-hidden">
              <div class="flex flex-col gap-1 pb-6" :style="{ paddingTop: `${tracksVerticalOffset}px` }">
                <div
                  v-for="(track, tIdx) in tracks"
                  :key="track.id"
                  :data-track-label-id="track.id"
                  class="group relative flex transition-colors"
                  :class="{
                    'flex-col items-start justify-center gap-1.5': track.type === 'video',
                    'flex-row items-center': track.type !== 'video',
                    'bg-primary/10': trackDragOverId === track.id,
                    'cursor-move': !('isMain' in track && track.isMain),
                    'cursor-not-allowed opacity-60': 'isMain' in track && track.isMain && trackDragId,
                  }"
                  :style="{
                    height: `${getTrackHeight({ type: track.type })}px`,
                    marginTop: activeNewTrackDrop && tIdx === activeNewTrackDrop.index ? `${INSERT_GAP_SIZE}px` : undefined,
                  }"
                  @pointerdown="onTrackLabelPointerDown($event, track.id)"
                >
                  <!-- Drop indicator -->
                  <div
                    v-if="trackDragOverId === track.id"
                    class="absolute left-0 right-0 top-0 z-10 h-0.5 bg-primary"
                  />

                  <!-- Left accent bar -->
                  <div
                    class="absolute left-0 inset-y-1.5 w-[3px] rounded-r-sm"
                    :style="{ background: getTrackAccentColor(track.type) }"
                  />

                  <!-- Row 1: icon + name -->
                  <div
                    class="flex min-w-0 items-center gap-1.5 pl-4"
                    :class="track.type === 'video' ? 'pr-2' : 'flex-1 pr-1'"
                  >
                    <Film
                      v-if="track.type === 'video'"
                      class="size-3.5 shrink-0 opacity-50"
                      :style="{ color: getTrackAccentColor(track.type) }"
                    />
                    <Music
                      v-else-if="track.type === 'audio'"
                      class="size-3.5 shrink-0 opacity-50"
                      :style="{ color: getTrackAccentColor(track.type) }"
                    />
                    <Type
                      v-else-if="track.type === 'text'"
                      class="size-3.5 shrink-0 opacity-50"
                      :style="{ color: getTrackAccentColor(track.type) }"
                    />
                    <Smile
                      v-else-if="track.type === 'sticker'"
                      class="size-3.5 shrink-0 opacity-50"
                      :style="{ color: getTrackAccentColor(track.type) }"
                    />
                    <Sparkles
                      v-else-if="track.type === 'effect'"
                      class="size-3.5 shrink-0 opacity-50"
                      :style="{ color: getTrackAccentColor(track.type) }"
                    />
                    <MessageSquare
                      v-else
                      class="size-3.5 shrink-0 opacity-50"
                      :style="{ color: getTrackAccentColor(track.type) }"
                    />
                    <span
                      class="min-w-0 flex-1 truncate text-[11px] font-medium leading-none text-white/60 transition-colors group-hover:text-white/85 cursor-pointer"
                      title="Select all elements in track"
                      @click="selectAllInTrack({ trackId: track.id })"
                    >
                      {{ track.name }}
                    </span>
                  </div>

                  <!-- Row 2: control buttons -->
                  <div class="flex items-center gap-0.5 pr-1" :class="track.type === 'video' ? 'pl-3' : 'pl-1'">
                    <!-- Cover (main video track only) -->
                    <button
                      v-if="'isMain' in track && track.isMain"
                      type="button"
                      class="rounded p-1 text-zinc-600 transition-colors hover:bg-white/10 hover:text-[#0ea5e9] disabled:pointer-events-none disabled:opacity-40"
                      :disabled="!track.elements.length"
                      @click.stop="openCoverEditor"
                      title="Set export cover image to the frame at the current playhead"
                    >
                      <ImageIcon class="size-3.5" />
                    </button>
                    <!-- Lock -->
                    <button
                      class="rounded p-1 transition-colors hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40"
                      :class="track.locked ? 'text-yellow-400' : 'text-zinc-600 hover:text-zinc-300'"
                      :disabled="!track.elements.length"
                      @click="toggleTrackLock(track.id)"
                      :title="track.locked ? 'Unlock track' : 'Lock track'"
                    >
                      <Lock v-if="track.locked" class="size-3.5" />
                      <Unlock v-else class="size-3.5" />
                    </button>
                    <!-- Mute -->
                    <button
                      v-if="canTracktHaveAudio(track)"
                      class="rounded p-1 transition-colors hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40"
                      :class="track.muted ? 'text-red-400' : 'text-zinc-600 hover:text-zinc-300'"
                      :disabled="!track.elements.length"
                      @click="toggleTrackMute(track.id)"
                      :title="track.muted ? 'Unmute' : 'Mute'"
                    >
                      <VolumeX v-if="track.muted" class="size-3.5" />
                      <Volume2 v-else class="size-3.5" />
                    </button>
                    <!-- Visibility -->
                    <button
                      v-if="canTrackBeHidden(track)"
                      class="rounded p-1 transition-colors hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40"
                      :class="'hidden' in track && track.hidden ? 'text-red-400' : 'text-zinc-600 hover:text-zinc-300'"
                      :disabled="!track.elements.length"
                      @click="toggleTrackVisibility(track.id)"
                      :title="'hidden' in track && track.hidden ? 'Show' : 'Hide'"
                    >
                      <EyeOff v-if="'hidden' in track && track.hidden" class="size-3.5" />
                      <Eye v-else class="size-3.5" />
                    </button>
                    <!-- Delete (non-main, reveals on hover) -->
                    <button
                      v-if="!('isMain' in track && track.isMain)"
                      class="rounded p-1 text-zinc-700 transition-all hover:bg-white/10 hover:text-red-400 opacity-0 group-hover:opacity-100 disabled:pointer-events-none disabled:opacity-0"
                      :disabled="!track.elements.length"
                      @click="removeTrack(track.id)"
                      title="Remove track"
                    >
                      <Trash2 class="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Main timeline content area -->
        <div ref="tracksContainerRef" class="relative flex flex-1 flex-col overflow-hidden">
          <SelectionBox
            :start-pos="selectionBox?.startPos || null"
            :current-pos="selectionBox?.currentPos || null"
            :container-el="tracksContainerRef"
            :is-active="selectionBox?.isActive || false"
          />

          <div
            ref="tracksScrollRef"
            class="absolute inset-0 overflow-x-auto overflow-y-auto hide-native-scrollbar"
            @mousedown="onScrollAreaMouseDown"
            @click="onScrollAreaClick"
            @wheel="onScrollAreaWheel"
            @scroll="onTracksScroll"
            @contextmenu.prevent="handleEmptyContextMenu"
          >
            <div class="relative" :style="{ width: `${dynamicTimelineWidth}px` }">
              <!-- Sticky header: ruler + bookmarks -->
              <div ref="timelineHeaderRef" class="sticky top-0 z-30 flex flex-col bg-[#18181b]">
                <TimelineRuler
                  :zoom-level="zoomLevel"
                  :dynamic-timeline-width="dynamicTimelineWidth"
                  :visible-range="visibleRange"
                  @wheel="onScrollAreaWheel"
                  @ruler-click="handleRulerClick"
                  @ruler-tracking-mouse-down="handleRulerMouseDown"
                  @ruler-mouse-down="onRulerSurfaceMouseDown"
                />
              </div>

              <!-- Playhead -->
              <TimelinePlayhead
                v-model:playhead-ref="playheadRef"
                :zoom-level="zoomLevel"
                :playhead-position="playheadPosition"
                :playhead-time="playheadPosition"
                :duration="playheadDuration"
                :is-playing="isTimelinePlaying"
                :total-height="playheadTotalHeight"
                :is-snapping-to-playhead="showSnapIndicator && currentSnapPoint?.type === 'playhead'"
                :is-scrubbing="isPlayheadScrubbing"
                @playhead-mouse-down="handlePlayheadRulerMouseDown"
              />

              <!-- Tracks area — DragLine lives here so Y matches track rows (same padding/scroll) -->
              <div
                class="relative"
                :style="{
                  height: `${tracksAreaHeight + tracksVerticalOffset + 24}px`,
                  paddingTop: `${tracksVerticalOffset}px`,
                }"
              >
                <DragLine
                  :drop-target="dropTarget"
                  :tracks="tracks"
                  :is-visible="isDragOver"
                  :header-height="tracksVerticalOffset"
                  :drag-element-type="dragElementType"
                  :zoom-level="zoomLevel"
                  :insert-gap-index="activeNewTrackDrop?.index ?? null"
                  :insert-gap-size="INSERT_GAP_SIZE"
                />
                <DragLine
                  :drop-target="dragDropTarget"
                  :tracks="tracks"
                  :is-visible="dragState.isDragging"
                  :header-height="tracksVerticalOffset"
                  :drag-element-type="dragElementTypeForReorder"
                  :zoom-level="zoomLevel"
                  :insert-gap-index="activeNewTrackDrop?.index ?? null"
                  :insert-gap-size="INSERT_GAP_SIZE"
                />
                <div v-if="tracks.length === 0" />
                <!-- New-track insert indicator line -->
                <div
                  v-if="activeNewTrackDrop"
                  class="pointer-events-none absolute left-2 right-2 z-50 h-0.5 rounded-full opacity-50"
                  :style="{
                    top: `${insertLineTop}px`,
                    transform: 'translateY(-50%)',
                    backgroundColor: insertIndicatorColor,
                  }"
                />
                <div
                  v-for="(track, index) in tracks"
                  :key="track.id"
                  class="timeline-track-row absolute right-0 left-0"
                  :class="{ 'overflow-hidden': !dragState.isDragging && !isDragOver }"
                  :style="{
                    top: `${getTrackTopWithInsertGap(index)}px`,
                    height: `${getTrackHeight({ type: track.type })}px`,
                  }"
                >
                  <TimelineTrackContent
                    :track="track"
                    :zoom-level="zoomLevel"
                    :snapping-enabled="autoSnapping"
                    :is-playhead-scrubbing="isPlayheadScrubbing"
                    :razor-mode="razorMode"
                    :effect-drop-target-id="effectDropTargetTrackId === track.id ? effectDropTargetId : null"
                    :transition-drop-element-ids="
                      transitionDropVisual?.trackId === track.id
                        ? [transitionDropVisual.leftElementId, transitionDropVisual.rightElementId]
                        : []
                    "
                    :drag-ripple-shifts="dragRippleShifts"
                    :visible-range="visibleRange"
                    :active-element-id="dragState.trackId === track.id ? dragState.elementId : null"
                    :is-timeline-interactive="isTimelineInteractive"
                    @snap-point-change="handleSnapPointChange"
                    @resize-state-change="handleResizeStateChange"
                    @element-mouse-down="handleElementMouseDown"
                    @element-click="handleElementClick"
                    @element-context-menu="handleContextMenu"
                    @razor-cut="handleRazorCut"
                    @track-mouse-down="
                      (event) => {
                        handleSelectionMouseDown(event);
                        handleTracksMouseDown(event);
                      }
                    "
                    @track-click="handleTracksClick"
                    @keyframe-click="handleKeyframeClick"
                  />
                  <!-- Existing transition badges -->
                  <template v-for="badge in transitionBadgesByTrack.get(track.id) ?? []" :key="badge.transitionId">
                    <button
                      type="button"
                      class="absolute z-40 flex items-center justify-center rounded-md border transition-all"
                      :class="
                        selectedTransitionId === badge.transitionId
                          ? 'border-[#E040FB] bg-[#E040FB]/25 ring-2 ring-[#E040FB]/50'
                          : 'border-[#E040FB]/40 bg-[#E040FB]/10 hover:border-[#E040FB] hover:bg-[#E040FB]/20'
                      "
                      :style="{
                        left: `${badge.startPx}px`,
                        width: `${badge.widthPx}px`,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        height: '24px',
                      }"
                      :aria-label="`Select ${badge.label} transition`"
                      :aria-pressed="selectedTransitionId === badge.transitionId"
                      :title="`Transition: ${badge.label} — click to select, Delete to remove`"
                      @pointerdown.stop
                      @mousedown.stop
                      @click.stop="selectTransition({ transitionId: badge.transitionId })"
                    >
                      <span class="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-[#E040FB]/80" />
                      <span class="pointer-events-none flex items-center gap-0.5 rounded-full bg-[#1a0a1e]/90 px-1.5 py-0.5 text-[9px] font-medium text-[#E040FB] shadow-md">
                        <ArrowRightLeft class="size-2.5" />
                        <span class="max-w-[52px] truncate capitalize">{{ badge.label }}</span>
                      </span>
                    </button>
                  </template>

                  <!-- Transition drop preview: centered across outgoing + incoming clips -->
                  <div
                    v-if="transitionDropVisual && transitionDropVisual.trackId === track.id"
                    class="pointer-events-none absolute z-50 flex items-center justify-center overflow-hidden rounded-md border-2 border-[#E040FB] bg-[#E040FB]/20 shadow-[0_0_10px_rgba(224,64,251,0.45)]"
                    :style="{
                      left: `${transitionDropVisual.left}px`,
                      width: `${transitionDropVisual.width}px`,
                      top: '50%',
                      height: '30px',
                      transform: 'translateY(-50%)',
                    }"
                  >
                    <div class="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-[#E040FB]/5 to-[#E040FB]/30" />
                    <div class="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-[#E040FB]/5 to-[#E040FB]/30" />
                    <div class="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-[#E040FB]" />
                    <div class="relative flex max-w-full items-center gap-1 rounded-full bg-[#1a0a1e]/90 px-2 py-1 text-[9px] font-semibold text-white">
                      <ArrowRightLeft class="size-3 shrink-0 text-[#E040FB]" />
                      <span class="truncate">{{ transitionDropVisual.label }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <TimelineContextMenu :position="contextMenuPos" :element-ref="contextMenuElement" @close="closeContextMenu" />

    <TimelineScrollbar
      :scroll-container="tracksScrollRef"
      :track-labels-width="trackLabelsWidth"
    />

    <KeyframePopup
      v-if="keyframePopup"
      :element-id="keyframePopup.elementId"
      :offset="keyframePopup.offset"
      :anchor-rect="keyframePopup.rect"
      @close="closeKeyframePopup"
    />
  </section>
</template>

<style>
  .hide-native-scrollbar {
    scrollbar-width: none !important;
  }
  .hide-native-scrollbar::-webkit-scrollbar {
    display: none !important;
  }

  /* GPU-composited drag visual.
   *
   * The drag controller in `useElementInteraction.ts` writes `--drag-x`
   * and `--drag-y` directly on the matching `[data-element-id]` nodes
   * each animation frame, then sets `data-drag-active="1"`. The browser
   * promotes the element to its own compositor layer and translates it
   * via the GPU, so dragging hundreds of clips at once is buttery smooth.
   *
   * We do NOT include `left` here — the element keeps its committed
   * `left:` value during the drag. Only the transform overlays the visual
   * delta, and on drop the controller clears the data attribute and the
   * committed `startTime` is updated by the timeline manager. */
  .timeline-element[data-drag-active="1"] {
    transform: translate3d(var(--drag-x, 0), var(--drag-y, 0), 0);
    z-index: 30;
    will-change: transform;
    pointer-events: none;
  }

  /* Smooth animated insert gap when a drag hovers over a between-track
   * insertion point. The track row itself still receives an instant top
   * change from Vue, but the visual transition gives it a CapCut-style
   * springy feel rather than a hard jump. */
  .timeline-track-row {
    transition: top 120ms cubic-bezier(0.22, 1, 0.36, 1);
  }
</style>
