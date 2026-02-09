<script setup lang="ts">
import { computed } from "vue";
import { TIMELINE_CONSTANTS } from "../../constants/timeline-constants";
import { formatRulerLabel } from "../../lib/timeline/ruler-utils";

const props = defineProps<{
	time: number;
	zoomLevel: number;
	fps: number;
	showLabel: boolean;
}>();

const leftPosition = computed(
	() => props.time * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * props.zoomLevel,
);

const label = computed(() =>
	formatRulerLabel({ timeInSeconds: props.time, fps: props.fps }),
);
</script>

<template>
	<span
		v-if="showLabel"
		class="text-zinc-500/85 absolute bottom-0 select-none text-[10px] leading-none"
		:style="{ left: `${leftPosition}px` }"
	>
		{{ label }}
	</span>
	<div
		v-else
		class="border-zinc-500/25 absolute bottom-0.5 h-1.5 border-l"
		:style="{ left: `${leftPosition}px` }"
	/>
</template>
