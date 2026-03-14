<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, toRef } from "vue";

const props = defineProps<{
	scrollContainer: HTMLDivElement | null;
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

const hasOverflow = computed(() => scrollWidth.value > clientWidth.value + 1);

const thumbWidth = computed(() => {
	const trackW = trackRef.value?.clientWidth ?? 0;
	if (trackW <= 0) return 0;
	if (scrollWidth.value <= 0 || clientWidth.value <= 0 || !hasOverflow.value) {
		return trackW;
	}

	const ratio = clientWidth.value / scrollWidth.value;
	return Math.max(40, ratio * trackW);
});

const thumbLeft = computed(() => {
	if (!hasOverflow.value) return 0;
	const trackW = trackRef.value?.clientWidth ?? 0;
	const maxThumbLeft = trackW - thumbWidth.value;
	const scrollRatio = scrollLeft.value / (scrollWidth.value - clientWidth.value);
	return scrollRatio * maxThumbLeft;
});

function syncFromContainer() {
	const el = props.scrollContainer;
	if (!el) return;
	scrollLeft.value = el.scrollLeft;
	scrollWidth.value = el.scrollWidth;
	clientWidth.value = el.clientWidth;
}

function onThumbMouseDown(e: MouseEvent) {
	if (!hasOverflow.value) return;
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
	if (e.target === thumbRef.value || !container || !trackRef.value || !hasOverflow.value) return;
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

function cleanupObservers() {
	resizeObserver?.disconnect();
	resizeObserver = null;
	contentResizeObserver?.disconnect();
	contentResizeObserver = null;
}

function setupObservers(el: HTMLDivElement) {
	cleanupObservers();

	el.addEventListener("scroll", syncFromContainer, { passive: true });

	resizeObserver = new ResizeObserver(() => scheduleSync());
	resizeObserver.observe(el);

	const contentChild = el.firstElementChild;
	if (contentChild) {
		contentResizeObserver = new ResizeObserver(() => scheduleSync());
		contentResizeObserver.observe(contentChild);
	}

	syncFromContainer();
}

// Watch for scrollContainer changes (e.g., when template ref is set after mount)
let currentEl: HTMLDivElement | null = null;
watch(toRef(props, "scrollContainer"), (el, oldEl) => {
	if (oldEl) {
		oldEl.removeEventListener("scroll", syncFromContainer);
	}
	if (el) {
		currentEl = el;
		setupObservers(el);
		return;
	}

	currentEl = null;
	scrollLeft.value = 0;
	scrollWidth.value = 0;
	clientWidth.value = 0;
}, { immediate: true });

onMounted(() => {
	if (props.scrollContainer && !currentEl) {
		setupObservers(props.scrollContainer);
		currentEl = props.scrollContainer;
	}
});

onUnmounted(() => {
	if (currentEl) {
		currentEl.removeEventListener("scroll", syncFromContainer);
	}
	cleanupObservers();
	if (rafId !== null) cancelAnimationFrame(rafId);
	document.removeEventListener("mousemove", onMouseMove);
	document.removeEventListener("mouseup", onMouseUp);
});
</script>

<template>
	<div
		class="flex h-5 shrink-0 items-center border-t border-white/10 bg-[#1e1e22]"
	>
		<!-- Spacer matching track labels width -->
		<div class="shrink-0 border-r border-white/10" :style="{ width: `${trackLabelsWidth}px` }" />

		<!-- Scrollbar track -->
		<div
			ref="trackRef"
			class="relative mx-1 h-2.5 flex-1 rounded-full bg-white/[0.08]"
			:class="hasOverflow ? 'cursor-pointer' : 'cursor-default'"
			@mousedown="onTrackClick"
		>
			<!-- Scrollbar thumb -->
			<div
				ref="thumbRef"
				class="absolute top-0 h-full rounded-full transition-colors duration-150"
				:class="[
					!hasOverflow
						? 'bg-white/20'
						: isDragging
						? 'bg-white/60'
						: 'bg-white/40 hover:bg-white/50',
				]"
				:style="{
					width: `${thumbWidth}px`,
					left: `${thumbLeft}px`,
					cursor: !hasOverflow ? 'default' : isDragging ? 'grabbing' : 'grab',
				}"
				@mousedown="onThumbMouseDown"
			/>
		</div>
	</div>
</template>
