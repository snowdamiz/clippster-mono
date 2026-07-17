<script setup lang="ts">
import { computed, ref, shallowRef, toRef, watch, onMounted, onUnmounted } from "vue";
import { useEditor } from "../../composables/useEditor";
import { useTimelineElementResize } from "../../composables/timeline/element/useElementResize";
import { useElementFade } from "../../composables/timeline/element/useElementFade";
import { useVolumeEnvelope } from "../../composables/timeline/element/useVolumeEnvelope";
import { useElementGeometry } from "../../composables/timeline/element/useElementGeometry";
import { useFilmstrip } from "../../composables/timeline/useFilmstrip";
import { useAudioWaveform } from "../../composables/timeline/useAudioWaveform";
import type { SnapPoint } from "../../composables/timeline/useTimelineSnapping";
import { TIMELINE_CONSTANTS, VIDEO_TIMELINE_WAVEFORM_HEIGHT_PCT } from "../../constants/timeline-constants";
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
	VideoElement,
} from "../../types/timeline";
import { useEditorUIState, isVisualPlacementProperty } from "../../composables/useEditorUIState";
import { useKeyframes } from "../../composables/useKeyframes";
import {
	getKeyframePropertyStaticDefault,
	getValueForNewKeyframeAtOffset,
} from "../../lib/keyframe-property-defaults";
import type { KeyframableProperty } from "../../types/keyframes";
import type { MediaAsset } from "../../types/assets";
import { mediaSupportsAudio } from "../../lib/media/media-utils";

