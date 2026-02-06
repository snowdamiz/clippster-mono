<script setup lang="ts">
import { computed, ref, toRef, watch } from "vue";
import { useEditor } from "../../composables/useEditor";
import { useTimelineElementResize } from "../../composables/timeline/element/useElementResize";
import { useElementSelection } from "../../composables/timeline/element/useElementSelection";
import type { SnapPoint } from "../../composables/timeline/useTimelineSnapping";
import { TIMELINE_CONSTANTS } from "../../constants/timeline-constants";
import {
	getTrackClasses,
	getTrackBorderColor,
	getTrackHeight,
	canElementHaveAudio,
	canElementBeHidden,
	hasMediaId,
} from "../../lib/timeline";
import { invokeAction } from "../../lib/actions";
import type {
	TimelineElement as TimelineElementType,
	TimelineTrack,
	ElementDragState,
} from "../../types/timeline";
import type { MediaAsset } from "../../types/assets";
import { mediaSupportsAudio } from "../../lib/media/media-utils";

const props = defineProps<{
	element: TimelineElementType;
	track: TimelineTrack;
	zoomLevel: number;
	isSelected: boolean;
	dragState: ElementDragState;
	snappingEnabled: boolean;
	rippleShifts?: Map<string, number>;
}>();

const emit = defineEmits<{
	(e: "snapPointChange", snapPoint: SnapPoint | null): void;
	(e: "resizeStateChange", params: { isResizing: boolean }): void;
	(e: "rippleShiftsChange", shifts: Map<string, number>): void;
	(e: "elementMouseDown", event: MouseEvent, element: TimelineElementType): void;
	(e: "elementClick", event: MouseEvent, element: TimelineElementType): void;
}>();

const { editor } = useEditor();
const { selectedElements } = useElementSelection();

const mediaAssets = computed(() => editor.media.getAssets());

const mediaAsset = computed<MediaAsset | null>(() => {
	const el = props.element;
	if (hasMediaId(el)) {
		return mediaAssets.value.find((a) => a.id === el.mediaId) ?? null;
	}
	return null;
});

const hasAudio = computed(() => mediaSupportsAudio({ media: mediaAsset.value }));

const snappingRef = computed(() => props.snappingEnabled);

const { handleResizeStart, resizing, currentStartTime, currentDuration, rippleShifts: localRippleShifts } =
	useTimelineElementResize({
		element: toRef(props, "element"),
		track: toRef(props, "track"),
		zoomLevel: toRef(props, "zoomLevel"),
		snappingEnabled: snappingRef,
		onSnapPointChange: (sp) => emit("snapPointChange", sp),
		onResizeStateChange: (p) => emit("resizeStateChange", p),
	});

watch(localRippleShifts, (shifts) => {
	emit("rippleShiftsChange", shifts);
}, { deep: true });

const isResizing = computed(() => resizing.value !== null);

const isBeingDragged = computed(() => props.dragState.elementId === props.element.id);
const dragOffsetY = computed(() =>
	isBeingDragged.value && props.dragState.isDragging
		? props.dragState.currentMouseY - props.dragState.startMouseY
		: 0,
);

const elementStartTime = computed(() => {
	if (isBeingDragged.value && props.dragState.isDragging) {
		return props.dragState.currentTime;
	}
	const shifted = props.rippleShifts?.get(props.element.id);
	if (shifted !== undefined) {
		return shifted;
	}
	return props.element.startTime;
});

const displayedStartTime = computed(() =>
	isResizing.value ? currentStartTime.value : elementStartTime.value,
);
const displayedDuration = computed(() =>
	isResizing.value ? currentDuration.value : props.element.duration,
);

const elementWidth = computed(
	() => displayedDuration.value * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * props.zoomLevel,
);
const elementLeft = computed(
	() => displayedStartTime.value * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * props.zoomLevel,
);

const isMuted = computed(
	() => canElementHaveAudio(props.element) && props.element.muted === true,
);

const isHidden = computed(
	() => canElementBeHidden(props.element) && props.element.hidden === true,
);

