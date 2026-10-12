<script setup lang="ts">
/** Thin vertical hairline between groups of editor toolbar controls. */
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps<{ class?: HTMLAttributes["class"] }>();
</script>

<template>
	<div :class="cn('mx-1 h-4 w-px shrink-0 bg-line', props.class)" aria-hidden="true" />
</template>
