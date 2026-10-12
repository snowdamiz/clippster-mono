<script setup lang="ts">
/**
 * Small selectable button for inspector option sets: flip toggles, aspect
 * presets, B/I/U toggles, alignment, quick styles. Selected = brand.
 *
 *   <OptionChip :active="flipH" :icon="FlipHorizontal" @click="toggleFlipH">Flip H</OptionChip>
 *
 * `variant="ghost"` drops the border so chips can sit inside a ChipGroup.
 * `square` makes an icon-only 28px (or 24px in a group) button — pass a
 * `title` for the tooltip / accessible name.
 */
import type { Component, HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

const props = withDefaults(
	defineProps<{
		active?: boolean;
		icon?: Component;
		variant?: "outline" | "ghost";
		square?: boolean;
		disabled?: boolean;
		class?: HTMLAttributes["class"];
	}>(),
	{ variant: "outline" },
);
</script>

<template>
	<button
		type="button"
		:aria-pressed="active"
		:disabled="disabled"
		:class="
			cn(
				'inline-flex min-w-0 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-xs font-medium transition-colors',
				'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-3.5 [&_svg]:shrink-0',
				variant === 'outline'
					? [
						'h-7 border',
						square ? 'w-7' : 'px-2',
						active
							? 'border-brand-line bg-brand-soft text-brand'
							: 'border-line bg-surface-raised text-fg-muted hover:border-line-strong hover:text-fg',
					]
					: [
						'h-6',
						square ? 'w-6' : 'px-1.5',
						active ? 'bg-brand-soft text-brand' : 'text-fg-muted hover:bg-surface-hover hover:text-fg',
					],
				props.class,
			)
		"
	>
		<component :is="icon" v-if="icon" />
		<slot />
	</button>
</template>
