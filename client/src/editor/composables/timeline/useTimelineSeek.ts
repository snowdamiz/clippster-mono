/**
 * Vue composable equivalent of OpenCut's use-timeline-seek.ts
 */
import { type Ref } from "vue";
import { TIMELINE_CONSTANTS } from "../../constants/timeline-constants";
import { getSnappedSeekTime } from "../../lib/time";
import { EditorCore } from "../../core";

interface UseTimelineSeekProps {
	playheadRef: Ref<HTMLDivElement | null>;
	trackLabelsRef: Ref<HTMLDivElement | null>;
	rulerScrollRef: Ref<HTMLDivElement | null>;
	tracksScrollRef: Ref<HTMLDivElement | null>;
	zoomLevel: Ref<number>;
	duration: Ref<number>;
	isSelecting: Ref<boolean>;
	clearSelectedElements: () => void;
	seek: (time: number) => void;
}

interface MouseTracking {
	isMouseDown: boolean;
	downX: number;
	downY: number;
	downTime: number;
}

export function useTimelineSeek({
	playheadRef,
	trackLabelsRef,
	rulerScrollRef,
	tracksScrollRef,
	zoomLevel,
	duration,
	isSelecting,
	clearSelectedElements,
	seek,
}: UseTimelineSeekProps) {
	const editor = EditorCore.getInstance();

	let mouseTracking: MouseTracking = {
		isMouseDown: false,
		downX: 0,
		downY: 0,
		downTime: 0,
	};

	function handleTracksMouseDown(event: MouseEvent) {
		if (event.button !== 0) return;
		mouseTracking = {
			isMouseDown: true,
			downX: event.clientX,
			downY: event.clientY,
			downTime: event.timeStamp,
		};
	}

	function handleRulerMouseDown(event: MouseEvent) {
		if (event.button !== 0) return;
		mouseTracking = {
			isMouseDown: true,
			downX: event.clientX,
			downY: event.clientY,
			downTime: event.timeStamp,
		};
	}

	function shouldProcessTimelineClick(event: MouseEvent): boolean {
		const target = event.target as HTMLElement;
		const { isMouseDown, downX, downY, downTime } = mouseTracking;
		const deltaX = Math.abs(event.clientX - downX);
		const deltaY = Math.abs(event.clientY - downY);
		const deltaTime = event.timeStamp - downTime;
		const isPlayhead = !!playheadRef.value?.contains(target);
		const isTrackLabels = !!trackLabelsRef.value?.contains(target);
		const shouldBlockForDrag = deltaX > 5 || deltaY > 5 || deltaTime > 500;

		if (!isMouseDown) return false;
		if (shouldBlockForDrag) return false;
		if (isSelecting.value) return false;
		if (isPlayhead) return false;
		if (isTrackLabels) {
			clearSelectedElements();
			return false;
		}

		return true;
	}

	function snapPlayheadToEdges(time: number): number {
		const SNAP_THRESHOLD_PX = 8;
		const pixelsPerSecond = TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel.value;
		const thresholdSec = SNAP_THRESHOLD_PX / pixelsPerSecond;

		const tracks = editor.timeline.getTracks();
		let closestEdge: number | null = null;
		let closestDist = Infinity;

		for (const track of tracks) {
			for (const el of track.elements) {
				const startDist = Math.abs(time - el.startTime);
				if (startDist < thresholdSec && startDist < closestDist) {
					closestDist = startDist;
					closestEdge = el.startTime;
				}
				const endTime = el.startTime + el.duration;
				const endDist = Math.abs(time - endTime);
				if (endDist < thresholdSec && endDist < closestDist) {
					closestDist = endDist;
					closestEdge = endTime;
				}
			}
		}

		return closestEdge !== null ? closestEdge : time;
	}

	function handleTimelineSeek(event: MouseEvent, source: "ruler" | "tracks") {
		const scrollContainer =
			source === "ruler" ? rulerScrollRef.value : tracksScrollRef.value;
		if (!scrollContainer) return;

		const activeProject = editor.project.getActive();
		const rect = scrollContainer.getBoundingClientRect();
		const mouseX = event.clientX - rect.left;
		const scrollLeft = scrollContainer.scrollLeft;

		const rawTime = Math.max(
			0,
			Math.min(
				duration.value,
				(mouseX + scrollLeft) /
					(TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel.value),
			),
		);

		const projectFps = activeProject?.settings.fps || 30;
		const frameSnapped = getSnappedSeekTime({ rawTime, duration: duration.value, fps: projectFps });
		const time = snapPlayheadToEdges(frameSnapped);
		seek(time);
		editor.project.setTimelineViewState({
			viewState: {
				zoomLevel: zoomLevel.value,
				scrollLeft: scrollContainer.scrollLeft,
				playheadTime: time,
			},
		});
	}

	function handleTracksClick(event: MouseEvent) {
		const shouldProcess = shouldProcessTimelineClick(event);
		mouseTracking = { isMouseDown: false, downX: 0, downY: 0, downTime: 0 };

		if (shouldProcess) {
			clearSelectedElements();
			handleTimelineSeek(event, "tracks");
		}
	}

	function handleRulerClick(event: MouseEvent) {
		const shouldProcess = shouldProcessTimelineClick(event);
		mouseTracking = { isMouseDown: false, downX: 0, downY: 0, downTime: 0 };

		if (shouldProcess) {
			clearSelectedElements();
			handleTimelineSeek(event, "ruler");
		}
	}

	return {
		handleTracksMouseDown,
		handleTracksClick,
		handleRulerMouseDown,
		handleRulerClick,
	};
}
