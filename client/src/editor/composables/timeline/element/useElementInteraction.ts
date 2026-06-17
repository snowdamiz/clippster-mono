/**
 * Vue composable equivalent of OpenCut's use-element-interaction.ts
 * Handles drag-and-drop of timeline elements between tracks.
 *
 * Performance contract (rewritten for the timeline-perf-polish refactor):
 * - `mousemove` only stores raw cursor coords; the actual snap/drop/state
 *   work runs at most once per animation frame via {@link useDragRaf}.
 * - The snap-point index (sorted Float64Array) is built **once** at drag
 *   start and binary-searched per frame. No per-frame O(N×M) allocation.
 * - The dragged element is selected at `mousedown` if it wasn't already.
 *   Selection state is **never** mutated during a drag (the previous
 *   implementation called `selectElement` from inside `mousemove`, which
 *   triggered selection-store re-renders mid-drag).
 * - `dragState` is still a `shallowRef` so external consumers can read
 *   `.isDragging` etc., but it is updated only from the rAF callback —
 *   never directly from the high-frequency `mousemove`.
 */
import { shallowRef, watch, onUnmounted, type Ref } from "vue";
import { EditorCore } from "../../../core";
import { useElementSelection } from "./useElementSelection";
import { useTimelineTracks } from "../useTimelineTracks";
import { useDragRaf } from "../useDragRaf";
import { createDragDomController } from "./useDragDomController";
import { TIMELINE_CONSTANTS, VIDEO_TIMELINE_WAVEFORM_HEIGHT_PCT } from "../../../constants/timeline-constants";
import { computeDropTarget } from "../../../lib/timeline/drop-utils";
import { isMainTrack } from "../../../lib/timeline/track-utils";
import { generateUUID } from "../../../utils/id";
import {
	useTimelineSnapping,
	type SnapPoint,
	type SnapIndex,
} from "../useTimelineSnapping";
import type {
	DropTarget,
	ElementDragState,
	TimelineElement,
	TimelineTrack,
} from "../../../types/timeline";

/**
 * Distance the cursor must travel before a `mousedown` becomes a drag.
 * Slightly larger than the previous 5px to give CapCut/Resolve-style
 * "tap-and-hold-still" tolerance.
 */
const DRAG_THRESHOLD_PX = 6;

/**
 * Magnetic same-track snap radius in pixels. Same value as before; tracked
 * here so it is co-located with the threshold above.
 */
const MAGNETIC_THRESHOLD_PX = 15;

interface UseElementInteractionProps {
	zoomLevel: Ref<number>;
	timelineRef: Ref<HTMLDivElement | null>;
	tracksContainerRef: Ref<HTMLDivElement | null>;
	tracksScrollRef: Ref<HTMLDivElement | null>;
	headerRef?: Ref<HTMLElement | null>;
	/** Same padding used by track rows (`getTrackTopWithInsertGap`) — required for correct Y hit-testing when zoomed / vertically centered. */
	tracksVerticalOffset?: Ref<number>;
	snappingEnabled: Ref<boolean>;
	onSnapPointChange?: (snapPoint: SnapPoint | null) => void;
}

/** Sole full-width media clip on the main timeline row — stays at t=0 and cannot change tracks. */
function isMainTrackSolePrimaryMediaClip(track: TimelineTrack, element: TimelineElement): boolean {
	return (
		isMainTrack(track) &&
		track.elements.length === 1 &&
		(element.type === "video" || element.type === "image")
	);
}

