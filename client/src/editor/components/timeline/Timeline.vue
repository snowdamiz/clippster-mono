<script setup lang="ts">
import { ref, computed } from "vue";
import { useEditor } from "../../composables/useEditor";
import { useTimelineZoom } from "../../composables/timeline/useTimelineZoom";
import { useElementInteraction } from "../../composables/timeline/element/useElementInteraction";
import { useElementSelection } from "../../composables/timeline/element/useElementSelection";
import { useTimelinePlayhead } from "../../composables/timeline/useTimelinePlayhead";
import { useTimelineSeek } from "../../composables/timeline/useTimelineSeek";
import { useTimelineDragDrop } from "../../composables/timeline/useTimelineDragDrop";
import { useSelectionBox } from "../../composables/timeline/useSelectionBox";
import { useScrollSync } from "../../composables/timeline/useScrollSync";
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
} from "lucide-vue-next";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const tracksContainerHeight = { min: 0, max: 800 };

const { editor, version } = useEditor();
const { clearElementSelection, setElementSelection, selectedElements } = useElementSelection();

// Context menu state
const contextMenuPos = ref<{ x: number; y: number } | null>(null);
const contextMenuElement = ref<{ trackId: string; elementId: string } | null>(null);

function handleContextMenu(params: { event: MouseEvent; element: { id: string }; track: { id: string } }) {
	params.event.preventDefault();
	contextMenuPos.value = { x: params.event.clientX, y: params.event.clientY };
	contextMenuElement.value = { trackId: params.track.id, elementId: params.element.id };
}

function closeContextMenu() {
	contextMenuPos.value = null;
	contextMenuElement.value = null;
}

// Track management
function addTrack(type: TrackType) {
	editor.timeline.addTrack({ type });
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
const snappingEnabled = ref(true);
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
	minZoom: minZoomLevel.value,
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
	snappingEnabled,
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
	handleDragEnter,
	handleDragOver,
	handleDragLeave,
	handleDrop,
} = useTimelineDragDrop({
	containerRef: tracksContainerRef,
	headerRef: timelineHeaderRef,
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
		snappingEnabled.value &&
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
			@set-zoom-level="setZoomLevel($event)"
			@toggle-razor-mode="toggleRazorMode"
			@toggle-auto-follow="toggleAutoFollow"
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
				<div class="flex w-28 shrink-0 flex-col border-r border-white/10 bg-[#18181b]">
					<div class="flex h-4 items-center justify-between bg-[#18181b] px-1">
						<span class="opacity-0">.</span>
					</div>
					<div class="flex h-4 items-center justify-center gap-1 bg-[#18181b] px-1">
						<button
							class="flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] text-zinc-500 hover:bg-white/10 hover:text-zinc-300"
							@click="addTrack('video')"
							title="Add video track"
						>
							<Plus class="size-2.5" />V
						</button>
						<button
							class="flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] text-zinc-500 hover:bg-white/10 hover:text-zinc-300"
							@click="addTrack('audio')"
							title="Add audio track"
						>
							<Plus class="size-2.5" />A
						</button>
						<button
							class="flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] text-zinc-500 hover:bg-white/10 hover:text-zinc-300"
							@click="addTrack('text')"
							title="Add text track"
						>
							<Plus class="size-2.5" />T
						</button>
					</div>
					<div
						v-if="tracks.length > 0"
						ref="trackLabelsRef"
						class="flex-1 overflow-y-auto bg-[#18181b]"
						:style="{ paddingTop: `${TIMELINE_CONSTANTS.PADDING_TOP_PX}px` }"
					>
						<div ref="trackLabelsScrollRef" class="size-full overflow-auto">
							<div class="flex flex-col gap-1">
								<div
									v-for="track in tracks"
									:key="track.id"
									class="group flex items-center px-1"
									:style="{ height: `${getTrackHeight({ type: track.type })}px` }"
								>
									<div class="flex min-w-0 flex-1 items-center justify-between gap-0.5">
										<span class="text-zinc-500 text-[10px] capitalize truncate">{{ track.name }}</span>
										<div class="flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-opacity" :class="{ '!opacity-100': track.locked }">
											<button
												class="p-0.5 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-300"
												:class="{ '!text-yellow-500': track.locked }"
												@click="toggleTrackLock(track.id)"
												:title="track.locked ? 'Unlock track' : 'Lock track'"
											>
												<Lock v-if="track.locked" class="size-3" />
												<Unlock v-else class="size-3" />
											</button>
											<button
												v-if="canTracktHaveAudio(track)"
												class="p-0.5 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-300"
												:class="{ '!text-red-400': track.muted }"
												@click="toggleTrackMute(track.id)"
												:title="track.muted ? 'Unmute' : 'Mute'"
											>
												<VolumeX v-if="track.muted" class="size-3" />
												<Volume2 v-else class="size-3" />
											</button>
											<button
												v-if="canTrackBeHidden(track)"
												class="p-0.5 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-300"
												:class="{ '!text-red-400': ('hidden' in track && track.hidden) }"
												@click="toggleTrackVisibility(track.id)"
												:title="('hidden' in track && track.hidden) ? 'Show' : 'Hide'"
											>
												<EyeOff v-if="'hidden' in track && track.hidden" class="size-3" />
												<Eye v-else class="size-3" />
											</button>
											<button
												v-if="!('isMain' in track && track.isMain)"
												class="p-0.5 rounded hover:bg-white/10 text-zinc-500 hover:text-red-400"
												@click="removeTrack(track.id)"
												title="Remove track"
											>
												<Trash2 class="size-3" />
											</button>
										</div>
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
								:style="{ height: `${tracksAreaHeight}px` }"
							>
								<div v-if="tracks.length === 0" />
								<div
									v-for="(track, index) in tracks"
									:key="track.id"
									class="absolute right-0 left-0"
									:style="{
										top: `${getCumulativeHeightBefore({ tracks, trackIndex: index })}px`,
										height: `${getTrackHeight({ type: track.type })}px`,
									}"
								>
									<TimelineTrackContent
										:track="track"
										:zoom-level="zoomLevel"
										:drag-state="dragState"
										:snapping-enabled="snappingEnabled"
										:razor-mode="razorMode"
										@snap-point-change="handleSnapPointChange"
										@resize-state-change="handleResizeStateChange"
										@element-mouse-down="handleElementMouseDown"
										@element-click="handleElementClick"
										@element-context-menu="handleContextMenu"
										@razor-cut="handleRazorCut"
										@track-mouse-down="(event) => { handleSelectionMouseDown(event); handleTracksMouseDown(event); }"
										@track-click="handleTracksClick"
									/>
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
