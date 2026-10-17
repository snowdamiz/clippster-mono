<script setup lang="ts">
/**
 * Joined container for a row of `OptionChip variant="ghost"` toggles
 * (e.g. B / I / U, text alignment). 28px tall, like other inspector controls.
 */
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
</script>

<template>
	<div
		role="group"
		:class="cn('inline-flex h-7 shrink-0 items-center gap-0.5 rounded-md border border-line bg-surface-raised p-px', props.class)"
	>
		<slot />
	</div>
</template>
