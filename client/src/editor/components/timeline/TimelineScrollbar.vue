<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";

const props = defineProps<{
	scrollContainer: HTMLDivElement;
	trackLabelsWidth: number;
}>();

const trackRef = ref<HTMLDivElement | null>(null);
const thumbRef = ref<HTMLDivElement | null>(null);
const isDragging = ref(false);
const dragStartX = ref(0);
const dragStartScrollLeft = ref(0);
const scrollLeft = ref(0);
const scrollWidth = ref(0);
const clientWidth = ref(0);

const thumbWidth = computed(() => {
	if (scrollWidth.value <= 0 || clientWidth.value <= 0) return 0;
	const ratio = clientWidth.value / scrollWidth.value;
	if (ratio >= 1) return 0;
	const trackW = trackRef.value?.clientWidth ?? 0;
	return Math.max(40, ratio * trackW);
});

const thumbLeft = computed(() => {
	if (scrollWidth.value <= clientWidth.value) return 0;
	const trackW = trackRef.value?.clientWidth ?? 0;
	const maxThumbLeft = trackW - thumbWidth.value;
	const scrollRatio = scrollLeft.value / (scrollWidth.value - clientWidth.value);
	return scrollRatio * maxThumbLeft;
});

const isVisible = computed(() => scrollWidth.value > clientWidth.value);

function syncFromContainer() {
	const el = props.scrollContainer;
	if (!el) return;
	scrollLeft.value = el.scrollLeft;
	scrollWidth.value = el.scrollWidth;
	clientWidth.value = el.clientWidth;
}

function onThumbMouseDown(e: MouseEvent) {
	e.preventDefault();
	e.stopPropagation();
	isDragging.value = true;
	dragStartX.value = e.clientX;
	dragStartScrollLeft.value = scrollLeft.value;
	document.addEventListener("mousemove", onMouseMove);
	document.addEventListener("mouseup", onMouseUp);
}

function onMouseMove(e: MouseEvent) {
	const container = props.scrollContainer;
	if (!isDragging.value || !container) return;
	const trackW = trackRef.value?.clientWidth ?? 0;
	const maxThumbLeft = trackW - thumbWidth.value;
	if (maxThumbLeft <= 0) return;

	const deltaX = e.clientX - dragStartX.value;
	const scrollRange = scrollWidth.value - clientWidth.value;
	const scrollDelta = (deltaX / maxThumbLeft) * scrollRange;
	const newScrollLeft = Math.max(0, Math.min(scrollRange, dragStartScrollLeft.value + scrollDelta));
	container.scrollLeft = newScrollLeft;
}

function onMouseUp() {
	isDragging.value = false;
	document.removeEventListener("mousemove", onMouseMove);
	document.removeEventListener("mouseup", onMouseUp);
}

function onTrackClick(e: MouseEvent) {
	const container = props.scrollContainer;
	if (e.target === thumbRef.value || !container || !trackRef.value) return;
	e.preventDefault();
	e.stopPropagation();

	const trackRect = trackRef.value.getBoundingClientRect();
	const clickX = e.clientX - trackRect.left;
	const trackW = trackRect.width;
	const scrollRange = scrollWidth.value - clientWidth.value;
	const targetScroll = (clickX / trackW) * scrollRange - (clientWidth.value / scrollWidth.value) * scrollRange * 0.5;
	container.scrollLeft = Math.max(0, Math.min(scrollRange, targetScroll));
}

let resizeObserver: ResizeObserver | null = null;
let contentResizeObserver: ResizeObserver | null = null;
let rafId: number | null = null;

function scheduleSync() {
	if (rafId !== null) return;
	rafId = requestAnimationFrame(() => {
		rafId = null;
		syncFromContainer();
	});
}

onMounted(() => {
	const el = props.scrollContainer;
	el.addEventListener("scroll", syncFromContainer, { passive: true });

	// Track container viewport size changes
	resizeObserver = new ResizeObserver(() => scheduleSync());
	resizeObserver.observe(el);

	// Track inner content size changes (zoom causes width changes on the first child)
	const contentChild = el.firstElementChild;
	if (contentChild) {
		contentResizeObserver = new ResizeObserver(() => scheduleSync());
		contentResizeObserver.observe(contentChild);
	}

	syncFromContainer();
});

onUnmounted(() => {
	props.scrollContainer?.removeEventListener("scroll", syncFromContainer);
	resizeObserver?.disconnect();
	contentResizeObserver?.disconnect();
	if (rafId !== null) cancelAnimationFrame(rafId);
	document.removeEventListener("mousemove", onMouseMove);
	document.removeEventListener("mouseup", onMouseUp);
});
</script>

<template>
	<div
		class="flex h-5 shrink-0 items-center border-t border-white/10 bg-[#18181b]"
	>
		<!-- Spacer matching track labels width -->
		<div class="shrink-0 border-r border-white/10" :style="{ width: `${trackLabelsWidth}px` }" />

		<!-- Scrollbar track -->
		<div
			ref="trackRef"
			class="relative mx-1 flex-1 h-2.5 rounded-full bg-white/10 cursor-pointer"
			@mousedown="onTrackClick"
		>
			<!-- Scrollbar thumb -->
			<div
				ref="thumbRef"
				class="absolute top-0 h-full rounded-full transition-colors duration-150"
				:class="[
					isDragging
						? 'bg-white/50'
						: 'bg-white/30 hover:bg-white/40',
				]"
				:style="{
					width: `${thumbWidth}px`,
					left: `${thumbLeft}px`,
					cursor: isDragging ? 'grabbing' : 'grab',
				}"
				@mousedown="onThumbMouseDown"
			/>
		</div>
	</div>
</template>
