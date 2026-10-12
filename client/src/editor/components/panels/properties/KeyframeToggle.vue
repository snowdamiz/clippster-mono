<script setup lang="ts">
import { Diamond } from "lucide-vue-next";

const props = defineProps<{
	active: boolean;
	label?: string;
}>();

const emit = defineEmits<{
	(e: "toggle"): void;
}>();
</script>

<template>
	<button
		type="button"
		class="grid size-5 shrink-0 place-items-center rounded transition-colors hover:bg-surface-hover"
		:class="active ? 'text-warning' : 'text-fg-disabled hover:text-fg-muted'"
		:title="active ? `Remove ${label ?? ''} keyframe` : `Add ${label ?? ''} keyframe`"
		:aria-label="active ? `Remove ${label ?? ''} keyframe` : `Add ${label ?? ''} keyframe`"
		:aria-pressed="active"
		@click="emit('toggle')"
	>
		<Diamond class="size-3" :class="active && 'fill-current'" />
	</button>
</template>
