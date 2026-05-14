/**
 * Vue composable equivalent of OpenCut's use-selection-box.ts
 * Handles rubber-band selection of timeline elements.
 */
import { ref, watch, onUnmounted, type Ref } from "vue";
import { TIMELINE_CONSTANTS } from "../../constants/timeline-constants";
import { getCumulativeHeightBefore, getTrackHeight } from "../../lib/timeline";
import { EditorCore } from "../../core";

interface UseSelectionBoxProps {
	containerRef: Ref<HTMLElement | null>;
	onSelectionComplete: (elements: { trackId: string; elementId: string }[]) => void;
	isEnabled?: boolean;
	tracksScrollRef: Ref<HTMLDivElement | null>;
	zoomLevel: Ref<number>;
}

interface SelectionBoxState {
	startPos: { x: number; y: number };
	currentPos: { x: number; y: number };
	isActive: boolean;
}

interface SelectionRectangle {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

function getNormalizedRectangle({
	startPos,
	endPos,
}: {
	startPos: { x: number; y: number };
	endPos: { x: number; y: number };
}): SelectionRectangle {
	return {
		left: Math.min(startPos.x, endPos.x),
		top: Math.min(startPos.y, endPos.y),
		right: Math.max(startPos.x, endPos.x),
		bottom: Math.max(startPos.y, endPos.y),
	};
}

function getSelectionRectangleInContent({
	container,
	scrollContainer,
	startPos,
	endPos,
}: {
	container: HTMLElement;
	scrollContainer: HTMLDivElement | null;
	startPos: { x: number; y: number };
	endPos: { x: number; y: number };
}): SelectionRectangle {
	const containerRect = container.getBoundingClientRect();
	const scrollLeft = scrollContainer?.scrollLeft ?? 0;
	const scrollTop = scrollContainer?.scrollTop ?? 0;

	return getNormalizedRectangle({
		startPos: {
			x: startPos.x - containerRect.left + scrollLeft,
			y: startPos.y - containerRect.top + scrollTop,
		},
		endPos: {
			x: endPos.x - containerRect.left + scrollLeft,
			y: endPos.y - containerRect.top + scrollTop,
		},
	});
}

function isRectangleIntersecting({
	elementRectangle,
	selectionRectangle,
}: {
	elementRectangle: SelectionRectangle;
	selectionRectangle: SelectionRectangle;
}): boolean {
	return !(
		elementRectangle.right < selectionRectangle.left ||
		elementRectangle.left > selectionRectangle.right ||
		elementRectangle.bottom < selectionRectangle.top ||
		elementRectangle.top > selectionRectangle.bottom
	);
}

export function useSelectionBox({
	containerRef,
	onSelectionComplete,
	isEnabled = true,
	tracksScrollRef,
	zoomLevel,
}: UseSelectionBoxProps) {
	const editor = EditorCore.getInstance();

	const selectionBox = ref<SelectionBoxState | null>(null);
	const isSelecting = ref(false);
	let justFinishedSelecting = false;

	function handleMouseDown(event: MouseEvent) {
		if (!isEnabled) return;
		selectionBox.value = {
			startPos: { x: event.clientX, y: event.clientY },
			currentPos: { x: event.clientX, y: event.clientY },
			isActive: false,
		};
	}

	function selectElementsInBox(startPos: { x: number; y: number }, endPos: { x: number; y: number }) {
		if (!containerRef.value) return;

		const tracks = editor.timeline.getTracks();
		const container = containerRef.value;
		const selectionRectangle = getSelectionRectangleInContent({
			container,
			scrollContainer: tracksScrollRef.value,
			startPos,
			endPos,
		});
		const pixelsPerSecond = TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel.value;
		const selectedElements: { trackId: string; elementId: string }[] = [];

		for (const [trackIndex, track] of tracks.entries()) {
			const trackTop = getCumulativeHeightBefore({ tracks, trackIndex });
			const trackHeight = getTrackHeight({ type: track.type });

			for (const element of track.elements) {
				const elementLeft = element.startTime * pixelsPerSecond;
				const elementRight = elementLeft + element.duration * pixelsPerSecond;

				if (
					isRectangleIntersecting({
						elementRectangle: {
							left: elementLeft,
							top: trackTop,
							right: elementRight,
							bottom: trackTop + trackHeight,
						},
						selectionRectangle,
					})
				) {
					selectedElements.push({ trackId: track.id, elementId: element.id });
				}
			}
		}
		onSelectionComplete(selectedElements);
	}

	// Global listeners while selection box is active
	let cleanupListeners: (() => void) | null = null;

	watch(selectionBox, (sb) => {
		cleanupListeners?.();
		cleanupListeners = null;

		if (!sb) {
			isSelecting.value = false;
			return;
		}

		const onMouseMove = (e: MouseEvent) => {
			if (!selectionBox.value) return;
			const deltaX = Math.abs(e.clientX - selectionBox.value.startPos.x);
			const deltaY = Math.abs(e.clientY - selectionBox.value.startPos.y);
			const shouldActivate = deltaX > 5 || deltaY > 5;

			selectionBox.value = {
				...selectionBox.value,
				currentPos: { x: e.clientX, y: e.clientY },
				isActive: shouldActivate || selectionBox.value.isActive,
			};
			isSelecting.value = selectionBox.value.isActive;

			if (selectionBox.value.isActive) {
				selectElementsInBox(selectionBox.value.startPos, selectionBox.value.currentPos);
			}
		};

		const onMouseUp = () => {
			if (selectionBox.value?.isActive) {
				justFinishedSelecting = true;
				requestAnimationFrame(() => {
					justFinishedSelecting = false;
				});
			}
			selectionBox.value = null;
		};

		// Disable text selection while dragging
		const prevBodyUserSelect = document.body.style.userSelect;
		const container = containerRef.value;
		const prevContainerUserSelect = container?.style.userSelect ?? "";
		document.body.style.userSelect = "none";
		if (container) container.style.userSelect = "none";

		window.addEventListener("mousemove", onMouseMove);
		window.addEventListener("mouseup", onMouseUp);

		cleanupListeners = () => {
			window.removeEventListener("mousemove", onMouseMove);
			window.removeEventListener("mouseup", onMouseUp);
			document.body.style.userSelect = prevBodyUserSelect;
			if (container) container.style.userSelect = prevContainerUserSelect;
		};
	});

	onUnmounted(() => {
		cleanupListeners?.();
	});

	function shouldIgnoreClick(): boolean {
		return justFinishedSelecting;
	}

	return {
		selectionBox,
		handleMouseDown,
		isSelecting,
		shouldIgnoreClick,
	};
}
