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
		class="pointer-events-auto absolute z-60"
		:style="{
			left: `${leftPosition}px`,
			top: 0,
			height: `${totalHeight}px`,
			width: '2px',
		}"
		@mousedown="emit('playheadMouseDown', $event)"
		@keydown="handleKeyDown"
	>
		<div class="bg-foreground absolute left-0 h-full w-0.5 cursor-col-resize" />
		<div
			class="absolute top-1 left-1/2 size-3 -translate-x-1/2 transform rounded-full border-2 shadow-xs"
			:class="isSnappingToPlayhead ? 'bg-foreground border-foreground' : 'bg-foreground border-foreground/50'"
		/>
	</div>
</template>
