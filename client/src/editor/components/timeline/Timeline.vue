<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useEditor } from "../../composables/useEditor";
import { useTimelineZoom } from "../../composables/timeline/useTimelineZoom";
import { useElementInteraction } from "../../composables/timeline/element/useElementInteraction";
import { useElementSelection } from "../../composables/timeline/element/useElementSelection";
import { useTimelinePlayhead } from "../../composables/timeline/useTimelinePlayhead";
import { useTimelineSeek } from "../../composables/timeline/useTimelineSeek";
import { useTimelineDragDrop } from "../../composables/timeline/useTimelineDragDrop";
import { useSelectionBox } from "../../composables/timeline/useSelectionBox";
import { useScrollSync } from "../../composables/timeline/useScrollSync";
import { useTimelineTools } from "../../composables/timeline/useTimelineTools";
import { UpdateCoverTimestampCommand } from "../../lib/commands/project/update-cover-timestamp";
import { TIMELINE_CONSTANTS } from "../../constants/timeline-constants";
import {
	getTrackHeight,
	getCumulativeHeightBefore,
	getTotalTracksHeight,
	getTimelineZoomMin,
	getTimelinePaddingPx,
	canTracktHaveAudio,
	canTrackBeHidden,
} from "../../lib/timeline";
import type { TrackType } from "../../types/timeline";
import type { SnapPoint } from "../../composables/timeline/useTimelineSnapping";

import TimelineToolbar from "./TimelineToolbar.vue";
import TimelineRuler from "./TimelineRuler.vue";
import TimelinePlayhead from "./TimelinePlayhead.vue";
import TimelineTrackContent from "./TimelineTrackContent.vue";
import SnapIndicator from "./SnapIndicator.vue";
import DragLine from "./DragLine.vue";
import SelectionBox from "../SelectionBox.vue";
import TimelineScrollbar from "./TimelineScrollbar.vue";
import TimelineContextMenu from "./TimelineContextMenu.vue";
import KeyframePopup from "./KeyframePopup.vue";
import { ScrollArea } from "@/components/ui/scroll-area";
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
} from "lucide-vue-next";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const tracksContainerHeight = { min: 0, max: 800 };

const { editor, version } = useEditor();
const { clearElementSelection, setElementSelection, selectedElements, selectAllInTrack } = useElementSelection();

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
}

const tracks = computed(() => {
	void version.value;
	return editor.timeline.getTracks();
});

const timelineDuration = computed(() => {
	void version.value;
	return editor.timeline.getTotalDuration() || 0;
});

// Refs
const timelineRef = ref<HTMLDivElement | null>(null);
const timelineHeaderRef = ref<HTMLDivElement | null>(null);
const rulerRef = ref<HTMLDivElement | null>(null);
const tracksContainerRef = ref<HTMLDivElement | null>(null);
const tracksScrollRef = ref<HTMLDivElement | null>(null);
const trackLabelsRef = ref<HTMLDivElement | null>(null);
const playheadRef = ref<HTMLDivElement | null>(null);
const trackLabelsScrollRef = ref<HTMLDivElement | null>(null);

// State
const isResizing = ref(false);
const currentSnapPoint = ref<SnapPoint | null>(null);
const { mainTrackMagnet, autoSnapping, linkage, toggleMainTrackMagnet, toggleAutoSnapping, toggleLinkage } = useTimelineTools();
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
	}),
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

const {
	dragState,
	dragDropTarget,
	handleElementMouseDown,
	handleElementClick,
	getLastMouseX,
} = useElementInteraction({
	zoomLevel,
	timelineRef,
	tracksContainerRef,
	tracksScrollRef,
	headerRef: timelineHeaderRef,
	snappingEnabled: autoSnapping,
	onSnapPointChange: handleSnapPointChange,
});

const { playheadPosition, handlePlayheadMouseDown: handlePlayheadRulerMouseDown } = useTimelinePlayhead({
	zoomLevel,
	rulerRef,
	rulerScrollRef: tracksScrollRef,
	tracksScrollRef,
	playheadRef,
	autoFollow,
});

