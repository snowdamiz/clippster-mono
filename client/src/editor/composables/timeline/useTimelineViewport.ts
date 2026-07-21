import { computed, type Ref } from "vue";
import { TIMELINE_CONSTANTS } from "../../constants/timeline-constants";
import type { TimelineElement } from "../../types/timeline";

export interface TimelineVisibleRange {
	startTime: number;
	endTime: number;
}

export function getTimelineVisibleRange({
	scrollLeft,
	viewportWidth,
	zoomLevel,
	overscanPx = 400,
}: {
	scrollLeft: number;
	viewportWidth: number;
	zoomLevel: number;
	overscanPx?: number;
}): TimelineVisibleRange {
	const pixelsPerSecond = TIMELINE_CONSTANTS.PIXELS_PER_SECOND * Math.max(zoomLevel, 0.0001);
	return {
		startTime: Math.max(0, (scrollLeft - overscanPx) / pixelsPerSecond),
		endTime: Math.max(0, (scrollLeft + viewportWidth + overscanPx) / pixelsPerSecond),
	};
}

export function isElementInVisibleRange(
	element: Pick<TimelineElement, "id" | "startTime" | "duration">,
	range: TimelineVisibleRange,
	retainedElementIds: ReadonlySet<string>,
	previewStartTime?: number,
): boolean {
	if (retainedElementIds.has(element.id)) return true;
	const startTime = previewStartTime ?? element.startTime;
	return startTime + element.duration >= range.startTime && startTime <= range.endTime;
}

export function useTimelineViewport({
	scrollLeft,
	viewportWidth,
	zoomLevel,
	overscanPx = 400,
}: {
	scrollLeft: Ref<number>;
	viewportWidth: Ref<number>;
	zoomLevel: Ref<number>;
	overscanPx?: number;
}) {
	const visibleRange = computed(() =>
		getTimelineVisibleRange({
			scrollLeft: scrollLeft.value,
			viewportWidth: viewportWidth.value,
			zoomLevel: zoomLevel.value,
			overscanPx,
		}),
	);

	return { visibleRange };
}
