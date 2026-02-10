<script setup lang="ts">
import { computed, ref, toRef, watch } from "vue";
import { useEditor } from "../../composables/useEditor";
import { useTimelineElementResize } from "../../composables/timeline/element/useElementResize";
import { useElementFade } from "../../composables/timeline/element/useElementFade";
import { useElementSelection } from "../../composables/timeline/element/useElementSelection";
import { useFilmstrip } from "../../composables/timeline/useFilmstrip";
import { useAudioWaveform } from "../../composables/timeline/useAudioWaveform";
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
	isEffectDropTarget?: boolean;
}>();

const emit = defineEmits<{
	(e: "snapPointChange", snapPoint: SnapPoint | null): void;
	(e: "resizeStateChange", params: { isResizing: boolean }): void;
	(e: "rippleShiftsChange", shifts: Map<string, number>): void;
	(e: "elementMouseDown", event: MouseEvent, element: TimelineElementType): void;
	(e: "elementClick", event: MouseEvent, element: TimelineElementType): void;
	(e: "elementContextMenu", event: MouseEvent, element: TimelineElementType): void;
	(e: "keyframeClick", payload: { elementId: string; offset: number; rect: DOMRect }): void;
}>();

const { editor, version } = useEditor();
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

const { handleResizeStart, resizing, currentTrimStart, currentStartTime, currentDuration, rippleShifts: localRippleShifts } =
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

// During resize, the inner content keeps its ORIGINAL width so the filmstrip/waveform
// stays at the correct scale. The container clips the excess via overflow:hidden.
// For left-edge resize, the content also shifts left to reveal the new trim point.
const contentOffsetPx = computed(() => {
	const rs = resizing.value;
	if (!rs || rs.side !== 'left') return 0;
	const trimDelta = currentTrimStart.value - rs.initialTrimStart;
	return -(trimDelta * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * props.zoomLevel);
});
const contentWidthPx = computed(() => {
	const rs = resizing.value;
	if (!rs) return null; // null = use default 100%
	return rs.initialDuration * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * props.zoomLevel;
});

const isBeingDragged = computed(() => props.dragState.elementId === props.element.id);

// Check if this element is a selected sibling during a multi-element drag
// (not the dragged element itself, but selected on the same track)
const isSelectedSiblingDrag = computed(() => {
	if (!props.dragState.isDragging || isBeingDragged.value) return false;
	if (props.dragState.trackId !== props.track.id) return false;
	if (!props.isSelected) return false;
	// Confirm multiple elements on this track are selected
	const sameTrackCount = selectedElements.value.filter(
		(sel) => sel.trackId === props.track.id,
	).length;
	return sameTrackCount > 1;
});

const dragOffsetY = computed(() =>
	isBeingDragged.value && props.dragState.isDragging
		? props.dragState.currentMouseY - props.dragState.startMouseY
		: 0,
);

