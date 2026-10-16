<script setup lang="ts">
/**
 * Row for list-style asset views (sounds, audio library, media list, saved
 * items): leading thumb/icon, title + meta, trailing actions.
 * Listeners/attrs land on the root element.
 *
 *   <AssetListRow :title="s.name" :meta="formatDuration(s.duration)" @click="play(s)">
 *     <template #leading><IconTile :icon="Music" size="sm" /></template>
 *     <template #trailing><Button variant="ghost" size="icon-xs" ...><Plus /></Button></template>
 *   </AssetListRow>
 */
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

const props = withDefaults(
	defineProps<{
		title?: string;
		meta?: string;
		selected?: boolean;
		as?: "button" | "div";
		/** Keep trailing actions visible (otherwise they show on hover/focus). */
		persistentActions?: boolean;
		class?: HTMLAttributes["class"];
	}>(),
	{ as: "div" },
);
</script>

<template>
	<component
		:is="as"
		:type="as === 'button' ? 'button' : undefined"
		:class="
			cn(
				'group/row flex w-full min-w-0 items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors',
				'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
				selected ? 'bg-brand-soft' : 'hover:bg-surface-hover',
				props.class,
			)
		"
	>
		<div v-if="$slots.leading" class="flex shrink-0 items-center">
			<slot name="leading" />
		</div>
		<div class="min-w-0 flex-1">
			<p class="truncate text-xs font-medium leading-4" :class="selected ? 'text-brand' : 'text-fg'">
				<slot name="title">{{ title }}</slot>
			</p>
			<p v-if="meta || $slots.meta" class="flex min-w-0 items-center gap-1 truncate text-2xs leading-4 text-fg-subtle">
				<slot name="meta">{{ meta }}</slot>
			</p>
			<slot />
		</div>
		<div
			v-if="$slots.trailing"
			:class="
				cn(
					'flex shrink-0 items-center gap-0.5',
					!persistentActions && 'opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100',
				)
			"
		>
			<slot name="trailing" />
		</div>
	</component>
</template>
