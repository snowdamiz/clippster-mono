<script setup lang="ts">
/**
 * Export progress block: label + percentage, a brand progress bar and a hint.
 * Pass `value` (0–1) for determinate progress, or omit it for an
 * indeterminate bar. Shared by the video and image export dialogs.
 */
defineProps<{
	label?: string;
	value?: number | null;
	hint?: string;
}>();
</script>

<template>
	<div class="flex flex-col gap-2 py-2">
		<div class="flex items-center justify-between text-sm">
			<span class="font-medium text-fg">{{ label ?? "Exporting" }}</span>
			<span v-if="value != null" class="tabular text-fg-muted">{{ Math.round(value * 100) }}%</span>
		</div>
		<div class="relative h-1.5 overflow-hidden rounded-full bg-surface-active">
			<div
				v-if="value != null"
				class="h-full rounded-full bg-brand transition-[width] duration-300 ease-out"
				:style="{ width: `${value * 100}%` }"
			/>
			<div v-else class="export-progress__indeterminate absolute inset-y-0 w-1/3 rounded-full bg-brand" />
		</div>
		<p v-if="hint" class="text-xs text-fg-subtle">{{ hint }}</p>
	</div>
</template>

<style scoped>
.export-progress__indeterminate {
	animation: export-progress-slide 1.2s ease-in-out infinite;
}

@keyframes export-progress-slide {
	0% {
		left: -33%;
	}
	100% {
		left: 100%;
	}
}
</style>