/**
 * Clicks on the linked-audio waveform strip should not start a move drag;
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

	// Audio: volume envelope handles use @pointerdown.stop on their SVG strip.
	// Allow dragging from anywhere on the clip (unlike video, where the bottom
	// waveform strip is reserved for volume keyframes on linked audio).
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
	/** Cached snap index built at mousedown, reused for the lifetime of the drag. */
	snapIndex: SnapIndex;
	/** Map of trackId → list of (start, end, elementId) used for magnetic same-track snap. */
	magneticByTrack: Map<string, { start: number; end: number; id: string }[]>;
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
	tracksVerticalOffset,
	snappingEnabled,
	onSnapPointChange,
}: UseElementInteractionProps) {
	const editor = EditorCore.getInstance();
	const { tracks } = useTimelineTracks();
	const { buildSnapIndex, snapToIndex } = useTimelineSnapping();
	const {
		isElementSelected,
		selectElement,
		selectedElements,
		handleElementClick: handleSelectionClick,
	} = useElementSelection();
	const dragRaf = useDragRaf();
	const dragDom = createDragDomController();

	// `shallowRef` so consumers like Timeline.vue / TimelineElement.vue see
	// updates as a single object replacement per frame — no deep tracking.
	const dragState = shallowRef<ElementDragState>({ ...initialDragState });
	const dragDropTarget = shallowRef<DropTarget | null>(null);
	const isPendingDrag = shallowRef(false);

	// Mutable hot-path state: never assigned to a Vue ref except inside the
	// rAF callback, which produces a single state replacement per frame.
	let pendingDrag: PendingDragState | null = null;
	let lastMouseX = 0;
	let lastMouseY = 0;
	let mouseDownLocation: { x: number; y: number } | null = null;
	let dragSnapCache: PendingDragState | null = null;
	let dragStartTimeValue = 0;
	let dragStartMouseY = 0;

	function buildMagneticByTrack(currentTracks: TimelineTrack[], excludeId: string): Map<string, { start: number; end: number; id: string }[]> {
		const map = new Map<string, { start: number; end: number; id: string }[]>();
		for (const track of currentTracks) {
			const arr: { start: number; end: number; id: string }[] = [];
			for (const el of track.elements) {
				if (el.id === excludeId) continue;
				arr.push({ start: el.startTime, end: el.startTime + el.duration, id: el.id });
			}
			map.set(track.id, arr);
		}
		return map;
	}

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
		const vPad = tracksVerticalOffset?.value ?? 0;
		const mouseX = clientX - scrollContainerRect.left + scrollLeft;
		const mouseY = clientY - scrollContainerRect.top + scrollTop - headerHeight - vPad;

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
		cache,
	}: {
		frameSnappedTime: number;
		movingElement: TimelineElement | null | undefined;
		sourceTrackId?: string;
		cache: PendingDragState;
	}): { snappedTime: number; snapPoint: SnapPoint | null } {
		if (!snappingEnabled.value || !movingElement) {
			return { snappedTime: frameSnappedTime, snapPoint: null };
		}

		const elementDuration = movingElement.duration;
		const pixelsPerSecond = TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel.value;
		const magneticThresholdSec = MAGNETIC_THRESHOLD_PX / pixelsPerSecond;

		// Magnetic same-track snap: stronger pull when near a neighbor on the same track.
		// Uses the cached neighbor list — no per-frame iteration over all tracks.
		if (sourceTrackId) {
			const neighbors = cache.magneticByTrack.get(sourceTrackId);
			if (neighbors) {
				let bestMagneticSnap: { time: number; snapPoint: SnapPoint; distance: number } | null = null;
				for (const neighbor of neighbors) {
					const startDist = Math.abs(frameSnappedTime - neighbor.end);
					if (startDist < magneticThresholdSec && (!bestMagneticSnap || startDist < bestMagneticSnap.distance)) {
						bestMagneticSnap = {
							time: neighbor.end,
							snapPoint: { time: neighbor.end, type: "element-end", elementId: neighbor.id, trackId: sourceTrackId },
							distance: startDist,
						};
					}
					const endDist = Math.abs((frameSnappedTime + elementDuration) - neighbor.start);
					if (endDist < magneticThresholdSec && (!bestMagneticSnap || endDist < bestMagneticSnap.distance)) {
						bestMagneticSnap = {
							time: neighbor.start - elementDuration,
							snapPoint: { time: neighbor.start, type: "element-start", elementId: neighbor.id, trackId: sourceTrackId },
							distance: endDist,
						};
					}
				}
				if (bestMagneticSnap) {
					return { snappedTime: bestMagneticSnap.time, snapPoint: bestMagneticSnap.snapPoint };
				}
			}
		}

		// Standard cross-track edge snapping via the cached sorted index.
		// Compare both the start-edge and end-edge of the dragged element and
		// keep whichever is closer.
		const startSnap = snapToIndex({
			targetTime: frameSnappedTime,
			index: cache.snapIndex,
			zoomLevel: zoomLevel.value,
		});

		const endSnap = snapToIndex({
			targetTime: frameSnappedTime + elementDuration,
			index: cache.snapIndex,
			zoomLevel: zoomLevel.value,
		});

		// Choose the better of the two; the end-edge candidate snaps the element
		// such that its trailing edge meets the snap point.
		const startBetter = startSnap.snapPoint && (!endSnap.snapPoint || startSnap.snapDistance <= endSnap.snapDistance);
		if (startBetter && startSnap.snapPoint) {
			return { snappedTime: startSnap.snappedTime, snapPoint: startSnap.snapPoint };
		}
		if (endSnap.snapPoint) {
			return {
				snappedTime: endSnap.snappedTime - elementDuration,
				snapPoint: endSnap.snapPoint,
			};
		}
		return { snappedTime: frameSnappedTime, snapPoint: null };
	}

	/** rAF-coalesced: process the latest cursor position. */
	function flushDragFrame() {
		const clientX = lastMouseX;
		const clientY = lastMouseY;

		const timeline = timelineRef.value;
		const scrollContainer = tracksScrollRef.value;
		if (!timeline || !scrollContainer) return;

		// Promote pending drag to active drag once threshold is exceeded.
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
				dragSnapCache = drag;
				dragStartTimeValue = drag.startElementTime;
				dragStartMouseY = drag.startMouseY;
				// Activate the GPU-composited drag visual on every selected element.
				const ids = collectDragElementIds(drag.elementId);
				dragDom.begin(ids, tracksScrollRef.value);
				applyDragDomOffsets(adjustedTime, drag.startElementTime, currentMouseY, drag.startMouseY);
				pendingDrag = null;
				isPendingDrag.value = false;
				return;
			}
			// Below threshold this frame; nothing to update yet.
			return;
		}

		const ds = dragState.value;
		if (!ds.isDragging || !ds.elementId || !ds.trackId || !dragSnapCache) return;

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
		const { snappedTime, snapPoint } = getDragSnapResult({
			frameSnappedTime,
			movingElement,
			sourceTrackId: ds.trackId ?? undefined,
			cache: dragSnapCache,
		});

		if (sourceTrack && movingElement && isMainTrackSolePrimaryMediaClip(sourceTrack, movingElement)) {
			dragState.value = { ...ds, currentTime: 0, currentMouseY: ds.startMouseY };
			dragDropTarget.value = null;
			applyDragDomOffsets(0, dragStartTimeValue, ds.startMouseY, dragStartMouseY);
			onSnapPointChange?.(null);
			return;
		}

		dragState.value = { ...ds, currentTime: snappedTime, currentMouseY: clientY };
		applyDragDomOffsets(snappedTime, dragStartTimeValue, clientY, dragStartMouseY);
		onSnapPointChange?.(snapPoint);

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
		dragDropTarget.value = dropTarget;
	}

	/**
	 * Pushes the latest drag offsets into the DOM controller. We compute X
	 * from the snapped time vs. the committed start time so the element
	 * visually anchors to the snap point even though Vue still renders it
	 * at its original `left`.
	 */
	function applyDragDomOffsets(currentTime: number, startTimeValue: number, currentMouseY: number, startMouseY: number) {
		const dx = (currentTime - startTimeValue) * TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel.value;
		const dy = currentMouseY - startMouseY;
		dragDom.update(dx, dy);
	}

	/**
	 * Returns the set of element ids that visually follow the drag.
	 * For a single-selection drag that's just the dragged id; for a
	 * multi-selection drag it's every selected element across all tracks.
	 */
	function collectDragElementIds(anchorId: string): Iterable<string> {
		const live = selectedElements.value;
		if (live.length <= 1) return [anchorId];
		const ids = new Set<string>([anchorId]);
		for (const sel of live) ids.add(sel.elementId);
		return ids;
	}

	function onMouseMove(event: MouseEvent) {
		lastMouseX = event.clientX;
		lastMouseY = event.clientY;
		dragRaf.schedule(flushDragFrame);
	}

	// Mouse up handler for active drag
	function onMouseUp(event: MouseEvent) {
		// Make sure any pending rAF work runs against the latest coords first.
		dragRaf.flush();

		const { clientX, clientY } = event;
		const ds = dragState.value;

		if (!ds.elementId || !ds.trackId) return;

		const sourceTrackEarly = tracks.value.find(({ id }) => id === ds.trackId);
		const movingElEarly = sourceTrackEarly?.elements.find(({ id }) => id === ds.elementId);
		if (sourceTrackEarly && movingElEarly && isMainTrackSolePrimaryMediaClip(sourceTrackEarly, movingElEarly)) {
			resetDragVisual();
			mouseDownLocation = null;
			return;
		}

		if (mouseDownLocation) {
			const deltaX = Math.abs(clientX - mouseDownLocation.x);
			const deltaY = Math.abs(clientY - mouseDownLocation.y);
			if (deltaX <= DRAG_THRESHOLD_PX && deltaY <= DRAG_THRESHOLD_PX) {
				mouseDownLocation = null;
				resetDragVisual();
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
			resetDragVisual();
			return;
		}

		const snappedTime = ds.currentTime;
		const sourceTrack = tracks.value.find(({ id }) => id === ds.trackId);
		if (!sourceTrack) {
			resetDragVisual();
			return;
		}

		const timeDelta = snappedTime - ds.startElementTime;

		// Multi-select drag: move all selected elements across all tracks by the same delta.
		const liveSelected = selectedElements.value;
		if (liveSelected.length > 1 && !dropTarget.isNewTrack) {
			const byTrack = new Map<string, string[]>();
			for (const sel of liveSelected) {
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

		resetDragVisual();
	}

	/** Clears the in-flight drag state and the GPU drag visual in one place. */
	function resetDragVisual() {
		dragDom.end();
		dragState.value = { ...initialDragState };
		dragDropTarget.value = null;
		dragSnapCache = null;
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
	function onPendingMouseUp(event: MouseEvent) {
		dragRaf.flush();
		if (dragState.value.isDragging) {
			onMouseUp(event);
			return;
		}
		pendingDrag = null;
		isPendingDrag.value = false;
		// No drag DOM to tear down because the drag never started.
		onSnapPointChange?.(null);
	}

	// Watch drag/pending state to attach/detach global listeners
	let cleanupDrag: (() => void) | null = null;
	let cleanupPending: (() => void) | null = null;
	const dragEndListenerOptions: AddEventListenerOptions = { capture: true };

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
				document.addEventListener("mouseup", onMouseUp, dragEndListenerOptions);
				cleanupDrag = () => {
					removeMM();
					document.removeEventListener("mouseup", onMouseUp, dragEndListenerOptions);
				};
			}

			if (pending && !dragging) {
				document.addEventListener("mouseup", onPendingMouseUp, dragEndListenerOptions);
				cleanupPending = () => {
					removeMM();
					document.removeEventListener("mouseup", onPendingMouseUp, dragEndListenerOptions);
				};
			}
		}
	});

	onUnmounted(() => {
		cleanupDrag?.();
		cleanupPending?.();
		dragDom.end();
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

		if (isMultiSelect) {
			handleSelectionClick({ trackId: track.id, elementId: element.id, isMultiKey: true, isAltKey: event.altKey, isShiftKey: event.shiftKey });
		} else if (!alreadySelected) {
			// Only select this single element if it wasn't already selected.
			// If it IS already selected (e.g. part of a track-wide selection),
			// keep the multi-selection intact so dragging moves them all.
			selectElement({ trackId: track.id, elementId: element.id });
		}

		// Video waveform strip: volume keyframes only — no move drag. Sole main clip: fixed in place.
		if (shouldSuppressTimelineElementDragStart(event, element, track) || isMainTrackSolePrimaryMediaClip(track, element)) {
			return;
		}

		mouseDownLocation = { x: event.clientX, y: event.clientY };

		const clickOffset = getClickOffsetTime({
			clientX: event.clientX,
			elementRect: (event.currentTarget as HTMLElement).getBoundingClientRect(),
			zoomLevel: zoomLevel.value,
		});

		// Build the snap index ONCE per drag — reused on every rAF tick.
		const snapshotTracks = tracks.value;
		const snapIndex = buildSnapIndex({
			tracks: snapshotTracks,
			playheadTime: editor.playback.getCurrentTime(),
			excludeElementId: element.id,
		});
		const magneticByTrack = buildMagneticByTrack(snapshotTracks, element.id);

		pendingDrag = {
			elementId: element.id,
			trackId: track.id,
			startMouseX: event.clientX,
			startMouseY: event.clientY,
			startElementTime: element.startTime,
			clickOffsetTime: clickOffset,
			snapIndex,
			magneticByTrack,
		};
		lastMouseX = event.clientX;
		lastMouseY = event.clientY;
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

		// On plain click (no drag), collapse to single element selection.
		// This handles: clicking an unselected element, or clicking one element
		// in a multi-selection to narrow it down to just that element.
		// Note (UX): clicking a clip never moves the playhead — that is left
		// to ruler/empty-area clicks, matching DaVinci Resolve / CapCut.
		selectElement({ trackId: track.id, elementId: element.id });
	}

	return {
		dragState,
		dragDropTarget,
		handleElementMouseDown,
		handleElementClick,
		getLastMouseX: () => lastMouseX,
	};
}

