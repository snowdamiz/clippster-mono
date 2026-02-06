/**
 * Vue composable equivalent of OpenCut's use-element-interaction.ts
 * Handles drag-and-drop of timeline elements between tracks.
 */
import { ref, watch, onUnmounted, computed, type Ref } from "vue";
import { useEditor } from "../../useEditor";
import { useElementSelection } from "./useElementSelection";
import { TIMELINE_CONSTANTS } from "../../../constants/timeline-constants";
import { snapTimeToFrame } from "../../../lib/time";
import { computeDropTarget } from "../../../lib/timeline/drop-utils";
import { generateUUID } from "../../../utils/id";
import { useTimelineSnapping, type SnapPoint } from "../useTimelineSnapping";
import type {
	DropTarget,
	ElementDragState,
	TimelineElement,
	TimelineTrack,
} from "../../../types/timeline";

const DRAG_THRESHOLD_PX = 5;

interface UseElementInteractionProps {
	zoomLevel: Ref<number>;
	timelineRef: Ref<HTMLDivElement | null>;
	tracksContainerRef: Ref<HTMLDivElement | null>;
	tracksScrollRef: Ref<HTMLDivElement | null>;
	headerRef?: Ref<HTMLElement | null>;
	snappingEnabled: Ref<boolean>;
	onSnapPointChange?: (snapPoint: SnapPoint | null) => void;
}

const initialDragState: ElementDragState = {
	isDragging: false,
	elementId: null,
	trackId: null,
	startMouseX: 0,
	startMouseY: 0,
	startElementTime: 0,
	clickOffsetTime: 0,
	currentTime: 0,
	currentMouseY: 0,
};

interface PendingDragState {
	elementId: string;
	trackId: string;
	startMouseX: number;
	startMouseY: number;
	startElementTime: number;
	clickOffsetTime: number;
}

function getMouseTimeFromClientX({
	clientX,
	containerRect,
	zoomLevel,
	scrollLeft,
}: {
	clientX: number;
	containerRect: DOMRect;
	zoomLevel: number;
	scrollLeft: number;
}): number {
	const mouseX = clientX - containerRect.left + scrollLeft;
	return Math.max(0, mouseX / (TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel));
}

function getClickOffsetTime({
	clientX,
	elementRect,
	zoomLevel,
}: {
	clientX: number;
	elementRect: DOMRect;
	zoomLevel: number;
}): number {
	const clickOffsetX = clientX - elementRect.left;
	return clickOffsetX / (TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel);
}

function getVerticalDragDirection({
	startMouseY,
	currentMouseY,
}: {
	startMouseY: number;
	currentMouseY: number;
}): "up" | "down" | null {
	if (currentMouseY < startMouseY) return "up";
	if (currentMouseY > startMouseY) return "down";
	return null;
}

