<script setup lang="ts">
/**
 * Compact native select for dense inspector rows (28px). Pass `options`, or
 * put <option>/<optgroup> elements in the default slot.
 *
 *   <InspectorSelect :model-value="mode" :options="BLEND_MODES" @update:model-value="setMode" />
 */
import type { HTMLAttributes } from "vue";
import { ChevronDown } from "lucide-vue-next";
import { cn } from "@/lib/utils";

const props = defineProps<{
	modelValue?: string | number | null;
	options?: ReadonlyArray<{ value: string | number; label: string; disabled?: boolean }>;
	disabled?: boolean;
	ariaLabel?: string;
	class?: HTMLAttributes["class"];
}>();

const emit = defineEmits<{ "update:modelValue": [value: string] }>();
</script>

<template>
	<div :class="cn('relative min-w-0', props.class)">
		<select
			:value="modelValue ?? ''"
			:disabled="disabled"
			:aria-label="ariaLabel"
			class="h-7 w-full min-w-0 cursor-pointer appearance-none truncate rounded-md border border-line bg-surface-raised pl-2 pr-7 text-xs text-fg transition-colors hover:border-line-strong focus-visible:border-brand-line focus-visible:shadow-[0_0_0_3px_var(--brand-soft)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
			@change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
		>
			<option
				v-for="opt in options ?? []"
				:key="String(opt.value)"
				:value="opt.value"
				:disabled="opt.disabled"
			>
				{{ opt.label }}
			</option>
			<slot />
		</select>
		<ChevronDown class="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-fg-subtle" />
	</div>
</template>
