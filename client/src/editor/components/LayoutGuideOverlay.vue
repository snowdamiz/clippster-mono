<script setup lang="ts">
import { ref } from "vue";

const platform = ref<"tiktok" | null>(null);
</script>

<template>
	<div v-if="platform === 'tiktok'" class="pointer-events-none absolute inset-0">
		<img
			src="/platform-guides/tiktok-blueprint.png"
			alt="TikTok layout guide"
			class="absolute inset-0 size-full object-contain"
			draggable="false"
		/>
	</div>
</template>
