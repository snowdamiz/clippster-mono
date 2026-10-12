<script setup lang="ts">
/**
 * Row for hand-positioned editor menus (timeline context menu). Same metrics
 * as the DropdownMenu primitive's items: icon, label, optional shortcut.
 * `active` marks the current choice; `destructive` tints it red.
 */
import type { Component } from "vue";
import { Check } from "lucide-vue-next";

defineProps<{
	icon?: Component;
	shortcut?: string;
	disabled?: boolean;
	active?: boolean;
	destructive?: boolean;
	/** Shows a check mark on the right when active (for value pickers). */
	checkable?: boolean;
}>();
</script>

<template>
	<button
		type="button"
		:disabled="disabled"
		:class="[
			'flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-xs transition-colors disabled:pointer-events-none disabled:opacity-45',
			destructive
				? 'text-danger hover:bg-danger-soft'
				: active
					? 'text-brand hover:bg-surface-active'
					: 'text-fg hover:bg-surface-active',
		]"
	>
		<component :is="icon" v-if="icon" :class="['size-3.5 shrink-0', destructive || active ? '' : 'text-fg-muted']" />
		<span class="min-w-0 flex-1 truncate"><slot /></span>
		<span v-if="shortcut" class="ml-3 shrink-0 font-mono text-2xs text-fg-subtle">{{ shortcut }}</span>
		<Check v-if="checkable && active" class="size-3.5 shrink-0" />
	</button>
</template>
