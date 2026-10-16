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
		:class="[
			'group/sticker relative flex aspect-square min-w-0 cursor-grab items-center justify-center rounded-md border transition-colors active:cursor-grabbing',
			'focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
			isAdding
				? 'pointer-events-none border-brand-line bg-brand-soft'
				: 'border-line-subtle bg-surface-raised hover:border-brand-line hover:bg-brand-soft',
		]"
		:title="`${displayName} (${collectionPrefix})`"
		:aria-label="`Add ${displayName} sticker`"
		@click="handleClick"
		@pointerdown="handlePointerDown"
		@dragstart.prevent
	>
		<!-- Icon preview (user content) -->
		<div v-if="!imageError" class="flex size-full items-center justify-center p-2">
			<img
				:src="getSrc()"
				:alt="displayName"
				class="size-full object-contain transition-transform duration-150 group-hover/sticker:scale-110"
				loading="lazy"
				draggable="false"
				@error="handleImgError"
			/>
		</div>
		<!-- Fallback text -->
		<div v-else class="flex size-full items-center justify-center p-1">
			<span class="break-all text-center text-2xs leading-tight text-fg-subtle">
				{{ displayName }}
			</span>
		</div>

		<!-- Adding spinner overlay -->
		<div v-if="isAdding" class="absolute inset-0 grid place-items-center rounded-md bg-[var(--overlay)]">
			<Loader2 class="size-4 animate-spin text-fg" />
		</div>
	</button>
</template>