const props = defineProps<{
	element: TimelineElementType;
	track: TimelineTrack;
	zoomLevel: number;
	isSelected: boolean;
	snappingEnabled: boolean;
	rippleShifts?: Map<string, number>;
	isEffectDropTarget?: boolean;
	isPlayheadScrubbing?: boolean;
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

const { editor, version } = useEditor({
	subscribe: {
		playback: false,
		timeline: true,
		scenes: true,
		project: false,
		media: true,
		selection: false,
	},
});
// Selection state is provided to TimelineElement via the `:is-selected` prop
// from the parent track. The drag DOM controller owns the visual sibling-follow
// during multi-select drags, so this component does not subscribe to the
// selection store at all (selection clicks no longer re-render every clip).
const { timelineKeyframePlacementActive, timelineKeyframePlacementProperty } = useEditorUIState();

const trackRefForKeyframes = toRef(() => props.track);
const elementRefForKeyframes = toRef(() => props.element);
const { addKeyframe } = useKeyframes({
	trackRef: trackRefForKeyframes,
	elementRef: elementRefForKeyframes,
});

function onVisualKeyframePaintPointerDown(ev: PointerEvent) {
	if (!timelineKeyframePlacementActive.value) return;
	if (!props.isSelected) return;
	const el = props.element;
	if (el.type !== "video" && el.type !== "image") return;
	const property = timelineKeyframePlacementProperty.value;
	if (!isVisualPlacementProperty(property)) return;
	ev.stopPropagation();
	const target = ev.currentTarget as HTMLElement;
	const rect = target.getBoundingClientRect();
	const localX = ev.clientX - rect.left;
	const offset = Math.max(0, Math.min(1, localX / Math.max(1, rect.width)));
	const staticDefault = getKeyframePropertyStaticDefault(el, property);
	const value = getValueForNewKeyframeAtOffset({
		elementKeyframes: el.keyframes,
		property,
		offset,
		staticDefault,
	});
	addKeyframe(property, offset, value);
}

const mediaAssets = computed(() => {
	void version.value;
	return editor.media.getAssets();
});

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

// `localRippleShifts` is a `shallowRef` of `Map<string, number>` produced by
// the resize composable; it only emits a fresh Map when the shift set actually
// changes. A non-deep watch is sufficient and avoids per-key tracking cost.
watch(localRippleShifts, (shifts) => {
	emit("rippleShiftsChange", shifts);
});

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

// Geometry: position derives only from committed `element.startTime` and
// (during resize) the resize composable's preview values. While dragging,
// the GPU drag visual layer translates the element via `--drag-x` / `--drag-y`
// CSS custom properties — Vue does not re-render this element each frame.
const resizeOverride = computed(() => {
	if (!isResizing.value) return null;
	return { startTime: currentStartTime.value, duration: currentDuration.value };
});
const rippleShiftsRef = computed(() => props.rippleShifts);
const { left: elementLeft, width: elementWidth } = useElementGeometry({
	element: toRef(props, "element"),
	zoomLevel: toRef(props, "zoomLevel"),
	rippleShifts: rippleShiftsRef,
	resizeOverride,
});

const isMuted = computed(
	() => canElementHaveAudio(props.element) && props.element.muted === true,
);

const isHidden = computed(
	() => canElementBeHidden(props.element) && props.element.hidden === true,
);

const trackHeight = computed(() => getTrackHeight({ type: props.track.type }));
const isImageElement = computed(() => props.element.type === "image");
const tileWidth = computed(() => {
	if (isImageElement.value && mediaAsset.value?.width && mediaAsset.value?.height) {
		return trackHeight.value * (mediaAsset.value.width / mediaAsset.value.height);
	}
	return trackHeight.value * (16 / 9);
});

/** When the clip is narrower than one tile (zoomed out), use cover instead of repeat-x. */
const imageBackgroundStyle = computed(() => {
	const tw = tileWidth.value;
	const ew = elementWidth.value;
	if (ew < tw - 0.5) {
		return {
			backgroundImage: imageUrl.value ? `url(${imageUrl.value})` : undefined,
			backgroundRepeat: "no-repeat",
			backgroundSize: "cover",
			backgroundPosition: "center center",
			pointerEvents: "none" as const,
		};
	}
	return {
		backgroundImage: imageUrl.value ? `url(${imageUrl.value})` : undefined,
		backgroundRepeat: "repeat-x",
		backgroundSize: `${tw}px 100%`,
		backgroundPosition: "left center",
		pointerEvents: "none" as const,
	};
});

const trackClasses = computed(() => getTrackClasses({ type: props.track.type }));
const borderColor = computed(() => getTrackBorderColor({ type: props.track.type }));

const imageUrl = computed(() => {
	if (!mediaAsset.value) return null;
	if (mediaAsset.value.type === "image") return mediaAsset.value.url;
	if (mediaAsset.value.type === "video" && mediaAsset.value.thumbnailUrl) return mediaAsset.value.thumbnailUrl;
	return null;
});

const isVideoElement = computed(() => props.element.type === "video");

const { frames: filmstripFrames } = useFilmstrip({
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

const playheadTime = shallowRef(editor.playback.getCurrentTime());

function syncPlayheadTime(time?: number) {
	if (props.isPlayheadScrubbing) return;
	playheadTime.value = time ?? editor.playback.getCurrentTime();
}

function handlePlaybackEvent(event: Event) {
	syncPlayheadTime((event as CustomEvent<{ time?: number }>).detail?.time);
}

watch(
	() => props.isPlayheadScrubbing,
	(scrubbing) => {
		if (!scrubbing) {
			playheadTime.value = editor.playback.getCurrentTime();
		}
	},
);

onMounted(() => {
	if (!isAudioElement.value && !isVideoElement.value) return;
	window.addEventListener("playback-update", handlePlaybackEvent as EventListener);
	window.addEventListener("playback-seek", handlePlaybackEvent as EventListener);
});

onUnmounted(() => {
	if (!isAudioElement.value && !isVideoElement.value) return;
	window.removeEventListener("playback-update", handlePlaybackEvent as EventListener);
	window.removeEventListener("playback-seek", handlePlaybackEvent as EventListener);
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

const audioSvgRef = ref<SVGSVGElement | null>(null);
const videoWaveformSvgRef = ref<SVGSVGElement | null>(null);

const {
	isVisible: volumeEnvelopeVisible,
	handles: volumeHandles,
	isDragging: volumeIsDragging,
	showEnvelopeGraphics: volumeShowEnvelopeGraphics,
	onStripPointerEnter: onVolumeStripPointerEnter,
	onStripPointerLeave: onVolumeStripPointerLeave,
	onStripPointerDown: onVolumeStripPointerDownRaw,
	onHandleDblClick: onVolumeHandleDblClick,
} = useVolumeEnvelope({
	elementRef: toRef(props, "element"),
	trackRef: toRef(props, "track"),
	elementWidthPx: elementWidth,
	placementProperty: timelineKeyframePlacementProperty,
});

function onVolumeStripPointerDown(ev: PointerEvent, svg: SVGSVGElement, h: number) {
	if (timelineKeyframePlacementActive.value && !props.isSelected) return;
	onVolumeStripPointerDownRaw(ev, svg, h);
}

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
	void version.value;
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

function formatSec(s: number): string {
	const m = Math.floor(s / 60);
	const sec = (s % 60).toFixed(2);
	return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

const elementTooltip = computed(() => {
	const el = props.element;
	return `${el.name}\nDuration: ${formatSec(el.duration)}\nStart: ${formatSec(el.startTime)}`;
});
</script>

<template>
	<div
		:data-element-id="element.id"
		data-timeline-element-root="1"
		class="timeline-element absolute top-0 h-full select-none z-10"
		:class="[
			(isVideoElement || isAudioElement || isImageElement) && timelineKeyframePlacementActive && 'cursor-crosshair',
		]"
		:style="{
			left: `${elementLeft}px`,
			width: `${elementWidth}px`,
		}"
		:title="elementTooltip"
	>
		<!-- Element inner -->
		<div
			:class="[
				'group relative h-full overflow-hidden border-2 z-10',
				(isVideoElement || isAudioElement || isImageElement) && timelineKeyframePlacementActive ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing',
				(track.type === 'text' || track.type === 'audio' || track.type === 'sticker' || track.type === 'caption' || track.type === 'effect') ? 'rounded-[3px]' : 'rounded-[0.5rem]',
				trackClasses,
				isHidden ? 'opacity-50' : '',
			]"
			:style="{
				borderColor: borderColor,
				boxShadow: isSelected ? 'inset 0 0 0 1.5px rgba(14, 165, 233, 0.6)' : 'none',
			}"
		>
			<!-- Track name label (sits in the top blue bar, not over content) -->
			<div
				class="pointer-events-none absolute top-0 left-1 right-0 z-30 h-[16px] flex items-center justify-between transition-opacity duration-150"
				:class="track.type === 'audio' ? 'group-hover:opacity-0' : ''"
			>
				<span class="truncate text-[10px] leading-none font-medium text-white/90">{{ element.name }}</span>
				<!-- Layer indicator badge -->
				<span
					v-if="element.orderIndex !== undefined && element.orderIndex > 0"
					class="ml-1 mr-1 flex-shrink-0 rounded bg-white/20 px-1 py-0.5 text-[8px] leading-none font-bold text-white/90"
					:title="`Layer ${element.orderIndex}`"
				>
					L{{ element.orderIndex }}
				</span>
			</div>

			<button
				type="button"
				class="absolute inset-0 size-full"
				:class="(isVideoElement || isAudioElement) && timelineKeyframePlacementActive ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'"
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
						class="absolute inset-0 w-full h-full pointer-events-none"
						style="mix-blend-mode: normal; z-index: 5; image-rendering: crisp-edges"
					/>
					<!-- Volume keyframe strip (handles only — no curve on waveform) -->
					<svg
						v-if="volumeEnvelopeVisible"
						ref="audioSvgRef"
						class="absolute inset-0 w-full h-full overflow-visible"
						style="z-index: 10; top: 16px; height: calc(100% - 16px);"
						viewBox="0 0 100 100"
						preserveAspectRatio="none"
						:class="[
							!timelineKeyframePlacementActive && 'pointer-events-none',
							volumeIsDragging ? 'cursor-ns-resize' : timelineKeyframePlacementActive && timelineKeyframePlacementProperty === 'volume' ? 'cursor-crosshair' : '',
						]"
						@pointerenter="onVolumeStripPointerEnter"
						@pointerleave="onVolumeStripPointerLeave"
						@pointerdown.stop="(e) => audioSvgRef && onVolumeStripPointerDown(e, audioSvgRef, 0)"
					>
						<g v-if="volumeShowEnvelopeGraphics">
							<circle
								v-for="h in volumeHandles"
								:key="h.id"
								:cx="h.x"
								:cy="h.y"
								r="4"
								fill="#facc15"
								stroke="#a16207"
								stroke-width="1"
								vector-effect="non-scaling-stroke"
								style="cursor: ns-resize; pointer-events: all"
								@dblclick.stop="(e) => onVolumeHandleDblClick(e as any, h.id)"
							/>
						</g>
					</svg>
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
						<div
							:class="['absolute right-0 left-0', isSelected ? 'bg-primary' : 'bg-transparent']"
							:style="{ top: '16px', bottom: `${VIDEO_TIMELINE_WAVEFORM_HEIGHT_PCT}%` }"
						>
							<div
								class="absolute inset-0 grid pointer-events-none h-full"
								:style="{
									gridTemplateColumns: filmstripFrames.length
										? `repeat(${filmstripFrames.length}, minmax(0, 1fr))`
										: undefined,
								}"
							>
								<div
									v-for="(frame, idx) in filmstripFrames"
									:key="`${frame.timestamp}-${idx}`"
									class="min-h-0 min-w-0 h-full"
									:style="{
										backgroundImage: `url(${frame.objectUrl})`,
										backgroundSize: 'cover',
										backgroundPosition: 'center',
									}"
								/>
							</div>
						</div>
						<div
							v-if="(isVideoElement || isImageElement) && timelineKeyframePlacementActive && isVisualPlacementProperty(timelineKeyframePlacementProperty)"
							class="absolute right-0 left-0 z-[27] cursor-crosshair"
							:style="{
								top: '16px',
								bottom: isVideoElement && !isMuted ? `${VIDEO_TIMELINE_WAVEFORM_HEIGHT_PCT}%` : '0',
							}"
							@pointerdown.stop="onVisualKeyframePaintPointerDown"
						/>
					<!-- Audio waveform: fills the entire bottom section (hidden when muted/audio extracted) -->
					<canvas
						v-if="!isMuted"
						ref="videoWaveformCanvas"
						class="absolute right-0 left-0 w-full pointer-events-none"
						:style="{
							bottom: 0,
							height: `${VIDEO_TIMELINE_WAVEFORM_HEIGHT_PCT}%`,
							zIndex: 25,
							mixBlendMode: 'normal',
							imageRendering: 'crisp-edges',
						}"
					/>
					<!-- Volume keyframe strip (video waveform — handles only) -->
					<svg
						v-if="!isMuted && volumeEnvelopeVisible"
						ref="videoWaveformSvgRef"
						class="absolute right-0 left-0 w-full overflow-visible"
						viewBox="0 0 100 100"
						preserveAspectRatio="none"
						:style="{
							bottom: 0,
							height: `${VIDEO_TIMELINE_WAVEFORM_HEIGHT_PCT}%`,
							zIndex: 30,
						}"
						:class="[
							!timelineKeyframePlacementActive && 'pointer-events-none',
							volumeIsDragging ? 'cursor-ns-resize' : timelineKeyframePlacementActive && timelineKeyframePlacementProperty === 'volume' ? 'cursor-crosshair' : '',
						]"
						@pointerenter="onVolumeStripPointerEnter"
						@pointerleave="onVolumeStripPointerLeave"
						@pointerdown.stop="(e) => videoWaveformSvgRef && onVolumeStripPointerDown(e, videoWaveformSvgRef, 0)"
					>
						<g v-if="volumeShowEnvelopeGraphics">
							<circle
								v-for="h in volumeHandles"
								:key="h.id"
								:cx="h.x" :cy="h.y" r="4"
								fill="#facc15" stroke="#a16207" stroke-width="1"
								vector-effect="non-scaling-stroke"
								style="cursor: ns-resize; pointer-events: all"
								@dblclick.stop="(e) => onVolumeHandleDblClick(e as any, h.id)"
							/>
						</g>
					</svg>
					<div
						v-if="!isMuted && waveformLoading && !waveformLoaded"
						class="absolute right-0 left-0 flex items-center justify-center pointer-events-none"
						:style="{ bottom: 0, height: `${VIDEO_TIMELINE_WAVEFORM_HEIGHT_PCT}%`, zIndex: 26 }"
					>
						<div class="text-[8px] text-white/30">Loading waveform...</div>
					</div>
				</div>

				<!-- Video/Image fallback thumbnail (before filmstrip loads) -->
				<div v-else-if="imageUrl" class="absolute inset-0">
					<div
						:class="['absolute right-0 left-0', isSelected ? 'bg-primary' : 'bg-transparent']"
						:style="{ top: '16px', bottom: `${VIDEO_TIMELINE_WAVEFORM_HEIGHT_PCT}%` }"
					>
						<div
							class="absolute inset-0"
							:style="imageBackgroundStyle"
						/>
					</div>
						<div
							v-if="(isVideoElement || isImageElement) && timelineKeyframePlacementActive && isVisualPlacementProperty(timelineKeyframePlacementProperty)"
							class="absolute right-0 left-0 z-[27] cursor-crosshair"
							:style="{
								top: '16px',
								bottom: isVideoElement && !isMuted ? `${VIDEO_TIMELINE_WAVEFORM_HEIGHT_PCT}%` : '0',
							}"
							@pointerdown.stop="onVisualKeyframePaintPointerDown"
						/>
					<!-- Audio waveform: fills the entire bottom section (hidden when muted/audio extracted) -->
					<canvas
						v-if="isVideoElement && !isMuted"
						ref="videoWaveformCanvas"
						class="absolute right-0 left-0 w-full pointer-events-none"
						:style="{
							bottom: 0,
							height: `${VIDEO_TIMELINE_WAVEFORM_HEIGHT_PCT}%`,
							zIndex: 25,
							mixBlendMode: 'normal',
							imageRendering: 'crisp-edges',
						}"
					/>
					<!-- Volume keyframe strip (video fallback — handles only) -->
					<svg
						v-if="isVideoElement && !isMuted && volumeEnvelopeVisible"
						ref="videoWaveformSvgRef"
						class="absolute right-0 left-0 w-full overflow-visible"
						viewBox="0 0 100 100"
						preserveAspectRatio="none"
						:style="{
							bottom: 0,
							height: `${VIDEO_TIMELINE_WAVEFORM_HEIGHT_PCT}%`,
							zIndex: 30,
						}"
						:class="[
							!timelineKeyframePlacementActive && 'pointer-events-none',
							volumeIsDragging ? 'cursor-ns-resize' : timelineKeyframePlacementActive && timelineKeyframePlacementProperty === 'volume' ? 'cursor-crosshair' : '',
						]"
						@pointerenter="onVolumeStripPointerEnter"
						@pointerleave="onVolumeStripPointerLeave"
						@pointerdown.stop="(e) => videoWaveformSvgRef && onVolumeStripPointerDown(e, videoWaveformSvgRef, 0)"
					>
						<g v-if="volumeShowEnvelopeGraphics">
							<circle
								v-for="h in volumeHandles"
								:key="h.id"
								:cx="h.x" :cy="h.y" r="4"
								fill="#facc15" stroke="#a16207" stroke-width="1"
								vector-effect="non-scaling-stroke"
								style="cursor: ns-resize; pointer-events: all"
								@dblclick.stop="(e) => onVolumeHandleDblClick(e as any, h.id)"
							/>
						</g>
					</svg>
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

			<!-- Fade-in overlay: diagonal ramp for audio/video, gradient for others -->
			<div
				v-if="fadeInPx > 0"
				class="pointer-events-none absolute top-0 bottom-0 left-0 z-20"
				:style="{ width: `${fadeInPx}px` }"
			>
				<svg v-if="isAudioElement || isVideoElement" class="size-full" preserveAspectRatio="none">
					<line x1="0" y1="100%" x2="100%" y2="0" stroke="white" stroke-opacity="0.5" stroke-width="1.5" vector-effect="non-scaling-stroke" />
				</svg>
				<div v-else class="size-full" :style="{ background: 'linear-gradient(to right, rgba(0,0,0,0.5), transparent)' }" />
			</div>
			<!-- Fade-out overlay: diagonal ramp for audio/video, gradient for others -->
			<div
				v-if="fadeOutPx > 0"
				class="pointer-events-none absolute top-0 bottom-0 right-0 z-20"
				:style="{ width: `${fadeOutPx}px` }"
			>
				<svg v-if="isAudioElement || isVideoElement" class="size-full" preserveAspectRatio="none">
					<line x1="0" y1="0" x2="100%" y2="100%" stroke="white" stroke-opacity="0.5" stroke-width="1.5" vector-effect="non-scaling-stroke" />
				</svg>
				<div v-else class="size-full" :style="{ background: 'linear-gradient(to left, rgba(0,0,0,0.5), transparent)' }" />
			</div>

			<!-- Fade-in triangle handle (bottom-left) -->
			<div
				v-if="isSelected || isAudioElement || isVideoElement || fadeInPx > 0"
				class="absolute bottom-0 z-40 cursor-ew-resize group/fade"
				:style="{ left: `${fadeInPx}px` }"
				@mousedown="handleFadeStart($event, 'fadeIn')"
			>
				<svg
					:width="(isAudioElement || isVideoElement) ? 12 : 8"
					:height="(isAudioElement || isVideoElement) ? 12 : 8"
					:viewBox="(isAudioElement || isVideoElement) ? '0 0 12 12' : '0 0 8 8'"
					:class="(isAudioElement || isVideoElement) ? 'opacity-70 group-hover/fade:opacity-100 transition-opacity' : 'opacity-60 group-hover/fade:opacity-100 transition-opacity'"
				>
					<polygon :points="(isAudioElement || isVideoElement) ? '0,12 12,12 0,0' : '0,8 8,8 0,0'" fill="white" />
				</svg>
			</div>

			<!-- Fade-out triangle handle (bottom-right) -->
			<div
				v-if="isSelected || isAudioElement || isVideoElement || fadeOutPx > 0"
				class="absolute bottom-0 z-40 cursor-ew-resize group/fade"
				:style="{ right: `${fadeOutPx}px` }"
				@mousedown="handleFadeStart($event, 'fadeOut')"
			>
				<svg
					:width="(isAudioElement || isVideoElement) ? 12 : 8"
					:height="(isAudioElement || isVideoElement) ? 12 : 8"
					:viewBox="(isAudioElement || isVideoElement) ? '0 0 12 12' : '0 0 8 8'"
					:class="(isAudioElement || isVideoElement) ? 'opacity-70 group-hover/fade:opacity-100 transition-opacity' : 'opacity-60 group-hover/fade:opacity-100 transition-opacity'"
				>
					<polygon :points="(isAudioElement || isVideoElement) ? '0,12 12,12 12,0' : '0,8 8,8 8,0'" fill="white" />
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
					class="absolute top-0 bottom-0 left-0 z-50 flex w-[6px] cursor-w-resize items-center justify-center"
					@mousedown="handleResizeStart({ e: $event, elementId: element.id, side: 'left' })"
					aria-label="Left resize handle"
				>
					<div class="bg-white/50 h-[12px] w-[2px] rounded-full" />
				</button>
				<button
					type="button"
					class="absolute top-0 bottom-0 right-0 z-50 flex w-[6px] cursor-e-resize items-center justify-center"
					@mousedown="handleResizeStart({ e: $event, elementId: element.id, side: 'right' })"
					aria-label="Right resize handle"
				>
					<div class="bg-white/50 h-[12px] w-[2px] rounded-full" />
				</button>
			</template>
		</div>
	</div>
</template>
