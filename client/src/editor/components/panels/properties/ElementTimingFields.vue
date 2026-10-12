<script setup lang="ts">
import { toRef } from "vue";
import type { TimelineElement } from "../../../types/timeline";
import { useElementTimingInspector } from "../../../composables/panels/useElementTimingInspector";
import { useImageMode } from "../../../composables/useImageMode";
import InspectorField from "../shared/InspectorField.vue";
import NumberBox from "../shared/NumberBox.vue";

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
	<div v-if="!isImageMode" class="grid grid-cols-2 gap-2">
		<InspectorField label="Start">
			<NumberBox
				type="text"
				:value="startInput"
				aria-label="Start time"
				@input="onStartInput"
				@commit="commitStart"
			/>
		</InspectorField>
		<InspectorField label="Duration">
			<NumberBox
				type="text"
				:value="durationInput"
				aria-label="Duration"
				@input="onDurationInput"
				@commit="commitDuration"
			/>
		</InspectorField>
	</div>
</template>