const playheadTotalHeight = computed(() => {
	const tracksH = tracksScrollRef.value?.clientHeight;
	const timelineH = timelineRef.value?.clientHeight;
	return Math.max(0, (tracksH ?? timelineH ?? 400) - 4);
});

const scrollLeft = computed(() => tracksScrollRef.value?.scrollLeft ?? 0);
const trackLabelsWidth = computed(() =>
	tracks.value.length > 0 && trackLabelsRef.value ? trackLabelsRef.value.offsetWidth : 0,
);
const timelineHeight = computed(() => timelineRef.value?.offsetHeight ?? 400);

const {
	isDragOver,
	dropTarget,
	dragElementType,
	handleDragEnter,
	handleDragOver,
	handleDragLeave,
	handleDrop,
} = useTimelineDragDrop({
	containerRef: tracksContainerRef,
	headerRef: timelineHeaderRef,
	scrollRef: tracksScrollRef,
	zoomLevel,
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
 * Each entry: { trackId, xPx, label, transitionId, targetElementId }
 */
const existingTransitionBadges = computed(() => {
	void version.value;
	let scene;
	try { scene = editor.scenes.getActiveSceneOrNull(); } catch { return []; }
	if (!scene?.transitions?.length) return [];

	const result: { trackId: string; xPx: number; label: string; targetElementId: string }[] = [];
	const pps = TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel.value;

	for (const transition of scene.transitions) {
		const track = tracks.value.find((t) => t.id === transition.trackId);
		if (!track) continue;
		const targetEl = track.elements.find((e) => e.id === transition.targetElementId);
		if (!targetEl) continue;
		// Badge sits at the junction (start of the right element)
		result.push({
			trackId: transition.trackId,
			xPx: targetEl.startTime * pps,
			label: transition.type,
			targetElementId: transition.targetElementId,
		});
	}
	return result;
});

/** Pixel position of a transition junction drop indicator */
const transitionJunctionPx = computed(() => {
	if (!isDragOver.value || !dropTarget.value?.targetElementId || !dropTarget.value?.targetTrackId) return null;
	// Only show for transition drags (when dragElementType is null — transitions set it to null)
	if (dragElementType.value !== null) return null;
	return {
		x: dropTarget.value.xPosition * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel.value,
		trackId: dropTarget.value.targetTrackId,
	};
});

const contentWidth = computed(
	() => timelineDuration.value * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel.value,
);

const paddingPx = computed(() =>
	getTimelinePaddingPx({
		containerWidth: containerWidth.value,
		zoomLevel: zoomLevel.value,
		minZoom: minZoomLevel.value,
	}),
);

const dynamicTimelineWidth = computed(() =>
	Math.max(contentWidth.value + paddingPx.value, containerWidth.value),
);

const showSnapIndicator = computed(
	() =>
		autoSnapping.value && // Use the shared autoSnapping
		currentSnapPoint.value !== null &&
		(dragState.value.isDragging || isResizing.value),
);

const duration = computed(() => {
	void version.value;
	return editor.timeline.getTotalDuration();
});

const {
	handleTracksMouseDown,
	handleTracksClick,
	handleRulerMouseDown,
	handleRulerClick,
} = useTimelineSeek({
	playheadRef,
	trackLabelsRef,
	rulerScrollRef: tracksScrollRef,
	tracksScrollRef,
	zoomLevel,
	duration,
	isSelecting,
	clearSelectedElements: clearElementSelection,
	seek: (time: number) => editor.playback.seek({ time }),
});

useScrollSync({
	tracksScrollRef,
	trackLabelsScrollRef,
});

const timelineHeaderHeight = computed(
	() => timelineHeaderRef.value?.getBoundingClientRect().height ?? 0,
);

const totalTracksHeight = computed(() => getTotalTracksHeight({ tracks: tracks.value }));

const tracksAreaHeight = computed(() =>
	Math.max(tracksContainerHeight.min, Math.min(tracksContainerHeight.max, totalTracksHeight.value)),
);

// Vertical centering: offset tracks when content is shorter than container
const tracksContainerClientHeight = ref(0);
let tracksResizeObserver: ResizeObserver | null = null;

onMounted(() => {
	tracksResizeObserver = new ResizeObserver((entries) => {
		for (const entry of entries) {
			tracksContainerClientHeight.value = entry.contentRect.height;
		}
	});
	if (tracksScrollRef.value) {
		tracksResizeObserver.observe(tracksScrollRef.value);
	}
});

onUnmounted(() => {
	tracksResizeObserver?.disconnect();
});

const tracksVerticalOffset = computed(() => {
	const containerH = tracksContainerClientHeight.value;
	const contentH = totalTracksHeight.value;
	if (containerH <= 0 || contentH >= containerH) return 0;
	return Math.min(16, Math.floor((containerH - contentH) / 2));
});

function onScrollAreaWheel(event: WheelEvent) {
	const isZoomGesture = event.ctrlKey || event.metaKey;

	if (isZoomGesture) {
		handleWheel(event);
		return;
	}

	// Horizontal scroll: Shift+wheel, trackpad horizontal swipe, or normal vertical wheel
	const scrollEl = tracksScrollRef.value;
	if (!scrollEl) return;

	event.preventDefault();

	if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
		// Shift+scroll or trackpad horizontal swipe
		scrollEl.scrollLeft += event.shiftKey ? event.deltaY : event.deltaX;
	} else {
		// Normal vertical scroll → scroll timeline horizontally
		scrollEl.scrollLeft += event.deltaY;
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
	const scrollEl = tracksScrollRef.value;
	if (!scrollEl) return;
	const totalDur = editor.timeline.getTotalDuration();
	if (totalDur <= 0) return;
	const viewportWidth = scrollEl.clientWidth;
	const fitZoom = viewportWidth / (totalDur * TIMELINE_CONSTANTS.PIXELS_PER_SECOND);
	setZoomLevel(Math.max(minZoomLevel.value, Math.min(fitZoom, TIMELINE_CONSTANTS.ZOOM_MAX)));
	scrollEl.scrollLeft = 0;
}

// Track reorder drag-and-drop
const trackDragId = ref<string | null>(null);
const trackDragOverId = ref<string | null>(null);

function onTrackDragStart(e: DragEvent, trackId: string) {
	// Prevent dragging Track 0 (main video track)
	const track = tracks.value.find((t) => t.id === trackId);
	if (track && 'isMain' in track && track.isMain) {
		e.preventDefault();
		return;
	}

	trackDragId.value = trackId;
	if (e.dataTransfer) {
		e.dataTransfer.effectAllowed = "move";
		e.dataTransfer.setData("text/plain", trackId);
	}
}

function onTrackDragOver(e: DragEvent, trackId: string) {
	e.preventDefault();
	if (trackDragId.value && trackDragId.value !== trackId) {
		trackDragOverId.value = trackId;
	}
}

function onTrackDrop(e: DragEvent, targetTrackId: string) {
	e.preventDefault();
	if (!trackDragId.value || trackDragId.value === targetTrackId) return;

	// Prevent dropping onto Track 0 (main video track)
	const targetTrack = tracks.value.find((t) => t.id === targetTrackId);
	if (targetTrack && 'isMain' in targetTrack && targetTrack.isMain) {
		trackDragId.value = null;
		trackDragOverId.value = null;
		return;
	}

	const oldIndex = tracks.value.findIndex((t) => t.id === trackDragId.value);
	const targetIndex = tracks.value.findIndex((t) => t.id === targetTrackId);

	if (oldIndex === -1 || targetIndex === -1) return;

	// Calculate correct new index accounting for drag direction
	let newIndex = targetIndex;
	if (oldIndex < targetIndex) {
		// Dragging down: insert after target
		newIndex = targetIndex;
	} else {
		// Dragging up: insert before target
		newIndex = targetIndex;
	}

	editor.timeline.reorderTrack({ trackId: trackDragId.value, newIndex });
	trackDragId.value = null;
	trackDragOverId.value = null;
}

function onTrackDragEnd() {
	trackDragId.value = null;
	trackDragOverId.value = null;
}
</script>

<template>
	<section
		class="relative flex h-full flex-col overflow-hidden rounded-sm bg-[#18181b]"
		aria-label="Timeline"
		@dragenter="handleDragEnter"
		@dragover="handleDragOver"
		@dragleave="handleDragLeave"
		@drop="handleDrop"
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

		<div
			ref="timelineRef"
			class="relative flex min-h-0 flex-1 flex-col overflow-hidden"
		>
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
				<div class="flex w-44 shrink-0 flex-col border-r border-white/10 bg-[#18181b]">
					<!-- Header — must be same height as TimelineRuler so track rows align -->
					<div class="flex h-4 shrink-0 items-center justify-between bg-[#18181b] pl-3 pr-1">
						<span class="text-[10px] font-semibold uppercase tracking-widest text-white/25">Tracks</span>
						<div class="flex items-center gap-0.5">
							<button
								class="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 transition-colors hover:bg-white/10 hover:text-zinc-300"
								@click="addTrack('video')"
								title="Add video track"
							><Plus class="size-2.5" />V</button>
							<button
								class="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 transition-colors hover:bg-white/10 hover:text-zinc-300"
								@click="addTrack('audio')"
								title="Add audio track"
							><Plus class="size-2.5" />A</button>
							<button
								class="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 transition-colors hover:bg-white/10 hover:text-zinc-300"
								@click="addTrack('text')"
								title="Add text track"
							><Plus class="size-2.5" />T</button>
						</div>
					</div>

					<!-- Track labels list -->
					<div
						v-if="tracks.length > 0"
						ref="trackLabelsRef"
						class="flex-1 overflow-hidden bg-[#18181b]"
						:style="{ paddingTop: `${TIMELINE_CONSTANTS.PADDING_TOP_PX}px` }"
					>
						<div ref="trackLabelsScrollRef" class="size-full overflow-auto">
							<div class="flex flex-col gap-1" :style="{ paddingTop: `${tracksVerticalOffset}px` }">
								<div
									v-for="track in tracks"
									:key="track.id"
									:draggable="!('isMain' in track && track.isMain)"
									class="group relative flex flex-col items-start justify-center gap-2 transition-colors"
									:class="{
										'bg-primary/10': trackDragOverId === track.id,
										'cursor-move': !('isMain' in track && track.isMain),
										'cursor-not-allowed opacity-60': 'isMain' in track && track.isMain && trackDragId,
									}"
									:style="{ height: `${getTrackHeight({ type: track.type })}px` }"
									@dragstart="onTrackDragStart($event, track.id)"
									@dragover="onTrackDragOver($event, track.id)"
									@drop="onTrackDrop($event, track.id)"
									@dragend="onTrackDragEnd"
								>
									<!-- Drop indicator -->
									<div v-if="trackDragOverId === track.id" class="absolute left-0 right-0 top-0 z-10 h-0.5 bg-primary" />

									<!-- Left accent bar -->
									<div
										class="absolute left-0 inset-y-1.5 w-[3px] rounded-r-sm"
										:style="{ background: getTrackAccentColor(track.type) }"
									/>

									<!-- Row 1: icon + name -->
									<div class="flex min-w-0 items-center gap-1.5 pl-4 pr-2">
										<Film v-if="track.type === 'video'" class="size-3.5 shrink-0 opacity-50" :style="{ color: getTrackAccentColor(track.type) }" />
										<Music v-else-if="track.type === 'audio'" class="size-3.5 shrink-0 opacity-50" :style="{ color: getTrackAccentColor(track.type) }" />
										<Type v-else-if="track.type === 'text'" class="size-3.5 shrink-0 opacity-50" :style="{ color: getTrackAccentColor(track.type) }" />
										<Smile v-else-if="track.type === 'sticker'" class="size-3.5 shrink-0 opacity-50" :style="{ color: getTrackAccentColor(track.type) }" />
										<Sparkles v-else-if="track.type === 'effect'" class="size-3.5 shrink-0 opacity-50" :style="{ color: getTrackAccentColor(track.type) }" />
										<MessageSquare v-else class="size-3.5 shrink-0 opacity-50" :style="{ color: getTrackAccentColor(track.type) }" />
										<span
											class="min-w-0 flex-1 truncate text-[11px] font-medium leading-none text-white/60 transition-colors group-hover:text-white/85 cursor-pointer"
											title="Select all elements in track"
											@click="selectAllInTrack({ trackId: track.id })"
										>{{ track.name }}</span>
									</div>

									<!-- Row 2: control buttons -->
									<div class="flex items-center gap-0.5 pl-3 pr-1.5">
										<!-- Cover (main video track only) -->
										<button
											v-if="'isMain' in track && track.isMain"
											class="rounded p-1 text-zinc-600 transition-colors hover:bg-white/10 hover:text-[#0ea5e9]"
											@click="openCoverEditor"
											title="Edit cover image"
										>
											<ImageIcon class="size-3.5" />
										</button>
										<!-- Lock -->
										<button
											class="rounded p-1 transition-colors hover:bg-white/10"
											:class="track.locked ? 'text-yellow-400' : 'text-zinc-600 hover:text-zinc-300'"
											@click="toggleTrackLock(track.id)"
											:title="track.locked ? 'Unlock track' : 'Lock track'"
										>
											<Lock v-if="track.locked" class="size-3.5" />
											<Unlock v-else class="size-3.5" />
										</button>
										<!-- Mute -->
										<button
											v-if="canTracktHaveAudio(track)"
											class="rounded p-1 transition-colors hover:bg-white/10"
											:class="track.muted ? 'text-red-400' : 'text-zinc-600 hover:text-zinc-300'"
											@click="toggleTrackMute(track.id)"
											:title="track.muted ? 'Unmute' : 'Mute'"
										>
											<VolumeX v-if="track.muted" class="size-3.5" />
											<Volume2 v-else class="size-3.5" />
										</button>
										<!-- Visibility -->
										<button
											v-if="canTrackBeHidden(track)"
											class="rounded p-1 transition-colors hover:bg-white/10"
											:class="('hidden' in track && track.hidden) ? 'text-red-400' : 'text-zinc-600 hover:text-zinc-300'"
											@click="toggleTrackVisibility(track.id)"
											:title="('hidden' in track && track.hidden) ? 'Show' : 'Hide'"
										>
											<EyeOff v-if="'hidden' in track && track.hidden" class="size-3.5" />
											<Eye v-else class="size-3.5" />
										</button>
										<!-- Delete (non-main, reveals on hover) -->
										<button
											v-if="!('isMain' in track && track.isMain)"
											class="rounded p-1 text-zinc-700 transition-all hover:bg-white/10 hover:text-red-400 opacity-0 group-hover:opacity-100"
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
				<div
					ref="tracksContainerRef"
					class="relative flex flex-1 flex-col overflow-hidden"
				>
					<SelectionBox
						:start-pos="selectionBox?.startPos || null"
						:current-pos="selectionBox?.currentPos || null"
						:container-el="tracksContainerRef"
						:is-active="selectionBox?.isActive || false"
					/>

					<DragLine
						:drop-target="dropTarget"
						:tracks="tracks"
						:is-visible="isDragOver"
						:header-height="timelineHeaderHeight"
					/>
					<DragLine
						:drop-target="dragDropTarget"
						:tracks="tracks"
						:is-visible="dragState.isDragging"
						:header-height="timelineHeaderHeight"
					/>

					<div
						ref="tracksScrollRef"
						class="size-full overflow-x-auto overflow-y-hidden hide-native-scrollbar"
						@mousedown="onScrollAreaMouseDown"
						@click="onScrollAreaClick"
						@wheel="onScrollAreaWheel"
						@scroll="saveScrollPosition"
						@contextmenu.prevent="handleEmptyContextMenu"
					>
						<div
							class="relative"
							:style="{ width: `${dynamicTimelineWidth}px` }"
						>
							<!-- Sticky header: ruler + bookmarks -->
							<div
								ref="timelineHeaderRef"
								class="sticky top-0 z-30 flex flex-col bg-[#18181b]"
							>
								<TimelineRuler
									:zoom-level="zoomLevel"
									:dynamic-timeline-width="dynamicTimelineWidth"
									@wheel="onScrollAreaWheel"
									@ruler-click="handleRulerClick"
									@ruler-tracking-mouse-down="handleRulerMouseDown"
									@ruler-mouse-down="handlePlayheadRulerMouseDown"
								/>
							</div>

							<!-- Playhead -->
							<TimelinePlayhead
								:zoom-level="zoomLevel"
								:playhead-position="playheadPosition"
								:total-height="playheadTotalHeight"
								:is-snapping-to-playhead="showSnapIndicator && currentSnapPoint?.type === 'playhead'"
								@playhead-mouse-down="handlePlayheadRulerMouseDown"
							/>

							<!-- Tracks area -->
							<div
								class="relative"
								:style="{ height: `${tracksAreaHeight + tracksVerticalOffset}px`, paddingTop: `${tracksVerticalOffset}px` }"
							>
								<div v-if="tracks.length === 0" />
								<div
									v-for="(track, index) in tracks"
									:key="track.id"
									class="absolute right-0 left-0"
									:style="{
										top: `${getCumulativeHeightBefore({ tracks, trackIndex: index }) + tracksVerticalOffset}px`,
										height: `${getTrackHeight({ type: track.type })}px`,
									}"
								>
									<TimelineTrackContent
										:track="track"
										:zoom-level="zoomLevel"
										:drag-state="dragState"
										:snapping-enabled="autoSnapping"
										:razor-mode="razorMode"
										:effect-drop-target-id="effectDropTargetTrackId === track.id ? effectDropTargetId : null"
										@snap-point-change="handleSnapPointChange"
										@resize-state-change="handleResizeStateChange"
										@element-mouse-down="handleElementMouseDown"
										@element-click="handleElementClick"
										@element-context-menu="handleContextMenu"
										@razor-cut="handleRazorCut"
										@track-mouse-down="(event) => { handleSelectionMouseDown(event); handleTracksMouseDown(event); }"
										@track-click="handleTracksClick"
										@keyframe-click="handleKeyframeClick"
									/>
									<!-- Existing transition badges -->
									<template v-for="badge in existingTransitionBadges" :key="badge.targetElementId">
										<div
											v-if="badge.trackId === track.id"
											class="pointer-events-none absolute top-0 z-40"
											:style="{
												left: `${badge.xPx - 1}px`,
												width: '2px',
												height: '100%',
											}"
										>
											<div class="h-full w-[2px] bg-[#E040FB]/70" />
										</div>
										<button
											v-if="badge.trackId === track.id"
											class="absolute z-50 flex items-center gap-0.5 rounded-full border border-[#E040FB]/50 bg-[#1a0a1e] px-1.5 py-0.5 text-[9px] font-medium text-[#E040FB] shadow-md hover:bg-[#E040FB]/20 transition-colors"
											:style="{
												left: `${badge.xPx}px`,
												top: '50%',
												transform: 'translate(-50%, -50%)',
												pointerEvents: 'auto',
											}"
											:title="`Transition: ${badge.label} — click to edit`"
											@click.stop="handleElementClick({ event: $event, element: { id: badge.targetElementId } as any, track })"
										>
											<ArrowRightLeft class="size-2.5" />
											<span class="max-w-[40px] truncate capitalize">{{ badge.label }}</span>
										</button>
									</template>

									<!-- Transition junction drop indicator -->
									<div
										v-if="transitionJunctionPx && transitionJunctionPx.trackId === track.id"
										class="pointer-events-none absolute top-0 z-50"
										:style="{
											left: `${transitionJunctionPx.x - 8}px`,
											width: '16px',
											height: '100%',
										}"
									>
										<div class="flex h-full items-center justify-center">
											<div class="h-full w-[2px] rounded-full bg-[#E040FB] shadow-[0_0_6px_#E040FB]" />
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<TimelineContextMenu
			:position="contextMenuPos"
			:element-ref="contextMenuElement"
			@close="closeContextMenu"
		/>

		<TimelineScrollbar
			v-if="tracksScrollRef"
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

<style scoped>
.hide-native-scrollbar {
	scrollbar-width: none !important;
}
.hide-native-scrollbar::-webkit-scrollbar {
	display: none !important;
}
</style>
