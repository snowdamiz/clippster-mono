<script setup lang="ts">
import { computed } from "vue";
import { TIMELINE_CONSTANTS } from "../../constants/timeline-constants";
import { DEFAULT_FPS } from "../../constants/project-constants";
import { useEditor } from "../../composables/useEditor";
import { getRulerConfig, shouldShowLabel } from "../../lib/timeline/ruler-utils";
import TimelineTick from "./TimelineTick.vue";

const props = defineProps<{
	zoomLevel: number;
	dynamicTimelineWidth: number;
}>();

const emit = defineEmits<{
	(e: "wheel", event: WheelEvent): void;
	(e: "rulerClick", event: MouseEvent): void;
	(e: "rulerTrackingMouseDown", event: MouseEvent): void;
	(e: "rulerMouseDown", event: MouseEvent): void;
}>();

const rulerRef = defineModel<HTMLDivElement | null>("rulerRef", { default: null });

const { editor, version } = useEditor({
	subscribe: {
		playback: false,
		timeline: true,
		scenes: true,
		project: true,
		media: false,
		selection: false,
	},
});

const duration = computed(() => {
	void version.value;
	return editor.timeline.getTotalDuration();
});

const fps = computed(() => {
	void version.value;
	return editor.project.getActiveOrNull()?.settings?.fps ?? DEFAULT_FPS;
});

const pixelsPerSecond = computed(
	() => TIMELINE_CONSTANTS.PIXELS_PER_SECOND * props.zoomLevel,
);

const visibleDuration = computed(
	() => props.dynamicTimelineWidth / pixelsPerSecond.value,
);

const effectiveDuration = computed(() =>
	Math.max(duration.value, visibleDuration.value),
);

const rulerConfig = computed(() => getRulerConfig({ zoomLevel: props.zoomLevel, fps: fps.value }));

const ticks = computed(() => {
	const { labelIntervalSeconds, tickIntervalSeconds } = rulerConfig.value;
	const tickCount = Math.ceil(effectiveDuration.value / tickIntervalSeconds) + 1;
	const result: Array<{ time: number; showLabel: boolean }> = [];
	for (let i = 0; i < tickCount; i++) {
		const time = i * tickIntervalSeconds;
		if (time > effectiveDuration.value) break;
		result.push({
			time,
			showLabel: shouldShowLabel({ time, labelIntervalSeconds }),
		});
	}
	return result;
});
</script>

<template>
	<div
		role="slider"
		tabindex="0"
		aria-label="Timeline ruler"
		:aria-valuemin="0"
		:aria-valuemax="effectiveDuration"
		:aria-valuenow="0"
		class="relative h-4 flex-1 overflow-x-visible"
		@wheel="emit('wheel', $event)"
		@click="emit('rulerClick', $event)"
		@mousedown="emit('rulerTrackingMouseDown', $event)"
	>
		<div
			role="none"
			:ref="(el) => { rulerRef = el as HTMLDivElement }"
			class="relative h-4 cursor-default select-none"
			:style="{ width: `${dynamicTimelineWidth}px` }"
			@mousedown="emit('rulerMouseDown', $event)"
		>
			<TimelineTick
				v-for="(tick, index) in ticks"
				:key="index"
				:time="tick.time"
				:zoom-level="zoomLevel"
				:fps="fps"
				:show-label="tick.showLabel"
			/>
		</div>
	</div>
</template>
