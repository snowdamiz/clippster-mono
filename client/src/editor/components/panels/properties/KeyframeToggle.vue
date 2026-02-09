<script setup lang="ts">
import { computed } from "vue";
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
		class="flex items-center justify-center rounded p-0.5 transition-colors"
		:class="active ? 'text-yellow-400 hover:text-yellow-300' : 'text-zinc-600 hover:text-zinc-400'"
		:title="active ? `Remove ${label ?? ''} keyframe` : `Add ${label ?? ''} keyframe`"
		@click="emit('toggle')"
	>
		<Diamond class="size-3" :class="active ? 'fill-yellow-400' : ''" />
	</button>
</template>