export function useElementInteraction({
	zoomLevel,
	timelineRef,
	tracksContainerRef,
	tracksScrollRef,
	headerRef,
	snappingEnabled,
	onSnapPointChange,
}: UseElementInteractionProps) {
	const { editor, version } = useEditor();
	const { snapElementEdge } = useTimelineSnapping();
	const {
		isElementSelected,
		selectElement,
		handleElementClick: handleSelectionClick,
	} = useElementSelection();

	const tracks = computed(() => {
		void version.value;
		return editor.timeline.getTracks();
	});

	const dragState = ref<ElementDragState>({ ...initialDragState });
	const dragDropTarget = ref<DropTarget | null>(null);
	const isPendingDrag = ref(false);
	let pendingDrag: PendingDragState | null = null;
	let lastMouseX = 0;
	let mouseDownLocation: { x: number; y: number } | null = null;

	function getDragDropTarget({
		clientX,
		clientY,
		elementId,
		trackId,
		currentTracks,
		snappedTime,
		verticalDragDirection,
	}: {
		clientX: number;
		clientY: number;
		elementId: string;
		trackId: string;
		currentTracks: TimelineTrack[];
		snappedTime: number;
		verticalDragDirection?: "up" | "down" | null;
	}): DropTarget | null {
		const containerRect = tracksContainerRef.value?.getBoundingClientRect();
		const scrollContainer = tracksScrollRef.value;
		if (!containerRect || !scrollContainer) return null;

		const sourceTrack = currentTracks.find(({ id }) => id === trackId);
		const movingElement = sourceTrack?.elements.find(({ id }) => id === elementId);
		if (!movingElement) return null;

		const scrollLeft = scrollContainer.scrollLeft;
		const scrollTop = scrollContainer.scrollTop;
		const scrollContainerRect = scrollContainer.getBoundingClientRect();
		const headerHeight = headerRef?.value?.getBoundingClientRect().height ?? 0;
		const mouseX = clientX - scrollContainerRect.left + scrollLeft;
		const mouseY = clientY - scrollContainerRect.top + scrollTop - headerHeight;

		return computeDropTarget({
			elementType: movingElement.type,
			mouseX,
			mouseY,
			tracks: currentTracks,
			playheadTime: snappedTime,
			isExternalDrop: false,
			elementDuration: movingElement.duration,
			pixelsPerSecond: TIMELINE_CONSTANTS.PIXELS_PER_SECOND,
			zoomLevel: zoomLevel.value,
			startTimeOverride: snappedTime,
			excludeElementId: movingElement.id,
			verticalDragDirection,
		});
	}

	function getDragSnapResult({
		frameSnappedTime,
		movingElement,
	}: {
		frameSnappedTime: number;
		movingElement: TimelineElement | null | undefined;
	}) {
		if (!snappingEnabled.value || !movingElement) {
			return { snappedTime: frameSnappedTime, snapPoint: null };
		}

		const elementDuration = movingElement.duration;
		const playheadTime = editor.playback.getCurrentTime();

		const startSnap = snapElementEdge({
			targetTime: frameSnappedTime,
			elementDuration,
			tracks: tracks.value,
			playheadTime,
			zoomLevel: zoomLevel.value,
			excludeElementId: movingElement.id,
			snapToStart: true,
		});

		const endSnap = snapElementEdge({
			targetTime: frameSnappedTime,
			elementDuration,
			tracks: tracks.value,
			playheadTime,
			zoomLevel: zoomLevel.value,
			excludeElementId: movingElement.id,
			snapToStart: false,
		});

		const snapResult = startSnap.snapDistance <= endSnap.snapDistance ? startSnap : endSnap;
		if (!snapResult.snapPoint) {
			return { snappedTime: frameSnappedTime, snapPoint: null };
		}

		return { snappedTime: snapResult.snappedTime, snapPoint: snapResult.snapPoint };
	}

	// Mouse move handler
	function onMouseMove(event: MouseEvent) {
		const { clientX, clientY } = event;
		const ds = dragState.value;
		let startedDragThisEvent = false;
		const timeline = timelineRef.value;
		const scrollContainer = tracksScrollRef.value;
		if (!timeline || !scrollContainer) return;
		lastMouseX = clientX;

		// Check if pending drag exceeds threshold
		if (isPendingDrag.value && pendingDrag) {
			const deltaX = Math.abs(clientX - pendingDrag.startMouseX);
			const deltaY = Math.abs(clientY - pendingDrag.startMouseY);
			if (deltaX > DRAG_THRESHOLD_PX || deltaY > DRAG_THRESHOLD_PX) {
				const activeProject = editor.project.getActive();
				if (!activeProject) return;
				const scrollLeft = scrollContainer.scrollLeft;
				const mouseTime = getMouseTimeFromClientX({
					clientX,
					containerRect: scrollContainer.getBoundingClientRect(),
					zoomLevel: zoomLevel.value,
					scrollLeft,
				});
				const adjustedTime = Math.max(0, mouseTime - pendingDrag.clickOffsetTime);
				const snappedTime = snapTimeToFrame({ time: adjustedTime, fps: activeProject.settings.fps });

				dragState.value = {
					isDragging: true,
					elementId: pendingDrag.elementId,
					trackId: pendingDrag.trackId,
					startMouseX: pendingDrag.startMouseX,
					startMouseY: pendingDrag.startMouseY,
					startElementTime: pendingDrag.startElementTime,
					clickOffsetTime: pendingDrag.clickOffsetTime,
					currentTime: snappedTime,
					currentMouseY: clientY,
				};
				startedDragThisEvent = true;
				pendingDrag = null;
				isPendingDrag.value = false;
			} else {
				return;
			}
		}

		if (startedDragThisEvent) return;

		if (ds.elementId && ds.trackId) {
			const alreadySelected = isElementSelected({ trackId: ds.trackId, elementId: ds.elementId });
			if (!alreadySelected) {
				selectElement({ trackId: ds.trackId, elementId: ds.elementId });
			}
		}

		const activeProject = editor.project.getActive();
		if (!activeProject) return;

		const scrollLeft = scrollContainer.scrollLeft;
		const mouseTime = getMouseTimeFromClientX({
			clientX,
			containerRect: scrollContainer.getBoundingClientRect(),
			zoomLevel: zoomLevel.value,
			scrollLeft,
		});
		const adjustedTime = Math.max(0, mouseTime - ds.clickOffsetTime);
		const fps = activeProject.settings.fps;
		const frameSnappedTime = snapTimeToFrame({ time: adjustedTime, fps });

		const sourceTrack = tracks.value.find(({ id }) => id === ds.trackId);
		const movingElement = sourceTrack?.elements.find(({ id }) => id === ds.elementId);
		const { snappedTime, snapPoint } = getDragSnapResult({ frameSnappedTime, movingElement });

		dragState.value = { ...ds, currentTime: snappedTime, currentMouseY: clientY };
		onSnapPointChange?.(snapPoint);

		if (ds.elementId && ds.trackId) {
			const verticalDragDirection = getVerticalDragDirection({
				startMouseY: ds.startMouseY,
				currentMouseY: clientY,
			});
			const dropTarget = getDragDropTarget({
				clientX,
				clientY,
				elementId: ds.elementId,
				trackId: ds.trackId,
				currentTracks: tracks.value,
				snappedTime,
				verticalDragDirection,
			});
			dragDropTarget.value = dropTarget?.isNewTrack ? dropTarget : null;
		}
	}

	// Mouse up handler for active drag
	function onMouseUp(event: MouseEvent) {
		const { clientX, clientY } = event;
		const ds = dragState.value;

		if (!ds.elementId || !ds.trackId) return;

		if (mouseDownLocation) {
			const deltaX = Math.abs(clientX - mouseDownLocation.x);
			const deltaY = Math.abs(clientY - mouseDownLocation.y);
			if (deltaX <= DRAG_THRESHOLD_PX && deltaY <= DRAG_THRESHOLD_PX) {
				mouseDownLocation = null;
				dragState.value = { ...initialDragState };
				dragDropTarget.value = null;
				onSnapPointChange?.(null);
				return;
			}
		}

		const dropTarget = getDragDropTarget({
			clientX,
			clientY,
			elementId: ds.elementId,
			trackId: ds.trackId,
			currentTracks: tracks.value,
			snappedTime: ds.currentTime,
			verticalDragDirection: getVerticalDragDirection({
				startMouseY: ds.startMouseY,
				currentMouseY: clientY,
			}),
		});

		if (!dropTarget) {
			dragState.value = { ...initialDragState };
			dragDropTarget.value = null;
			onSnapPointChange?.(null);
			return;
		}

		const snappedTime = ds.currentTime;
		const sourceTrack = tracks.value.find(({ id }) => id === ds.trackId);
		if (!sourceTrack) {
			dragState.value = { ...initialDragState };
			dragDropTarget.value = null;
			onSnapPointChange?.(null);
			return;
		}

		if (dropTarget.isNewTrack) {
			const newTrackId = generateUUID();
			editor.timeline.moveElement({
				sourceTrackId: ds.trackId,
				targetTrackId: newTrackId,
				elementId: ds.elementId,
				newStartTime: snappedTime,
				createTrack: { type: sourceTrack.type, index: dropTarget.trackIndex },
			});
		} else {
			const targetTrack = tracks.value[dropTarget.trackIndex];
			if (targetTrack) {
				editor.timeline.moveElement({
					sourceTrackId: ds.trackId,
					targetTrackId: targetTrack.id,
					elementId: ds.elementId,
					newStartTime: snappedTime,
				});
			}
		}

		dragState.value = { ...initialDragState };
		dragDropTarget.value = null;
		onSnapPointChange?.(null);
	}

	// Pending drag mouse up (cancel pending)
	function onPendingMouseUp() {
		pendingDrag = null;
		isPendingDrag.value = false;
		onSnapPointChange?.(null);
	}

	// Watch drag/pending state to attach/detach global listeners
	let cleanupDrag: (() => void) | null = null;
	let cleanupPending: (() => void) | null = null;

	watch([() => dragState.value.isDragging, isPendingDrag], ([dragging, pending]) => {
		// Clean up previous
		cleanupDrag?.();
		cleanupDrag = null;
		cleanupPending?.();
		cleanupPending = null;

		if (dragging || pending) {
			document.addEventListener("mousemove", onMouseMove);
			const removeMM = () => document.removeEventListener("mousemove", onMouseMove);

			if (dragging) {
				document.addEventListener("mouseup", onMouseUp);
				cleanupDrag = () => {
					removeMM();
					document.removeEventListener("mouseup", onMouseUp);
				};
			}

			if (pending && !dragging) {
				document.addEventListener("mouseup", onPendingMouseUp);
				cleanupPending = () => {
					removeMM();
					document.removeEventListener("mouseup", onPendingMouseUp);
				};
			}
		}
	});

	onUnmounted(() => {
		cleanupDrag?.();
		cleanupPending?.();
	});

	function handleElementMouseDown({
		event,
		element,
		track,
	}: {
		event: MouseEvent;
		element: TimelineElement;
		track: TimelineTrack;
	}) {
		const isRightClick = event.button === 2;

		if (isRightClick) {
			const alreadySelected = isElementSelected({ trackId: track.id, elementId: element.id });
			if (!alreadySelected) {
				handleSelectionClick({ trackId: track.id, elementId: element.id, isMultiKey: false });
			}
			return;
		}

		event.stopPropagation();
		mouseDownLocation = { x: event.clientX, y: event.clientY };

		const isMultiSelect = event.metaKey || event.ctrlKey || event.shiftKey;
		if (isMultiSelect) {
			handleSelectionClick({ trackId: track.id, elementId: element.id, isMultiKey: true });
		}

		const clickOffset = getClickOffsetTime({
			clientX: event.clientX,
			elementRect: (event.currentTarget as HTMLElement).getBoundingClientRect(),
			zoomLevel: zoomLevel.value,
		});

		pendingDrag = {
			elementId: element.id,
			trackId: track.id,
			startMouseX: event.clientX,
			startMouseY: event.clientY,
			startElementTime: element.startTime,
			clickOffsetTime: clickOffset,
		};
		isPendingDrag.value = true;
	}

	function handleElementClick({
		event,
		element,
		track,
	}: {
		event: MouseEvent;
		element: TimelineElement;
		track: TimelineTrack;
	}) {
		event.stopPropagation();

		if (mouseDownLocation) {
			const deltaX = Math.abs(event.clientX - mouseDownLocation.x);
			const deltaY = Math.abs(event.clientY - mouseDownLocation.y);
			if (deltaX > DRAG_THRESHOLD_PX || deltaY > DRAG_THRESHOLD_PX) {
				mouseDownLocation = null;
				return;
			}
		}

		if (event.metaKey || event.ctrlKey || event.shiftKey) return;

		const alreadySelected = isElementSelected({ trackId: track.id, elementId: element.id });
		if (!alreadySelected) {
			selectElement({ trackId: track.id, elementId: element.id });
		}
	}

	return {
		dragState,
		dragDropTarget,
		handleElementMouseDown,
		handleElementClick,
		getLastMouseX: () => lastMouseX,
	};
}
