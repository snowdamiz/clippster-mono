<script setup lang="ts">
/**
 * Labeled inspector row. Stacked by default (label row above the control,
 * with an optional value readout / actions such as a keyframe toggle on the
 * right); `inline` puts a fixed-width label to the left of the control.
 *
 *   <InspectorField label="Opacity" :value="`${pct}%`">
 *     <template #actions><KeyframeToggle ... /></template>
 *     <input type="range" ... />
 *   </InspectorField>
 */
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps<{
	label?: string;
	/** Read-only value shown at the right end of the label row. */
	value?: string | number;
	inline?: boolean;
	/** id of the control, links the label for click-to-focus. */
	for?: string;
	class?: HTMLAttributes["class"];
}>();
</script>

<template>
	<div v-if="inline" :class="cn('flex min-h-7 items-center gap-2', props.class)">
		<label :for="props.for" class="w-20 shrink-0 truncate text-xs text-fg-muted">
			<slot name="label">{{ label }}</slot>
		</label>
		<div class="flex min-w-0 flex-1 items-center gap-2">
			<slot />
		</div>
		<div v-if="$slots.actions || value !== undefined" class="flex shrink-0 items-center gap-1">
			<span v-if="value !== undefined" class="tabular text-xs text-fg">{{ value }}</span>
			<slot name="actions" />
		</div>
	</div>
	<div v-else :class="cn('space-y-1.5', props.class)">
		<div
			v-if="label || $slots.label || $slots.actions || value !== undefined"
			class="flex min-h-4 items-center justify-between gap-2"
		>
			<label :for="props.for" class="truncate text-xs text-fg-muted">
				<slot name="label">{{ label }}</slot>
			</label>
			<div v-if="$slots.actions || value !== undefined" class="flex shrink-0 items-center gap-1.5">
				<span v-if="value !== undefined" class="tabular text-xs text-fg">{{ value }}</span>
				<slot name="actions" />
			</div>
		</div>
		<slot />
	</div>
</template>
