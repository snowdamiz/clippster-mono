/**
 * Vue composable equivalent of OpenCut's use-timeline-zoom.ts
 */
import { ref, watch, onMounted, onUnmounted, nextTick, type Ref } from "vue";
import { TIMELINE_CONSTANTS } from "../../constants/timeline-constants";
import { EditorCore } from "../../core";
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
	const editor = EditorCore.getInstance();

	const minZoomValue = minZoom ?? ref(TIMELINE_CONSTANTS.ZOOM_MIN);

	const zoomLevel = ref(
		initialZoom !== undefined
			? Math.max(minZoomValue.value, Math.min(TIMELINE_CONSTANTS.ZOOM_MAX, initialZoom))
			: minZoomValue.value,
	);
	let previousZoom = zoomLevel.value;

	// `minZoom` is derived from timeline duration (and container width). When duration changes
	// — e.g. first clip added — the "fit whole timeline" floor moves. Without rescaling, a zoom
	// level that matched the old floor still equals the old numeric value but sits far above the
	// new floor, so the slider jumps to ~100% (looks fully zoomed in). Scale zoom with the floor
	// so slider position / pixels-per-second intent is preserved.
	let previousMinZoom = minZoomValue.value;

	watch(
		minZoomValue,
		(newMin) => {
			const oldMin = previousMinZoom;
			if (oldMin !== newMin && oldMin > 0 && newMin > 0) {
				const rescaled = zoomLevel.value * (newMin / oldMin);
				zoomLevel.value = Math.max(
					newMin,
					Math.min(TIMELINE_CONSTANTS.ZOOM_MAX, rescaled),
				);
				previousZoom = zoomLevel.value;
			}
			previousMinZoom = newMin;

			// Saved projects / older builds may have zoomLevel above ZOOM_MAX; keep state clamped.
			const clamped = Math.max(
				newMin,
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

	// Cursor anchor for the next zoom change. Set on `wheel`, cleared after
	// the zoom watcher fires. When unset, we fall back to the playhead anchor
	// so keyboard zoom still feels right.
	let cursorAnchorClientX: number | null = null;

	function handleWheel(event: WheelEvent) {
		const isZoomGesture = event.ctrlKey || event.metaKey;
		const isHorizontalScrollGesture =
			event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY);

		if (isHorizontalScrollGesture) return;

		if (isZoomGesture) {
			cursorAnchorClientX = event.clientX;
			const zoomMultiplier = event.deltaY > 0 ? 1 / 1.1 : 1.1;
			setZoomLevel((prev) =>
				Math.max(minZoomValue.value, Math.min(TIMELINE_CONSTANTS.ZOOM_MAX, prev * zoomMultiplier)),
			);
		}
	}

	// Anchor scroll on zoom change. Pixel under the cursor (wheel zoom) or
	// the playhead (keyboard / button zoom) stays glued — same behavior as
	// CapCut and DaVinci Resolve.
	watch(zoomLevel, (newZoom) => {
		const scrollElement = tracksScrollRef.value;
		if (previousZoom === newZoom || !scrollElement) {
			previousZoom = newZoom;
			cursorAnchorClientX = null;
			return;
		}

		const currentScrollLeft = scrollElement.scrollLeft;
		const sliderPercent = zoomToSlider({ zoomLevel: newZoom, minZoom: minZoomValue.value });

		// Skip the anchor math when fully zoomed out — there is nowhere to scroll.
		if (sliderPercent >= TIMELINE_CONSTANTS.ZOOM_ANCHOR_PLAYHEAD_THRESHOLD) {
			let anchorPixelsBefore: number;
			if (cursorAnchorClientX !== null) {
				const rect = scrollElement.getBoundingClientRect();
				const localX = cursorAnchorClientX - rect.left;
				anchorPixelsBefore = currentScrollLeft + localX;
			} else {
				const playheadTime = editor.playback.getCurrentTime();
				anchorPixelsBefore = playheadTime * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * previousZoom;
			}
			const anchorTime = anchorPixelsBefore / (TIMELINE_CONSTANTS.PIXELS_PER_SECOND * previousZoom);
			const anchorPixelsAfter = anchorTime * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * newZoom;
			const viewportOffset = anchorPixelsBefore - currentScrollLeft;
			const newScrollLeft = anchorPixelsAfter - viewportOffset;
			const maxScrollLeft = scrollElement.scrollWidth - scrollElement.clientWidth;
			const clampedScrollLeft = Math.max(0, Math.min(maxScrollLeft, newScrollLeft));

			scrollElement.scrollLeft = clampedScrollLeft;
			if (rulerScrollRef.value && rulerScrollRef.value !== scrollElement) {
				rulerScrollRef.value.scrollLeft = clampedScrollLeft;
			}
		}

		previousZoom = newZoom;
		cursorAnchorClientX = null;
		// Persistence is delegated to `saveScrollPosition` (debounced) so
		// rapid wheel zoom doesn't fire a SQLite write per frame.
		queueViewStateSave();
	});

	function queueViewStateSave() {
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

	/** Public name for `queueViewStateSave` — called from `@scroll` in the template. */
	function saveScrollPosition() {
		queueViewStateSave();
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
