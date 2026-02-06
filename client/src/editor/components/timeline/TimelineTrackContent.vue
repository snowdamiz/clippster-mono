<script setup lang="ts">
import { computed, ref } from "vue";
import { useEditor } from "../../composables/useEditor";
import { useElementSelection } from "../../composables/timeline/element/useElementSelection";
import TimelineElement from "./TimelineElement.vue";
import type {
	TimelineTrack,
	TimelineElement as TimelineElementType,
	ElementDragState,
} from "../../types/timeline";
import type { SnapPoint } from "../../composables/timeline/useTimelineSnapping";

const props = defineProps<{
	track: TimelineTrack;
	zoomLevel: number;
	dragState: ElementDragState;
	snappingEnabled: boolean;
}>();

const emit = defineEmits<{
	(e: "snapPointChange", snapPoint: SnapPoint | null): void;
	(e: "resizeStateChange", params: { isResizing: boolean }): void;
	(e: "elementMouseDown", params: { event: MouseEvent; element: TimelineElementType; track: TimelineTrack }): void;
	(e: "elementClick", params: { event: MouseEvent; element: TimelineElementType; track: TimelineTrack }): void;
	(e: "trackMouseDown", event: MouseEvent): void;
	(e: "trackClick", event: MouseEvent): void;
}>();

defineExpose({});

const { editor, version } = useEditor();
const { isElementSelected, clearElementSelection } = useElementSelection();

const rippleShifts = ref<Map<string, number>>(new Map());

function onRippleShiftsChange(shifts: Map<string, number>) {
	rippleShifts.value = shifts;
}

const hasSelectedElements = computed(() =>
	props.track.elements.some((element) =>
		isElementSelected({ trackId: props.track.id, elementId: element.id }),
	),
);

function onTrackClick(event: MouseEvent) {
	clearElementSelection();
	emit("trackClick", event);
}

function onTrackMouseDown(event: MouseEvent) {
	event.preventDefault();
	emit("trackMouseDown", event);
}
</script>

<template>
	<button
		:class="['size-full', hasSelectedElements && 'bg-white/5']"
		type="button"
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
				:drag-state="dragState"
				:snapping-enabled="snappingEnabled"
				:ripple-shifts="rippleShifts"
				@snap-point-change="(sp) => emit('snapPointChange', sp)"
				@resize-state-change="(p) => emit('resizeStateChange', p)"
				@ripple-shifts-change="onRippleShiftsChange"
				@element-mouse-down="(ev, el) => emit('elementMouseDown', { event: ev, element: el, track })"
				@element-click="(ev, el) => emit('elementClick', { event: ev, element: el, track })"
			/>
		</div>
	</button>
</template>
