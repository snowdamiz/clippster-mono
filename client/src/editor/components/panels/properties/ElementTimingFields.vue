<script setup lang="ts">
import { toRef } from "vue";
import type { TimelineElement } from "../../../types/timeline";
import { useElementTimingInspector } from "../../../composables/panels/useElementTimingInspector";
import { useImageMode } from "../../../composables/useImageMode";

const props = defineProps<{
	element: TimelineElement;
	trackId: string;
}>();

const { isImageMode } = useImageMode();

const {
	startInput,
	durationInput,
	onStartInput,
	onDurationInput,
	commitStart,
	commitDuration,
} = useElementTimingInspector({
	element: toRef(props, "element"),
	trackId: props.trackId,
});
</script>

<template>
	<div v-if="!isImageMode" class="flex gap-4">
		<div class="min-w-0 flex-1 space-y-1">
			<label class="text-xs text-zinc-500">Start</label>
			<input
				type="text"
				:value="startInput"
				class="h-7 w-full rounded-sm border border-white/10 bg-white/5 px-2 text-sm text-zinc-200 outline-none focus:border-white/20"
				@input="(e) => onStartInput((e.target as HTMLInputElement).value)"
				@blur="commitStart"
				@keydown.enter="($event.target as HTMLInputElement).blur()"
			/>
		</div>
		<div class="min-w-0 flex-1 space-y-1">
			<label class="text-xs text-zinc-500">Duration</label>
			<input
				type="text"
				:value="durationInput"
				class="h-7 w-full rounded-sm border border-white/10 bg-white/5 px-2 text-sm text-zinc-200 outline-none focus:border-white/20"
				@input="(e) => onDurationInput((e.target as HTMLInputElement).value)"
				@blur="commitDuration"
				@keydown.enter="($event.target as HTMLInputElement).blur()"
			/>
		</div>
	</div>
</template>
