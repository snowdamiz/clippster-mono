<script setup lang="ts">
/**
 * Inspector card with a title + Switch header; its body (controls for the
 * feature) is shown only while the switch is on. Used for the text
 * inspector's Stroke / Shadow / Glow / Gradient toggles.
 *
 *   <InspectorSwitchCard title="Stroke" :model-value="showStroke" :open="!!element.stroke" @update:model-value="toggleStroke">
 *     ...controls
 *   </InspectorSwitchCard>
 */
import { Switch } from "@/components/ui/switch";

const props = withDefaults(
	defineProps<{
		title: string;
		modelValue: boolean;
		/** Show the body; defaults to `modelValue`. */
		open?: boolean;
	}>(),
	{ open: undefined },
);

const emit = defineEmits<{ "update:modelValue": [value: boolean] }>();
</script>

<template>
	<div class="overflow-hidden rounded-lg border border-line-subtle bg-surface-raised">
		<div class="flex h-9 items-center gap-2 pl-2.5 pr-2">
			<span
				class="min-w-0 flex-1 cursor-pointer select-none truncate text-xs font-medium transition-colors"
				:class="modelValue ? 'text-fg' : 'text-fg-muted hover:text-fg'"
				@click="emit('update:modelValue', !modelValue)"
			>
				{{ title }}
			</span>
			<Switch
				:model-value="modelValue"
				:aria-label="title"
				@update:model-value="(v: boolean) => emit('update:modelValue', v)"
			/>
		</div>
		<div
			v-if="(props.open ?? modelValue) && $slots.default"
			class="space-y-1.5 border-t border-line-subtle px-2.5 py-2"
		>
			<slot />
		</div>
	</div>
</template>
