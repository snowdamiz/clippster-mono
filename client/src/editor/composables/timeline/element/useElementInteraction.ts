/**
 * Vue composable equivalent of OpenCut's use-element-interaction.ts
 * Handles drag-and-drop of timeline elements between tracks.
 */
import { ref, watch, onUnmounted, computed, type Ref } from "vue";
import { useEditor } from "../../useEditor";
import { useElementSelection } from "./useElementSelection";
import { TIMELINE_CONSTANTS, VIDEO_TIMELINE_WAVEFORM_HEIGHT_PCT } from "../../../constants/timeline-constants";
import { computeDropTarget } from "../../../lib/timeline/drop-utils";
import { isMainTrack } from "../../../lib/timeline/track-utils";
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

const TITLE_BAR_PX = 16;

/** Sole full-width media clip on the main timeline row — stays at t=0 and cannot change tracks. */
function isMainTrackSolePrimaryMediaClip(track: TimelineTrack, element: TimelineElement): boolean {
	return (
		isMainTrack(track) &&
		track.elements.length === 1 &&
		(element.type === "video" || element.type === "image")
	);
}

/**
 * Clicks on the linked-audio waveform strip (or audio-only waveform) should not start a move drag;
 * use the title bar or filmstrip / thumbnail area instead.
 */