const trackHeight = computed(() => getTrackHeight({ type: props.track.type }));
const tileWidth = computed(() => trackHeight.value * (16 / 9));

const trackClasses = computed(() => getTrackClasses({ type: props.track.type }));
const borderColor = computed(() => getTrackBorderColor({ type: props.track.type }));

const imageUrl = computed(() => {
	if (!mediaAsset.value) return null;
	if (mediaAsset.value.type === "image") return mediaAsset.value.url;
	if (mediaAsset.value.type === "video" && mediaAsset.value.thumbnailUrl) return mediaAsset.value.thumbnailUrl;
	return null;
});

function onContextAction(action: string) {
	invokeAction(action as any);
}
</script>

<template>
	<div
		:class="['absolute top-0 h-full select-none', isBeingDragged ? 'z-30' : 'z-10']"
		:style="{
			left: `${elementLeft}px`,
			width: `${elementWidth}px`,
			transform: isBeingDragged && dragState.isDragging ? `translate3d(0, ${dragOffsetY}px, 0)` : undefined,
		}"
	>
		<!-- Element inner -->
		<div
			:class="[
				'relative h-full cursor-pointer overflow-hidden rounded-[0.5rem] border-2',
				trackClasses,
				isBeingDragged ? 'z-30' : 'z-10',
				isHidden ? 'opacity-50' : '',
			]"
			:style="{ borderColor: borderColor }"
		>
			<!-- Track name label -->
			<div class="pointer-events-none absolute top-0 left-1 z-20 truncate text-[10px] leading-[16px] font-medium text-white/70">
				{{ element.name }}
			</div>

			<button
				type="button"
				class="absolute inset-0 size-full cursor-pointer"
				@click="emit('elementClick', $event, element)"
				@mousedown="emit('elementMouseDown', $event, element)"
			>
				<div class="absolute inset-0 flex h-full items-center">
					<!-- Text element -->
					<div v-if="element.type === 'text'" class="size-full" />

					<!-- Sticker element -->
					<div v-else-if="element.type === 'sticker'" class="size-full" />

					<!-- Audio element -->
					<div v-else-if="element.type === 'audio'" class="size-full" />

					<!-- Video/Image with thumbnail -->
					<div v-else-if="imageUrl" class="absolute inset-0">
						<div :class="['absolute right-0 left-0', isSelected ? 'bg-primary' : 'bg-transparent']" style="top: 10%; bottom: 20%;">
							<div
								class="absolute inset-0"
								:style="{
									backgroundImage: `url(${imageUrl})`,
									backgroundRepeat: 'repeat-x',
									backgroundSize: `${tileWidth}px 100%`,
									backgroundPosition: 'left center',
									pointerEvents: 'none',
								}"
							/>
						</div>
					</div>

					<!-- Fallback -->
					<div v-else class="size-full" />
				</div>

				<!-- Muted/Hidden overlay -->
				<div
					v-if="(hasAudio ? isMuted : isHidden)"
					class="bg-opacity-50 pointer-events-none absolute inset-0 flex items-center justify-center bg-black"
				>
					<span class="text-white text-xs">{{ hasAudio ? '🔇' : '👁️‍🗨️' }}</span>
				</div>
			</button>

			<!-- Resize handles -->
			<template v-if="isSelected">
				<button
					type="button"
					class="bg-primary absolute top-0 bottom-0 left-0 z-50 flex w-[0.6rem] cursor-w-resize items-center justify-center"
					@mousedown="handleResizeStart({ e: $event, elementId: element.id, side: 'left' })"
					aria-label="Left resize handle"
				>
					<div class="bg-foreground h-[1.5rem] w-[0.2rem] rounded-full" />
				</button>
				<button
					type="button"
					class="bg-primary absolute top-0 bottom-0 right-0 z-50 flex w-[0.6rem] cursor-e-resize items-center justify-center"
					@mousedown="handleResizeStart({ e: $event, elementId: element.id, side: 'right' })"
					aria-label="Right resize handle"
				>
					<div class="bg-foreground h-[1.5rem] w-[0.2rem] rounded-full" />
				</button>
			</template>
		</div>
	</div>
</template>
