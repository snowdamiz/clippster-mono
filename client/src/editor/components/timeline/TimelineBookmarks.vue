<script setup lang="ts">
import { computed } from "vue";
import { useEditor } from "../../composables/useEditor";
import { TIMELINE_CONSTANTS } from "../../constants/timeline-constants";
import { getSnappedSeekTime } from "../../lib/time";
import { Bookmark } from "lucide-vue-next";

const props = defineProps<{
	zoomLevel: number;
	dynamicTimelineWidth: number;
}>();

const emit = defineEmits<{
	(e: "wheel", event: WheelEvent): void;
	(e: "timelineClick", event: MouseEvent): void;
	(e: "rulerMouseDown", event: MouseEvent): void;
}>();

const { editor, version } = useEditor();

const bookmarks = computed(() => {
	void version.value;
	const scene = editor.scenes.getActiveScene();
	return scene?.bookmarks ?? [];
});

function handleBookmarkClick(time: number, event: MouseEvent) {
	event.stopPropagation();
	const activeProject = editor.project.getActive();
	const duration = editor.timeline.getTotalDuration();
	const fps = activeProject?.settings.fps ?? 30;
	const snappedTime = getSnappedSeekTime({ rawTime: time, duration, fps });
	editor.playback.seek({ time: snappedTime });
}
</script>

<template>
	<div class="relative h-4 flex-1 overflow-hidden">
		<button
			class="relative h-4 w-full cursor-default select-none border-0 bg-transparent p-0"
			:style="{ width: `${dynamicTimelineWidth}px` }"
			aria-label="Timeline bookmarks"
			type="button"
			@wheel="emit('wheel', $event)"
			@click="emit('timelineClick', $event)"
			@mousedown="emit('rulerMouseDown', $event)"
		>
			<button
				v-for="time in bookmarks"
				:key="`bookmark-${time}`"
				class="absolute top-0 h-10 w-0.5 cursor-pointer border-0 bg-transparent p-0"
				:style="{ left: `${time * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel}px` }"
				:aria-label="`Seek to bookmark at ${time}s`"
				type="button"
				@mousedown.prevent.stop
				@click="handleBookmarkClick(time, $event)"
			>
				<div class="text-primary absolute -left-[5px] -top-px">
					<Bookmark class="fill-primary size-3" />
				</div>
			</button>
		</button>
	</div>
</template>
