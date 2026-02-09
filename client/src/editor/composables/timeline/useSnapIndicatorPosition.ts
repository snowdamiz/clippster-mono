/**
 * Vue composable equivalent of OpenCut's use-snap-indicator-position.ts
 */
import { ref, computed, onMounted, onUnmounted, type Ref } from "vue";
import { TIMELINE_CONSTANTS } from "../../constants/timeline-constants";
import type { TimelineTrack } from "../../types/timeline";

interface UseSnapIndicatorPositionParams {
	snapPoint: Ref<{ time: number } | null>;
	zoomLevel: Ref<number>;
	tracks: Ref<TimelineTrack[]>;
	timelineRef: Ref<HTMLDivElement | null>;
	trackLabelsRef?: Ref<HTMLDivElement | null>;
	tracksScrollRef: Ref<HTMLDivElement | null>;
}

export function useSnapIndicatorPosition({
	snapPoint,
	zoomLevel,
	tracks,
	timelineRef,
	trackLabelsRef,
	tracksScrollRef,
}: UseSnapIndicatorPositionParams) {
	const scrollLeft = ref(0);
	let cleanup: (() => void) | null = null;

	onMounted(() => {
		const tracksViewport = tracksScrollRef.value;
		if (!tracksViewport) return;

		const handleScroll = () => {
			scrollLeft.value = tracksViewport.scrollLeft;
		};
		scrollLeft.value = tracksViewport.scrollLeft;
		tracksViewport.addEventListener("scroll", handleScroll);
		cleanup = () => tracksViewport.removeEventListener("scroll", handleScroll);
	});

	onUnmounted(() => {
		cleanup?.();
	});

	const leftPosition = computed(() => {
		const trackLabelsWidth =
			tracks.value.length > 0 && trackLabelsRef?.value
				? trackLabelsRef.value.offsetWidth
				: 0;
		const timelinePosition =
			(snapPoint.value?.time || 0) * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel.value;
		return trackLabelsWidth + timelinePosition - scrollLeft.value;
	});

	const height = computed(() => {
		const timelineContainerHeight = timelineRef.value?.offsetHeight || 400;
		return timelineContainerHeight - 8;
	});

	return {
		leftPosition,
		topPosition: 0,
		height,
	};
}
