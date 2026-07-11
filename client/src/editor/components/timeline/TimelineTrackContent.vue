<script setup lang="ts">
import { computed, ref } from "vue";
import { EditorCore } from "../../core";
import { useElementSelection } from "../../composables/timeline/element/useElementSelection";
import TimelineElement from "./TimelineElement.vue";
import type {
	TimelineTrack,
	TimelineElement as TimelineElementType,
} from "../../types/timeline";
import type { SnapPoint } from "../../composables/timeline/useTimelineSnapping";
import { TIMELINE_CONSTANTS } from "../../constants/timeline-constants";
import { snapTimeToFrame } from "../../lib/time";

const props = defineProps<{
	track: TimelineTrack;
	zoomLevel: number;
	snappingEnabled: boolean;
	isPlayheadScrubbing?: boolean;
	razorMode?: boolean;
	effectDropTargetId?: string | null;
	/** Live neighbor shifts while dragging (magnetic rearrange preview). */
	dragRippleShifts?: Map<string, number>;
}>();

const emit = defineEmits<{
	(e: "snapPointChange", snapPoint: SnapPoint | null): void;
	(e: "resizeStateChange", params: { isResizing: boolean }): void;
	(e: "elementMouseDown", params: { event: MouseEvent; element: TimelineElementType; track: TimelineTrack }): void;
	(e: "elementClick", params: { event: MouseEvent; element: TimelineElementType; track: TimelineTrack }): void;
	(e: "elementContextMenu", params: { event: MouseEvent; element: TimelineElementType; track: TimelineTrack }): void;
	(e: "razorCut", params: { trackId: string; elementId: string; time: number }): void;
	(e: "trackMouseDown", event: MouseEvent): void;
	(e: "trackClick", event: MouseEvent): void;
	(e: "keyframeClick", payload: { elementId: string; offset: number; rect: DOMRect }): void;
}>();

defineExpose({});

const editor = EditorCore.getInstance();
const { isElementSelected } = useElementSelection();

const resizeRippleShifts = ref<Map<string, number>>(new Map());

function onRippleShiftsChange(shifts: Map<string, number>) {
	resizeRippleShifts.value = shifts;
}

const rippleShifts = computed(() => {
	const merged = new Map<string, number>();
	if (props.dragRippleShifts) {
		for (const [id, start] of props.dragRippleShifts) merged.set(id, start);
	}
	for (const [id, start] of resizeRippleShifts.value) merged.set(id, start);
	return merged;
});

const hasSelectedElements = computed(() =>
	props.track.elements.some((element) =>
		isElementSelected({ trackId: props.track.id, elementId: element.id }),
	),
);

function handleElementClick(ev: MouseEvent, el: TimelineElementType) {
	if (props.razorMode) {
		const target = ev.currentTarget as HTMLElement;
		const parent = target?.closest('.relative.h-full.min-w-full') as HTMLElement;
		if (!parent) return;
		const rect = parent.getBoundingClientRect();
		const relativeX = ev.clientX - rect.left;
		const rawTime = relativeX / (TIMELINE_CONSTANTS.PIXELS_PER_SECOND * props.zoomLevel);
		const fps = editor.project.getActive()?.settings?.fps ?? 30;
		const time = snapTimeToFrame({ time: rawTime, fps });
		emit("razorCut", { trackId: props.track.id, elementId: el.id, time });
		return;
	}
	emit("elementClick", { event: ev, element: el, track: props.track });
}

function onTrackClick(event: MouseEvent) {
	// Selection clearing is centralized in `handleTracksClick` (useTimelineSeek)
	// — it gates on `shouldProcessTimelineClick` so we don't clear at the end
	// of a drag or a rubber-band selection. Clearing here too would cause a
	// brief selection flicker before that gate runs.
	emit("trackClick", event);
}

function onTrackMouseDown(event: MouseEvent) {
	event.preventDefault();
	emit("trackMouseDown", event);
}
</script>

<template>
	<!-- div (not button): TimelineElement uses an inner <button>; nested buttons are invalid HTML and break hit-testing/cursor in browsers -->
	<div
		:class="['size-full', hasSelectedElements && 'bg-white/5', razorMode && 'cursor-crosshair']"
		role="presentation"
		@click="onTrackClick"
		@mousedown="onTrackMouseDown"
	>
		<div class="relative h-full min-w-full">
			<div
				v-if="track.elements.length === 0"
				class="flex size-full items-center justify-center rounded-sm border-2 border-dashed border-white/10 text-xs text-zinc-600"
			/>
			<TimelineElement
				v-for="element in track.elements"
				:key="element.id"
				:element="element"
				:track="track"
				:zoom-level="zoomLevel"
				:is-selected="isElementSelected({ trackId: track.id, elementId: element.id })"
				:snapping-enabled="snappingEnabled"
				:is-playhead-scrubbing="isPlayheadScrubbing"
				:is-effect-drop-target="effectDropTargetId === element.id"
				:ripple-shifts="rippleShifts"
				@snap-point-change="(sp) => emit('snapPointChange', sp)"
				@resize-state-change="(p) => emit('resizeStateChange', p)"
				@ripple-shifts-change="onRippleShiftsChange"
				@element-mouse-down="(ev, el) => emit('elementMouseDown', { event: ev, element: el, track })"
				@element-click="(ev, el) => handleElementClick(ev, el)"
				@element-context-menu="(ev: MouseEvent, el: TimelineElementType) => emit('elementContextMenu', { event: ev, element: el, track })"
				@keyframe-click="(payload) => emit('keyframeClick', payload)"
			/>
		</div>
	</div>
</template>
