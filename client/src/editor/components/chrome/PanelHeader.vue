<script setup lang="ts">
/**
 * 36px header row for editor side panels (properties, layers, dock tabs).
 * Title on the left, small icon actions in the default slot on the right.
 * Matches the height of the preview toolbar so the three columns line up.
 */
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps<{
	title?: string;
	class?: HTMLAttributes["class"];
}>();
</script>

<template>
	<div
		:class="
			cn(
				'flex h-9 shrink-0 items-center gap-1 border-b border-line-subtle pl-3 pr-1.5',
				props.class,
			)
		"
	>
		<slot name="title">
			<span v-if="title" class="min-w-0 flex-1 truncate text-xs font-medium text-fg-muted">{{ title }}</span>
		</slot>
		<slot />
	</div>
</template>
