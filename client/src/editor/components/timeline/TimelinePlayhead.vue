<script setup lang="ts">
import { computed } from "vue";
import { TIMELINE_CONSTANTS } from "../../constants/timeline-constants";
import { useEditor } from "../../composables/useEditor";

const props = defineProps<{
	zoomLevel: number;
	playheadPosition: number;
	totalHeight: number;
	isSnappingToPlayhead?: boolean;
}>();

const emit = defineEmits<{
	(e: "playheadMouseDown", event: MouseEvent): void;
}>();

const { editor, version } = useEditor();

const duration = computed(() => {
	void version.value;
	return editor.timeline.getTotalDuration();
});

const leftPosition = computed(
	() => props.playheadPosition * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * props.zoomLevel,
);

function handleKeyDown(event: KeyboardEvent) {
	if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
	event.preventDefault();
	const fps = editor.project.getActive()?.settings?.fps ?? 30;
	const step = 1 / Math.max(1, fps);
	const direction = event.key === "ArrowRight" ? 1 : -1;
	const nextTime = Math.max(0, Math.min(duration.value, props.playheadPosition + direction * step));
	editor.playback.seek({ time: nextTime });
}
</script>

<template>
	<div
		role="slider"
		aria-label="Timeline playhead"
		:aria-valuemin="0"
		:aria-valuemax="duration"
		:aria-valuenow="playheadPosition"
		tabindex="0"
		class="pointer-events-auto absolute z-60 cursor-col-resize"
		:style="{
			left: `${leftPosition - 6}px`,
			top: 0,
			height: `${totalHeight}px`,
			width: '12px',
		}"
		@mousedown="emit('playheadMouseDown', $event)"
		@keydown="handleKeyDown"
	>
		<!-- 1px white line -->
		<div class="absolute left-[5px] h-full w-px bg-white/50" />
		<!-- Downward triangle head in cyan, sits above the line -->
		<div
			class="absolute -top-[1px] left-1/2 -translate-x-1/2 cursor-grab active:cursor-grabbing"
			:style="{
				width: 0,
				height: 0,
				borderLeft: '8px solid transparent',
				borderRight: '8px solid transparent',
				borderTop: '12px solid rgba(255,255,255,0.9)',
				filter: isSnappingToPlayhead ? 'drop-shadow(0 0 4px #0ea5e9)' : 'none',
			}"
		/>
	</div>
</template>
