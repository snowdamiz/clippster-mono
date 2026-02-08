<script setup lang="ts">
import { computed } from "vue";
import { TIMELINE_CONSTANTS } from "../../constants/timeline-constants";
import type { SnapPoint } from "../../composables/timeline/useTimelineSnapping";

const props = defineProps<{
	snapPoint: SnapPoint | null;
	zoomLevel: number;
	isVisible: boolean;
	scrollLeft: number;
	trackLabelsWidth: number;
	timelineHeight: number;
}>();

const leftPosition = computed(() => {
	const timelinePosition =
		(props.snapPoint?.time || 0) * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * props.zoomLevel;
	return props.trackLabelsWidth + timelinePosition - props.scrollLeft;
});

const height = computed(() => Math.max(0, props.timelineHeight - 8));
</script>

<template>
	<div
		v-if="isVisible && snapPoint"
		class="pointer-events-none absolute z-90"
		:style="{
			left: `${leftPosition}px`,
			top: 0,
			height: `${height}px`,
			width: '2px',
		}"
	>
		<div class="bg-primary/40 h-full w-0.5 opacity-80" />
	</div>
</template>
