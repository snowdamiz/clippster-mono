<script setup lang="ts">
import { computed } from "vue";
import { getDropLineY } from "../../lib/timeline/drop-utils";
import type { TimelineTrack, DropTarget } from "../../types/timeline";

const props = defineProps<{
	dropTarget: DropTarget | null;
	tracks: TimelineTrack[];
	isVisible: boolean;
	headerHeight?: number;
}>();

const lineTop = computed(() => {
	if (!props.dropTarget) return 0;
	return getDropLineY({ dropTarget: props.dropTarget, tracks: props.tracks }) + (props.headerHeight ?? 0);
});
</script>

<template>
	<div
		v-if="isVisible && dropTarget"
		class="bg-primary pointer-events-none absolute right-0 left-0 z-50 h-0.5"
		:style="{ top: `${lineTop}px` }"
	/>
</template>
