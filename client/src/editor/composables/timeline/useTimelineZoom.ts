/**
 * Vue composable equivalent of OpenCut's use-timeline-zoom.ts
 */
import { ref, watch, onMounted, onUnmounted, nextTick, type Ref } from "vue";
import { TIMELINE_CONSTANTS } from "../../constants/timeline-constants";
import { useEditor } from "../useEditor";
import { zoomToSlider } from "../../lib/timeline/zoom-utils";

interface UseTimelineZoomProps {
	containerRef: Ref<HTMLDivElement | null>;
	minZoom?: Ref<number>;
	initialZoom?: number;
	initialScrollLeft?: number;
	initialPlayheadTime?: number;
	tracksScrollRef: Ref<HTMLDivElement | null>;
	rulerScrollRef: Ref<HTMLDivElement | null>;
}

export function useTimelineZoom({
	containerRef,
	minZoom,
	initialZoom,
	initialScrollLeft,
	initialPlayheadTime,
	tracksScrollRef,
	rulerScrollRef,
}: UseTimelineZoomProps) {
	const { editor } = useEditor();

	const minZoomValue = minZoom ?? ref(TIMELINE_CONSTANTS.ZOOM_MIN);

	const zoomLevel = ref(
		initialZoom !== undefined
			? Math.max(minZoomValue.value, Math.min(TIMELINE_CONSTANTS.ZOOM_MAX, initialZoom))
			: minZoomValue.value,
	);
	let previousZoom = zoomLevel.value;

	// Saved projects / older builds may have zoomLevel above ZOOM_MAX; keep state clamped.
	watch(
		minZoomValue,
		() => {
			const clamped = Math.max(
				minZoomValue.value,
				Math.min(TIMELINE_CONSTANTS.ZOOM_MAX, zoomLevel.value),
			);
			if (clamped !== zoomLevel.value) {
				zoomLevel.value = clamped;
				previousZoom = clamped;
			}
		},
		{ immediate: true },
	);
	let hasRestoredScroll = false;
	let hasRestoredPlayhead = false;
	let scrollSaveTimeout: ReturnType<typeof setTimeout> | null = null;

	function setZoomLevel(zoomLevelOrUpdater: number | ((prev: number) => number)) {
		const nextZoom =
			typeof zoomLevelOrUpdater === "function"
				? zoomLevelOrUpdater(zoomLevel.value)
				: zoomLevelOrUpdater;
		zoomLevel.value = Math.max(minZoomValue.value, Math.min(TIMELINE_CONSTANTS.ZOOM_MAX, nextZoom));
	}

	function handleWheel(event: WheelEvent) {
		const isZoomGesture = event.ctrlKey || event.metaKey;
		const isHorizontalScrollGesture =
			event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY);

		if (isHorizontalScrollGesture) return;

		if (isZoomGesture) {
			const zoomMultiplier = event.deltaY > 0 ? 1 / 1.1 : 1.1;
			setZoomLevel((prev) =>
				Math.max(minZoomValue.value, Math.min(TIMELINE_CONSTANTS.ZOOM_MAX, prev * zoomMultiplier)),
			);
		}
	}

	// Anchor scroll to playhead on zoom change
	watch(zoomLevel, (newZoom) => {
		const scrollElement = tracksScrollRef.value;
		if (previousZoom === newZoom || !scrollElement) {
			previousZoom = newZoom;
			return;
		}

		const currentScrollLeft = scrollElement.scrollLeft;
		const playheadTime = editor.playback.getCurrentTime();
		const sliderPercent = zoomToSlider({ zoomLevel: newZoom, minZoom: minZoomValue.value });

		if (sliderPercent >= TIMELINE_CONSTANTS.ZOOM_ANCHOR_PLAYHEAD_THRESHOLD) {
			const playheadPixelsBefore =
				playheadTime * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * previousZoom;
			const playheadPixelsAfter =
				playheadTime * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * newZoom;
			const viewportOffset = playheadPixelsBefore - currentScrollLeft;
			const newScrollLeft = playheadPixelsAfter - viewportOffset;
			const maxScrollLeft = scrollElement.scrollWidth - scrollElement.clientWidth;
			const clampedScrollLeft = Math.max(0, Math.min(maxScrollLeft, newScrollLeft));

			scrollElement.scrollLeft = clampedScrollLeft;
			if (rulerScrollRef.value) {
				rulerScrollRef.value.scrollLeft = clampedScrollLeft;
			}
		}

		previousZoom = newZoom;

		editor.project.setTimelineViewState({
			viewState: {
				zoomLevel: newZoom,
				scrollLeft: scrollElement.scrollLeft,
				playheadTime,
			},
		});
	});

	function saveScrollPosition() {
		if (scrollSaveTimeout) clearTimeout(scrollSaveTimeout);
		scrollSaveTimeout = setTimeout(() => {
			const scrollElement = tracksScrollRef.value;
			if (scrollElement) {
				editor.project.setTimelineViewState({
					viewState: {
						zoomLevel: zoomLevel.value,
						scrollLeft: scrollElement.scrollLeft,
						playheadTime: editor.playback.getCurrentTime(),
					},
				});
			}
		}, 300);
	}

	// Restore scroll position
	onMounted(() => {
		if (initialScrollLeft === undefined) return;

		const tryRestore = () => {
			if (hasRestoredScroll) return;
			const scrollElement = tracksScrollRef.value;
			if (!scrollElement) return;

			if (scrollElement.scrollWidth > 0) {
				scrollElement.scrollLeft = initialScrollLeft;
				if (rulerScrollRef.value) {
					rulerScrollRef.value.scrollLeft = initialScrollLeft;
				}
				hasRestoredScroll = true;
			} else {
				const observer = new ResizeObserver(() => {
					if (scrollElement.scrollWidth > 0) {
						scrollElement.scrollLeft = initialScrollLeft;
						if (rulerScrollRef.value) {
							rulerScrollRef.value.scrollLeft = initialScrollLeft;
						}
						hasRestoredScroll = true;
						observer.disconnect();
					}
				});
				observer.observe(scrollElement);
			}
		};

		nextTick(tryRestore);
	});

	// Restore playhead position
	onMounted(() => {
		if (initialPlayheadTime !== undefined && !hasRestoredPlayhead) {
			hasRestoredPlayhead = true;
			editor.playback.seek({ time: initialPlayheadTime });
		}
	});

	// Prevent browser zoom in the timeline
	onMounted(() => {
		const preventZoom = (event: WheelEvent) => {
			const isZoomKeyPressed = event.ctrlKey || event.metaKey;
			const isInContainer = containerRef.value?.contains(event.target as Node);
			if (isZoomKeyPressed && isInContainer) {
				event.preventDefault();
			}
		};

		document.addEventListener("wheel", preventZoom, { passive: false, capture: true });

		onUnmounted(() => {
			document.removeEventListener("wheel", preventZoom, { capture: true });
		});
	});

	onUnmounted(() => {
		if (scrollSaveTimeout) clearTimeout(scrollSaveTimeout);
	});

	return {
		zoomLevel,
		setZoomLevel,
		handleWheel,
		saveScrollPosition,
	};
}
