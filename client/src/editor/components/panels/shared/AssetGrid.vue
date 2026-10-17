<script setup lang="ts">
/**
 * Responsive tile grid for asset browser views. Columns fill the panel
 * width with a minimum tile width of `min` px.
 */
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

const props = withDefaults(defineProps<{ min?: number; class?: HTMLAttributes["class"] }>(), { min: 88 });
</script>

<template>
	<div
		:class="cn('grid gap-2', props.class)"
		:style="{ gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))` }"
	>
		<slot />
	</div>
</template>