const elementStartTime = computed(() => {
	if (isBeingDragged.value && props.dragState.isDragging) {
		return props.dragState.currentTime;
	}
	// Multi-element drag: shift selected siblings by the same time delta
	if (isSelectedSiblingDrag.value) {
		const timeDelta = props.dragState.currentTime - props.dragState.startElementTime;
		return Math.max(0, props.element.startTime + timeDelta);
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

const isVideoElement = computed(() => props.element.type === "video");

const { frames: filmstripFrames, thumbnailWidth: filmstripThumbWidth } = useFilmstrip({
	element: toRef(props, "element"),
	mediaAsset,
	zoomLevel: toRef(props, "zoomLevel"),
	elementWidth,
});

const hasFilmstrip = computed(() => isVideoElement.value && filmstripFrames.value.length > 0);

// Audio waveform support (for audio elements)
const isAudioElement = computed(() => props.element.type === "audio");
const audioWaveformCanvas = ref<HTMLCanvasElement | null>(null);

// Video waveform support (audio track rendered under filmstrip)
const videoWaveformCanvas = ref<HTMLCanvasElement | null>(null);

const playheadTime = computed(() => {
	void version.value;
	return editor.playback.getCurrentTime();
});

const { isLoading: waveformLoading, isLoaded: waveformLoaded } = useAudioWaveform({
	element: toRef(props, "element"),
	mediaAsset,
	zoomLevel: toRef(props, "zoomLevel"),
	elementWidth,
	canvasRef: computed(() => {
		// Route to the correct canvas based on element type
		if (props.element.type === "audio") return audioWaveformCanvas.value;
		if (props.element.type === "video") return videoWaveformCanvas.value;
		return null;
	}),
	currentTime: playheadTime,
});

const { fadeState, currentFadeIn, currentFadeOut, handleFadeStart } = useElementFade({
	element: toRef(props, "element"),
	track: toRef(props, "track"),
	zoomLevel: toRef(props, "zoomLevel"),
});

const isFading = computed(() => fadeState.value !== null);

const fadeInPx = computed(() => {
	const fade = isFading.value ? currentFadeIn.value : (props.element.fadeIn ?? 0);
	return fade * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * props.zoomLevel;
});

const fadeOutPx = computed(() => {
	const fade = isFading.value ? currentFadeOut.value : (props.element.fadeOut ?? 0);
	return fade * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * props.zoomLevel;
});

// Keyframe diamond markers: collect all keyframe offsets from all property tracks
const keyframeDiamonds = computed(() => {
	const kf = props.element.keyframes;
	if (!kf) return [];
	const offsets = new Set<number>();
	for (const track of Object.values(kf.tracks)) {
		if (!track) continue;
		for (const k of track.keyframes) {
			offsets.add(k.offset);
		}
	}
	return Array.from(offsets).sort((a, b) => a - b).map((offset) => ({
		offset,
		leftPx: offset * elementWidth.value,
	}));
});

function handleKeyframeClick(ev: MouseEvent, offset: number) {
	ev.stopPropagation();
	const target = ev.currentTarget as HTMLElement;
	const rect = target.getBoundingClientRect();
	emit('keyframeClick', { elementId: props.element.id, offset, rect });
}

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
			<!-- Track name label (sits in the top blue bar, not over content) -->
			<div class="pointer-events-none absolute top-0 left-1 right-0 z-30 h-[16px] flex items-center">
				<span class="truncate text-[10px] leading-none font-medium text-white/90">{{ element.name }}</span>
			</div>

			<button
				type="button"
				class="absolute inset-0 size-full cursor-pointer"
				@click="emit('elementClick', $event, element)"
				@mousedown="emit('elementMouseDown', $event, element)"
				@contextmenu.prevent="emit('elementContextMenu', $event, element)"
			>
				<div
					class="absolute inset-0 flex h-full items-center"
					:style="{
						width: contentWidthPx !== null ? `${contentWidthPx}px` : '100%',
						transform: contentOffsetPx !== 0 ? `translateX(${contentOffsetPx}px)` : undefined,
					}"
				>
					<!-- Text element -->
					<div v-if="element.type === 'text'" class="size-full" />

					<!-- Sticker element -->
					<div v-else-if="element.type === 'sticker'" class="size-full" />

					<!-- Audio element with waveform -->
					<div v-else-if="element.type === 'audio'" class="relative w-full h-full">
						<canvas
							ref="audioWaveformCanvas"
							class="absolute left-0 right-0 w-full pointer-events-none"
							style="top: 16px; height: calc(100% - 16px); mix-blend-mode: normal; z-index: 5"
						/>
						<div
							v-if="waveformLoading"
							class="absolute inset-0 flex items-center justify-center"
						>
							<div class="text-[9px] text-white/40">Loading...</div>
						</div>
					</div>

					<!-- Video filmstrip (actual frames at correct timestamps) -->
					<div v-else-if="hasFilmstrip" class="absolute inset-0">
						<!-- Filmstrip area: below the 16px title bar, above the waveform -->
						<div :class="['absolute right-0 left-0', isSelected ? 'bg-primary' : 'bg-transparent']" style="top: 16px; bottom: 35%;">
							<div class="absolute inset-0 flex pointer-events-none">
								<div
									v-for="frame in filmstripFrames"
									:key="frame.timestamp"
									class="h-full flex-shrink-0"
									:style="{
										width: `${filmstripThumbWidth}px`,
										backgroundImage: `url(${frame.objectUrl})`,
										backgroundSize: 'cover',
										backgroundPosition: 'center',
									}"
								/>
							</div>
						</div>
						<!-- Audio waveform: fills the entire bottom section (hidden when muted/audio extracted) -->
						<canvas
							v-if="!isMuted"
							ref="videoWaveformCanvas"
							class="absolute right-0 left-0 w-full pointer-events-none"
							style="bottom: 0; height: 35%; z-index: 25; mix-blend-mode: normal;"
						/>
					</div>

					<!-- Video/Image fallback thumbnail (before filmstrip loads) -->
					<div v-else-if="imageUrl" class="absolute inset-0">
						<div :class="['absolute right-0 left-0', isSelected ? 'bg-primary' : 'bg-transparent']" style="top: 16px; bottom: 35%;">
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
						<!-- Audio waveform: fills the entire bottom section (hidden when muted/audio extracted) -->
						<canvas
							v-if="isVideoElement && !isMuted"
							ref="videoWaveformCanvas"
							class="absolute right-0 left-0 w-full pointer-events-none"
							style="bottom: 0; height: 35%; z-index: 25; mix-blend-mode: normal;"
						/>
					</div>

					<!-- Fallback -->
					<div v-else class="size-full" />
				</div>

				<!-- Hidden overlay -->
				<div
					v-if="isHidden"
					class="bg-opacity-50 pointer-events-none absolute inset-0 flex items-center justify-center bg-black"
				>
					<span class="text-white text-xs">👁️‍🗨️</span>
				</div>

				<!-- Effect drop target highlight -->
				<div
					v-if="isEffectDropTarget"
					class="pointer-events-none absolute inset-0 z-40 rounded-[0.4rem] border-2 border-[#E040FB] bg-[#E040FB]/15"
				/>
			</button>

			<!-- Fade-in gradient overlay -->
			<div
				v-if="fadeInPx > 0"
				class="pointer-events-none absolute top-0 bottom-0 left-0 z-20"
				:style="{ width: `${fadeInPx}px`, background: 'linear-gradient(to right, rgba(0,0,0,0.5), transparent)' }"
			/>
			<!-- Fade-out gradient overlay -->
			<div
				v-if="fadeOutPx > 0"
				class="pointer-events-none absolute top-0 bottom-0 right-0 z-20"
				:style="{ width: `${fadeOutPx}px`, background: 'linear-gradient(to left, rgba(0,0,0,0.5), transparent)' }"
			/>

			<!-- Fade-in triangle handle (bottom-left) -->
			<div
				v-if="isSelected || fadeInPx > 0"
				class="absolute bottom-0 z-40 cursor-ew-resize group/fade"
				:style="{ left: `${fadeInPx}px` }"
				@mousedown="handleFadeStart($event, 'fadeIn')"
			>
				<svg width="8" height="8" viewBox="0 0 8 8" class="opacity-60 group-hover/fade:opacity-100 transition-opacity">
					<polygon points="0,8 8,8 0,0" fill="white" />
				</svg>
			</div>

			<!-- Fade-out triangle handle (bottom-right) -->
			<div
				v-if="isSelected || fadeOutPx > 0"
				class="absolute bottom-0 z-40 cursor-ew-resize group/fade"
				:style="{ right: `${fadeOutPx}px` }"
				@mousedown="handleFadeStart($event, 'fadeOut')"
			>
				<svg width="8" height="8" viewBox="0 0 8 8" class="opacity-60 group-hover/fade:opacity-100 transition-opacity">
					<polygon points="0,8 8,8 8,0" fill="white" />
				</svg>
			</div>

			<!-- Keyframe diamond markers -->
			<button
				v-for="kd in keyframeDiamonds"
				:key="kd.offset"
				type="button"
				class="pointer-events-auto absolute z-30 flex items-center justify-center rounded-sm transition-transform hover:scale-125"
				:style="{ left: `${kd.leftPx - 6}px`, top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px' }"
				@click="handleKeyframeClick($event, kd.offset)"
			>
				<svg width="12" height="12" viewBox="0 0 12 12">
					<polygon points="6,0 12,6 6,12 0,6" fill="#facc15" fill-opacity="0.9" stroke="#a16207" stroke-width="0.5" />
				</svg>
			</button>

			<!-- Resize handles -->
			<template v-if="isSelected">
				<button
					type="button"
					class="bg-primary/70 absolute top-0 bottom-0 left-0 z-50 flex w-[4px] cursor-w-resize items-center justify-center"
					@mousedown="handleResizeStart({ e: $event, elementId: element.id, side: 'left' })"
					aria-label="Left resize handle"
				>
					<div class="bg-foreground/80 h-[12px] w-[2px] rounded-full" />
				</button>
				<button
					type="button"
					class="bg-primary/70 absolute top-0 bottom-0 right-0 z-50 flex w-[4px] cursor-e-resize items-center justify-center"
					@mousedown="handleResizeStart({ e: $event, elementId: element.id, side: 'right' })"
					aria-label="Right resize handle"
				>
					<div class="bg-foreground/80 h-[12px] w-[2px] rounded-full" />
				</button>
			</template>
		</div>
	</div>
</template>
