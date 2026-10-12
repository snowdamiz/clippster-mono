<script setup lang="ts">
/**
 * Compact text + chevron trigger for editor toolbar menus (aspect ratio,
 * playback speed, preview quality, ...). Use as the `as-child` of a
 * `DropdownMenuTrigger`. `active` tints it with the brand color when the
 * value differs from the default.
 */
import type { HTMLAttributes } from "vue";
import { ChevronDown } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const props = defineProps<{
	active?: boolean;
	class?: HTMLAttributes["class"];
}>();
</script>

<template>
	<Button
		variant="ghost"
		size="sm"
		:class="
			cn(
				'gap-1 px-2 font-normal tabular data-[state=open]:bg-surface-hover data-[state=open]:text-fg',
				active && 'text-brand hover:text-brand',
				props.class,
			)
		"
	>
		<slot />
		<ChevronDown class="!size-3 opacity-60" />
	</Button>
</template>
