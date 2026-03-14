<script setup lang="ts">
import { ref, watch } from "vue";
import { usePointerDrag } from "../../../composables/usePointerDrag";
import { getIconSvgUrl, ICONIFY_HOSTS, buildIconSvgUrl } from "../../../lib/iconify-api";
import { Loader2 } from "lucide-vue-next";

const props = defineProps<{
	iconName: string;
	isAdding?: boolean;
}>();

const emit = defineEmits<{
	(e: "add", iconName: string): void;
}>();

const imageError = ref(false);
const hostIndex = ref(0);

watch(() => props.iconName, () => {
	imageError.value = false;
	hostIndex.value = 0;
});

const { startDrag, wasDragCompleted } = usePointerDrag();

const displayName = props.iconName.split(":")[1] || props.iconName;
const collectionPrefix = props.iconName.split(":")[0];

function getSrc() {
	if (hostIndex.value === 0) {
		return getIconSvgUrl(props.iconName, { width: 64, height: 64 });
	}
	return buildIconSvgUrl(
		ICONIFY_HOSTS[Math.min(hostIndex.value, ICONIFY_HOSTS.length - 1)],
		props.iconName,
		{ width: 64, height: 64 },
	);
}

function handleImgError() {
	const next = hostIndex.value + 1;
	if (next < ICONIFY_HOSTS.length) {
		hostIndex.value = next;
	} else {
		imageError.value = true;
	}
}

function handlePointerDown(e: PointerEvent) {
	startDrag(e, {
		id: props.iconName,
		type: "sticker",
		name: displayName,
		iconName: props.iconName,
	});
}

function handleClick() {
	if (wasDragCompleted.value) return;
	emit("add", props.iconName);
}
</script>

<template>
	<button
		type="button"
		class="group relative flex aspect-square cursor-grab items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] transition-all hover:border-white/15 hover:bg-white/[0.07] active:cursor-grabbing"
		:class="isAdding && 'pointer-events-none opacity-40'"
		:title="`${displayName} (${collectionPrefix})`"
		@click="handleClick"
		@pointerdown="handlePointerDown"
		@dragstart.prevent
	>
		<!-- Icon preview -->
		<div v-if="!imageError" class="flex size-full items-center justify-center p-2.5">
			<img
				:src="getSrc()"
				:alt="displayName"
				class="size-full object-contain"
				loading="lazy"
				draggable="false"
				@error="handleImgError"
			/>
		</div>
		<!-- Fallback text -->
		<div v-else class="flex size-full items-center justify-center p-1.5">
			<span class="text-center text-[10px] leading-tight text-zinc-500 break-all">
				{{ displayName }}
			</span>
		</div>

		<!-- Adding spinner overlay -->
		<div v-if="isAdding" class="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-black/50">
			<Loader2 class="size-4 animate-spin text-white" />
		</div>
	</button>
</template>