function shouldSuppressTimelineElementDragStart(
	event: MouseEvent,
	element: TimelineElement,
	_track: TimelineTrack,
): boolean {
	const current = event.currentTarget as HTMLElement | null;
	if (!current || event.button !== 0) return false;
	const rect = current.getBoundingClientRect();
	const y = event.clientY - rect.top;
	const h = rect.height;
	if (h <= 0) return false;

	if (element.type === "audio") {
		return y > TITLE_BAR_PX;
	}

	if (element.type === "video" || element.type === "image") {
		const wfFrac = VIDEO_TIMELINE_WAVEFORM_HEIGHT_PCT / 100;
		const waveformTop = h * (1 - wfFrac);
		return y >= waveformTop - 1;
	}

	return false;
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
		selectedElements,
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
	let wasAlreadySelectedOnMouseDown = false;

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
		sourceTrackId,
	}: {
		frameSnappedTime: number;
		movingElement: TimelineElement | null | undefined;
		sourceTrackId?: string;
	}) {
		if (!snappingEnabled.value || !movingElement) {
			return { snappedTime: frameSnappedTime, snapPoint: null };
		}

		const elementDuration = movingElement.duration;
		const playheadTime = editor.playback.getCurrentTime();

		// Magnetic same-track snap: stronger pull when near a neighbor on the same track
		const MAGNETIC_THRESHOLD_PX = 15;
		const pixelsPerSecond = TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel.value;
		const magneticThresholdSec = MAGNETIC_THRESHOLD_PX / pixelsPerSecond;

		if (sourceTrackId) {
			const sourceTrack = tracks.value.find((t) => t.id === sourceTrackId);
			if (sourceTrack) {
				let bestMagneticSnap: { time: number; snapPoint: SnapPoint; distance: number } | null = null;
				for (const neighbor of sourceTrack.elements) {
					if (neighbor.id === movingElement.id) continue;
					const neighborEnd = neighbor.startTime + neighbor.duration;
					const neighborStart = neighbor.startTime;

					// Dragged element start → neighbor end (close gap on left)
					const startDist = Math.abs(frameSnappedTime - neighborEnd);
					if (startDist < magneticThresholdSec && (!bestMagneticSnap || startDist < bestMagneticSnap.distance)) {
						bestMagneticSnap = {
							time: neighborEnd,
							snapPoint: { time: neighborEnd, type: "element-end", elementId: neighbor.id, trackId: sourceTrackId },
							distance: startDist,
						};
					}

					// Dragged element end → neighbor start (close gap on right)
					const endDist = Math.abs((frameSnappedTime + elementDuration) - neighborStart);
					if (endDist < magneticThresholdSec && (!bestMagneticSnap || endDist < bestMagneticSnap.distance)) {
						bestMagneticSnap = {
							time: neighborStart - elementDuration,
							snapPoint: { time: neighborStart, type: "element-start", elementId: neighbor.id, trackId: sourceTrackId },
							distance: endDist,
						};
					}
				}

				if (bestMagneticSnap) {
					return { snappedTime: bestMagneticSnap.time, snapPoint: bestMagneticSnap.snapPoint };
				}
			}
		}

		// Standard cross-track edge snapping
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
			const drag = pendingDrag;
			const deltaX = Math.abs(clientX - drag.startMouseX);
			const deltaY = Math.abs(clientY - drag.startMouseY);
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
				let adjustedTime = Math.max(0, mouseTime - drag.clickOffsetTime);
				let currentMouseY = clientY;
				const srcTr = tracks.value.find((t) => t.id === drag.trackId);
				const movEl = srcTr?.elements.find((e) => e.id === drag.elementId);
				if (srcTr && movEl && isMainTrackSolePrimaryMediaClip(srcTr, movEl)) {
					adjustedTime = 0;
					currentMouseY = drag.startMouseY;
				}

				dragState.value = {
					isDragging: true,
					elementId: drag.elementId,
					trackId: drag.trackId,
					startMouseX: drag.startMouseX,
					startMouseY: drag.startMouseY,
					startElementTime: drag.startElementTime,
					clickOffsetTime: drag.clickOffsetTime,
					currentTime: adjustedTime,
					currentMouseY,
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
		const frameSnappedTime = adjustedTime;

		const sourceTrack = tracks.value.find(({ id }) => id === ds.trackId);
		const movingElement = sourceTrack?.elements.find(({ id }) => id === ds.elementId);
		const { snappedTime, snapPoint } = getDragSnapResult({ frameSnappedTime, movingElement, sourceTrackId: ds.trackId ?? undefined });

		if (sourceTrack && movingElement && isMainTrackSolePrimaryMediaClip(sourceTrack, movingElement)) {
			dragState.value = { ...ds, currentTime: 0, currentMouseY: ds.startMouseY };
			dragDropTarget.value = null;
			onSnapPointChange?.(null);
			return;
		}

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

		const sourceTrackEarly = tracks.value.find(({ id }) => id === ds.trackId);
		const movingElEarly = sourceTrackEarly?.elements.find(({ id }) => id === ds.elementId);
		if (sourceTrackEarly && movingElEarly && isMainTrackSolePrimaryMediaClip(sourceTrackEarly, movingElEarly)) {
			dragState.value = { ...initialDragState };
			dragDropTarget.value = null;
			mouseDownLocation = null;
			onSnapPointChange?.(null);
			return;
		}

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

		const timeDelta = snappedTime - ds.startElementTime;

		// Multi-select drag: move all selected elements across all tracks by the same delta
		if (selectedElements.value.length > 1 && !dropTarget.isNewTrack) {
			// Group selected elements by track
			const byTrack = new Map<string, string[]>();
			for (const sel of selectedElements.value) {
				const arr = byTrack.get(sel.trackId) ?? [];
				arr.push(sel.elementId);
				byTrack.set(sel.trackId, arr);
			}
			for (const [trackId, elementIds] of byTrack) {
				editor.timeline.moveElementsBatch({ trackId, elementIds, timeDelta });
			}
		} else if (dropTarget.isNewTrack) {
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

		// Sync linked element (e.g. extracted audio ↔ source video)
		syncLinkedElement(ds.elementId, ds.trackId, timeDelta);

		dragState.value = { ...initialDragState };
		dragDropTarget.value = null;
		onSnapPointChange?.(null);
	}

	function syncLinkedElement(elementId: string, trackId: string, timeDelta: number) {
		if (timeDelta === 0) return;
		const currentTracks = editor.timeline.getTracks();
		const srcTrack = currentTracks.find((t) => t.id === trackId);
		const srcEl = srcTrack?.elements.find((e) => e.id === elementId);
		const linkedId = srcEl?.linkedElementId;
		if (!linkedId) return;

		for (const track of currentTracks) {
			const linkedEl = track.elements.find((e) => e.id === linkedId);
			if (linkedEl) {
				editor.timeline.moveElementsBatch({
					trackId: track.id,
					elementIds: [linkedId],
					timeDelta,
				});
				break;
			}
		}
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

		// Prevent drag on locked tracks (still allow selection)
		if (track.locked) {
			handleSelectionClick({ trackId: track.id, elementId: element.id, isMultiKey: event.metaKey || event.ctrlKey || event.shiftKey });
			return;
		}

		event.stopPropagation();

		const isMultiSelect = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
		const alreadySelected = isElementSelected({ trackId: track.id, elementId: element.id });
		wasAlreadySelectedOnMouseDown = alreadySelected;

		if (isMultiSelect) {
			handleSelectionClick({ trackId: track.id, elementId: element.id, isMultiKey: true, isAltKey: event.altKey, isShiftKey: event.shiftKey });
		} else if (!alreadySelected) {
			// Only select this single element if it wasn't already selected.
			// If it IS already selected (e.g. part of a track-wide selection),
			// keep the multi-selection intact so dragging moves them all.
			selectElement({ trackId: track.id, elementId: element.id });
		}

		// Waveform strip: volume editing / inspection only — no move drag. Sole main clip: fixed in place.
		if (shouldSuppressTimelineElementDragStart(event, element, track) || isMainTrackSolePrimaryMediaClip(track, element)) {
			return;
		}

		mouseDownLocation = { x: event.clientX, y: event.clientY };

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

		// On plain click (no drag), always collapse to single element selection.
		// This handles: clicking an unselected element, or clicking one element
		// in a multi-selection to narrow it down to just that element.
		selectElement({ trackId: track.id, elementId: element.id });

		// If the element was already selected before this click, seek the playhead
		// to the click position (like clicking empty track area).
		if (wasAlreadySelectedOnMouseDown) {
			const scrollContainer = tracksScrollRef.value;
			if (scrollContainer) {
				const containerRect = scrollContainer.getBoundingClientRect();
				const clickTime = getMouseTimeFromClientX({
					clientX: event.clientX,
					containerRect,
					zoomLevel: zoomLevel.value,
					scrollLeft: scrollContainer.scrollLeft,
				});
				editor.playback.seek({ time: clickTime });
			}
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
