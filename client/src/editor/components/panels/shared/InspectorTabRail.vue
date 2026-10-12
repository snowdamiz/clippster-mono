<script setup lang="ts" generic="T extends string">
/**
 * Vertical icon tab strip on the right edge of an element inspector
 * (Video / Audio / Speed / Adjust ...). Active tab = brand.
 */
import type { Component } from "vue";

defineProps<{
	tabs: ReadonlyArray<{ id: T; label: string; icon: Component }>;
	modelValue: T;
}>();

const emit = defineEmits<{ "update:modelValue": [value: T] }>();
</script>

<template>
	<nav
		class="flex w-10 shrink-0 flex-col items-center gap-1 overflow-y-auto border-l border-line-subtle bg-panel py-2 [scrollbar-width:none]"
		aria-label="Inspector sections"
	>
		<button
			v-for="tab in tabs"
			:key="tab.id"
			type="button"
			:title="tab.label"
			:aria-label="tab.label"
			:aria-current="modelValue === tab.id ? 'page' : undefined"
			:data-inspector-tab="tab.id"
			:class="[
				'grid size-7 shrink-0 place-items-center rounded-md transition-colors focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
				modelValue === tab.id
					? 'bg-brand-soft text-brand'
					: 'text-fg-subtle hover:bg-surface-hover hover:text-fg',
			]"
			@click="emit('update:modelValue', tab.id)"
		>
			<component :is="tab.icon" class="size-4" />
		</button>
	</nav>
</template>
