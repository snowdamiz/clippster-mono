<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
	startPos: { x: number; y: number } | null;
	currentPos: { x: number; y: number } | null;
	containerEl: HTMLElement | null;
	isActive: boolean;
}>();

const selectionBoxStyle = computed(() => {
	if (!props.isActive || !props.startPos || !props.currentPos || !props.containerEl) {
		return null;
	}

	const containerRect = props.containerEl.getBoundingClientRect();
	const startX = props.startPos.x - containerRect.left;
	const startY = props.startPos.y - containerRect.top;
	const currentX = props.currentPos.x - containerRect.left;
	const currentY = props.currentPos.y - containerRect.top;

	return {
		left: `${Math.min(startX, currentX)}px`,
		top: `${Math.min(startY, currentY)}px`,
		width: `${Math.abs(currentX - startX)}px`,
		height: `${Math.abs(currentY - startY)}px`,
	};
});
</script>

<template>
	<div
		v-if="selectionBoxStyle"
		:style="selectionBoxStyle"
		class="border-foreground/50 bg-foreground/5 pointer-events-none absolute z-50 border"
	/>
</template>
