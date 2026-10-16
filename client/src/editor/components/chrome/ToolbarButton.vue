<script setup lang="ts">
/**
 * Editor toolbar icon button — the one icon control used by the editor header,
 * preview toolbars and the timeline toolbar so they read as a single set.
 *
 * 28px ghost button. The tooltip comes from `title` (picked up by the global
 * tooltip system); `shortcut` is appended to it. `active` tints the button
 * with the brand color for toggled tools; pass `toggle` to expose
 * `aria-pressed` for on/off tools.
 *
 *   <ToolbarButton label="Split" shortcut="S" @click="split"><Scissors /></ToolbarButton>
 */
import type { HTMLAttributes } from "vue";
import { computed } from "vue";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const props = defineProps<{
	label: string;
	shortcut?: string;
	active?: boolean;
	toggle?: boolean;
	disabled?: boolean;
	size?: "icon-xs" | "icon-sm" | "icon";
	class?: HTMLAttributes["class"];
}>();

const tooltip = computed(() => (props.shortcut ? `${props.label} (${props.shortcut})` : props.label));
</script>

<template>
	<Button
		variant="ghost"
		:size="size ?? 'icon-sm'"
		:disabled="disabled"
		:title="tooltip"
		:aria-label="label"
		:aria-pressed="toggle ? Boolean(active) : undefined"
		:class="
			cn(
				active && 'bg-brand-soft text-brand hover:bg-[var(--brand-soft-hover)] hover:text-brand',
				props.class,
			)
		"
	>
		<slot />
	</Button>
</template>
