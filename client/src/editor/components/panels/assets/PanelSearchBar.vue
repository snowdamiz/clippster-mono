<script setup lang="ts">
import { Search } from "lucide-vue-next";

defineProps<{
	modelValue: string;
	placeholder?: string;
}>();

defineEmits<{
	"update:modelValue": [value: string];
	input: [event: Event];
	"keydown.enter": [];
}>();
</script>

<template>
	<div class="flex items-center border-b border-white/10">
		<div class="relative flex-1">
			<Search class="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
			<input
				:value="modelValue"
				type="text"
				:placeholder="placeholder"
				class="w-full bg-transparent py-2 pl-8 pr-3 text-sm text-zinc-200 placeholder-zinc-500 outline-none"
				@input="$emit('update:modelValue', ($event.target as HTMLInputElement).value); $emit('input', $event)"
				@keydown.enter="$emit('keydown.enter')"
			/>
		</div>
		<slot />
	</div>
</template>
