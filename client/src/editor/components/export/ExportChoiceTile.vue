<script setup lang="ts">
/**
 * Selectable option tile for the export dialog (format and framing choices):
 * a title row with a check indicator, an optional preview and a caption.
 */
import { Check } from "lucide-vue-next";

defineProps<{
	selected?: boolean;
	disabled?: boolean;
}>();
</script>

<template>
	<button
		type="button"
		:disabled="disabled"
		:aria-pressed="selected"
		:class="[
			'flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors disabled:cursor-default',
			selected
				? 'border-brand-line bg-brand-soft'
				: 'border-line-subtle bg-surface enabled:hover:border-line enabled:hover:bg-surface-hover',
			disabled && !selected && 'opacity-55',
		]"
	>
		<div class="flex items-center gap-1.5 text-sm font-semibold text-fg">
			<slot name="title" />
			<span
				:class="[
					'ml-auto grid size-4 shrink-0 place-items-center rounded-[4px] border',
					selected ? 'border-brand bg-brand text-brand-fg' : 'border-line-strong',
				]"
			>
				<Check v-if="selected" class="size-3" />
			</span>
		</div>
		<div v-if="$slots.preview" class="flex h-12 items-center justify-center">
			<slot name="preview" />
		</div>
		<p class="text-xs text-fg-muted">
			<slot />
		</p>
	</button>
</template>
