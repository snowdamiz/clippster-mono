/**
 * Vue composable equivalent of OpenCut's use-timeline-playhead.ts
 */
import { ref, computed, watch, onMounted, onUnmounted, type Ref } from "vue";
import { getSnappedSeekTime } from "../../lib/time";
import { useEdgeAutoScroll } from "./useEdgeAutoScroll";
import { useEditor } from "../useEditor";
import { TIMELINE_CONSTANTS } from "../../constants/timeline-constants";

interface UseTimelinePlayheadProps {
	zoomLevel: Ref<number>;
	rulerRef: Ref<HTMLDivElement | null>;
	rulerScrollRef: Ref<HTMLDivElement | null>;
	tracksScrollRef: Ref<HTMLDivElement | null>;
	playheadRef?: Ref<HTMLDivElement | null>;
	autoFollow?: Ref<boolean>;
}

export function useTimelinePlayhead({
	zoomLevel,
	rulerRef,
	rulerScrollRef,
	tracksScrollRef,
	playheadRef,
	autoFollow,
}: UseTimelinePlayheadProps) {
	const { editor, version } = useEditor();

	const currentTime = computed(() => {
		void version.value;
		return editor.playback.getCurrentTime();
	});
	const duration = computed(() => {
		void version.value;
		return editor.timeline.getTotalDuration();
	});
	const isPlaying = computed(() => {
		void version.value;
		return editor.playback.getIsPlaying();
	});

	const isScrubbing = ref(false);
	const scrubTime = ref<number | null>(null);
	const isDraggingRuler = ref(false);
	const hasDraggedRuler = ref(false);
	let lastMouseX = 0;

	const playheadPosition = computed(() =>
		isScrubbing.value && scrubTime.value !== null
			? scrubTime.value
			: currentTime.value,
	);

	const contentWidth = computed(
		() => duration.value * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel.value,
	);

	useEdgeAutoScroll({
		isActive: isScrubbing,
		getMouseClientX: () => lastMouseX,
		rulerScrollRef,
		tracksScrollRef,
		contentWidth,
	});

	function handleScrub(event: MouseEvent) {
		// Use rulerRef if available, otherwise fall back to tracksScrollRef
		const container = rulerRef.value ?? tracksScrollRef.value;
		if (!container) return;
		const containerRect = container.getBoundingClientRect();
		const scrollLeft = container.scrollLeft ?? 0;
		const relativeMouseX = event.clientX - containerRect.left + scrollLeft;

		const timelineContentWidth =
			duration.value * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel.value;
		const clampedMouseX = Math.max(0, Math.min(timelineContentWidth, relativeMouseX));

		const rawTime = Math.max(
			0,
			Math.min(
				duration.value,
				clampedMouseX / (TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel.value),
			),
		);

		const activeProject = editor.project.getActive();
		const framesPerSecond = activeProject?.settings?.fps ?? 30;
		const time = getSnappedSeekTime({ rawTime, duration: duration.value, fps: framesPerSecond });

		scrubTime.value = time;
		editor.playback.seek({ time });
		lastMouseX = event.clientX;
	}

	function handlePlayheadMouseDown(event: MouseEvent) {
		event.preventDefault();
		event.stopPropagation();
		isScrubbing.value = true;
		handleScrub(event);
	}

	function handleRulerMouseDown(event: MouseEvent) {
		if (event.button !== 0) return;
		if (playheadRef?.value?.contains(event.target as Node)) return;

		event.preventDefault();
		isDraggingRuler.value = true;
		hasDraggedRuler.value = false;
		isScrubbing.value = true;
		handleScrub(event);
	}

	// Global mouse move/up handlers for scrubbing
	let cleanupGlobalListeners: (() => void) | null = null;

	watch(isScrubbing, (active) => {
		if (active) {
			const onMouseMove = (event: MouseEvent) => {
				handleScrub(event);
				if (isDraggingRuler.value) {
					hasDraggedRuler.value = true;
				}
			};

			const onMouseUp = (event: MouseEvent) => {
				isScrubbing.value = false;
				if (scrubTime.value !== null) {
					editor.playback.seek({ time: scrubTime.value });
					editor.project.setTimelineViewState({
						viewState: {
							zoomLevel: zoomLevel.value,
							scrollLeft: tracksScrollRef.value?.scrollLeft ?? 0,
							playheadTime: scrubTime.value,
						},
					});
				}
				scrubTime.value = null;

				if (isDraggingRuler.value) {
					isDraggingRuler.value = false;
					if (!hasDraggedRuler.value) {
						handleScrub(event);
					}
					hasDraggedRuler.value = false;
				}
			};

			window.addEventListener("mousemove", onMouseMove);
			window.addEventListener("mouseup", onMouseUp);

			cleanupGlobalListeners = () => {
				window.removeEventListener("mousemove", onMouseMove);
				window.removeEventListener("mouseup", onMouseUp);
			};
		} else {
			cleanupGlobalListeners?.();
			cleanupGlobalListeners = null;
		}
	});

	// Auto-scroll playhead into view during playback
	// Uses "page forward" behavior: when playhead exits the right edge,
	// scroll so the playhead is at the left edge of the viewport, letting it
	// traverse the full visible width before the next page.
	watch([playheadPosition, isPlaying, isScrubbing], ([pos, playing, scrub]) => {
		if (!playing || scrub) return;
		if (autoFollow && !autoFollow.value) return;

		const rulerViewport = rulerScrollRef.value;
		const tracksViewport = tracksScrollRef.value;
		if (!rulerViewport || !tracksViewport) return;

		const playheadPixels = (pos as number) * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel.value;
		const viewportWidth = rulerViewport.clientWidth;
		const scrollLeft = rulerViewport.scrollLeft;

		const needsScroll =
			playheadPixels < scrollLeft ||
			playheadPixels > scrollLeft + viewportWidth;

		if (needsScroll) {
			const scrollMax = rulerViewport.scrollWidth - viewportWidth;
			// Place playhead at the left edge with a small margin
			const margin = viewportWidth * 0.05;
			const desiredScroll = Math.max(0, Math.min(scrollMax, playheadPixels - margin));
			rulerViewport.scrollLeft = tracksViewport.scrollLeft = desiredScroll;
		}
	});

	onUnmounted(() => {
		cleanupGlobalListeners?.();
	});

	return {
		playheadPosition,
		handlePlayheadMouseDown,
		handleRulerMouseDown,
		isDraggingRuler,
	};
}
