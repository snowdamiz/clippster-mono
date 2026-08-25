<script setup lang="ts">
import { computed } from "vue";
import { getDropIndicatorGeometry } from "../../lib/timeline/drop-utils";
import { TIMELINE_CONSTANTS } from "../../constants/timeline-constants";
import type { TimelineTrack, DropTarget, ElementType } from "../../types/timeline";

const props = defineProps<{
	dropTarget: DropTarget | null;
	tracks: TimelineTrack[];
	isVisible: boolean;
	headerHeight?: number;
	dragElementType?: ElementType | null;
	zoomLevel?: number;
	scrollLeft?: number;
	scrollTop?: number;
	insertGapIndex?: number | null;
	insertGapSize?: number;
}>();

const DROP_COLORS: Record<string, string> = {
	video: '#3b82f6',
	image: '#3b82f6',
	audio: '#22c55e',
	text: '#f59e0b',
	sticker: '#ec4899',
	effect: '#a855f7',
};

const color = computed(() => {
	if (!props.dragElementType) return '#3b82f6';
	return DROP_COLORS[props.dragElementType] ?? '#3b82f6';
});

const geometry = computed(() => {
	if (!props.dropTarget) return null;
	return getDropIndicatorGeometry({
		dropTarget: props.dropTarget,
		tracks: props.tracks,
		insertGapIndex: props.insertGapIndex ?? null,
		insertGapSize: props.insertGapSize ?? 0,
	});
});

const shouldShow = computed(() => {
	if (!props.isVisible || !props.dropTarget || !geometry.value) return false;
	if (props.dropTarget.targetElementId) return false;
	if (props.dropTarget.isNewTrack) return false;
	return true;
});

const isNewTrack = computed(() => geometry.value?.isNewTrack ?? false);

const overlayTop = computed(() => {
	if (!geometry.value) return 0;
	return geometry.value.y + (props.headerHeight ?? 0) - (props.scrollTop ?? 0);
});

const newTrackLineStyle = computed(() => {
	if (!geometry.value) return {};
	const c = color.value;
	return {
		top: `${overlayTop.value}px`,
		height: '4px',
		transform: 'translateY(-50%)',
		backgroundColor: c,
		boxShadow: `0 0 8px ${c}80, 0 0 3px ${c}`,
	};
});

const lineX = computed(() => {
	if (!props.dropTarget) return 0;
	const zl = props.zoomLevel;
	if (zl == null || !Number.isFinite(zl) || zl <= 0) return 0;
	const px = props.dropTarget.xPosition * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zl;
	return px - (props.scrollLeft ?? 0);
});

const trackHighlightStyle = computed(() => {
	if (!geometry.value) return {};
	const c = color.value;
	return {
		top: `${overlayTop.value}px`,
		height: `${geometry.value.height}px`,
		boxShadow: `inset 0 0 0 1px ${c}66`,
		backgroundColor: c + '0d',
	};
});

const verticalLineStyle = computed(() => {
	if (!geometry.value) return {};
	const c = color.value;
	return {
		top: `${overlayTop.value}px`,
		height: `${geometry.value.height}px`,
		left: `${lineX.value}px`,
		backgroundColor: c,
		boxShadow: `0 0 6px ${c}, 0 0 2px ${c}`,
	};
});
</script>

<template>
	<template v-if="shouldShow">
		<div
			v-if="isNewTrack"
			class="pointer-events-none absolute right-0 left-0 z-50 rounded-full"
			:style="newTrackLineStyle"
		/>

		<template v-else>
			<div
				class="pointer-events-none absolute right-0 left-0 z-40 rounded-sm"
				:style="trackHighlightStyle"
			/>
			<div
				class="pointer-events-none absolute z-50 w-[2px] rounded-full"
				:style="verticalLineStyle"
			/>
		</template>
	</template>
</template>
