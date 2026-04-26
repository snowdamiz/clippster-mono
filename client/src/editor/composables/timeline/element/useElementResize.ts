/**
 * Vue composable equivalent of OpenCut's use-element-resize.ts
 * Handles resizing (trimming) timeline elements from left/right edges.
 */
import { ref, watch, onUnmounted, type Ref } from "vue";
import type { TimelineElement, TimelineTrack } from "../../../types/timeline";
import { snapTimeToFrame } from "../../../lib/time"; // used in handleResizeEnd for final commit
import { EditorCore } from "../../../core";
import { useTimelineSnapping, type SnapPoint } from "../useTimelineSnapping";
import { getMainTrackMagnet } from "../useTimelineTools";

/**
 * While trimming an element's **right** edge on a track, exclude same-track `element-end`
 * snap targets. Snapping the out-handle to another clip's far end pulls the trim across
 * the entire neighbor clip (and subsequent ripple pushes everything to the timeline end).
 */
function filterSnapPointsForRightTrimResize(
	snapPoints: SnapPoint[],
	resizingTrackId: string,
): SnapPoint[] {
	return snapPoints.filter((sp) => {
		if (sp.type !== "element-end") return true;
		return sp.trackId !== resizingTrackId;
	});
}

export interface ResizeState {
	elementId: string;
	side: "left" | "right";
	startX: number;
	initialTrimStart: number;
	initialTrimEnd: number;
	initialStartTime: number;
	initialDuration: number;
}

interface UseTimelineElementResizeProps {
	element: Ref<TimelineElement>;
	track: Ref<TimelineTrack>;
	zoomLevel: Ref<number>;
	snappingEnabled: Ref<boolean>;
	onSnapPointChange?: (snapPoint: SnapPoint | null) => void;
	onResizeStateChange?: (params: { isResizing: boolean }) => void;
}

export function useTimelineElementResize({
	element,
	track,
	zoomLevel,
	snappingEnabled,
	onSnapPointChange,
	onResizeStateChange,
}: UseTimelineElementResizeProps) {
	const editor = EditorCore.getInstance();
	const { findSnapPoints, snapToNearestPoint } = useTimelineSnapping();

	const resizing = ref<ResizeState | null>(null);
	const currentTrimStart = ref(0);
	const currentTrimEnd = ref(0);
	const currentStartTime = ref(0);
	const currentDuration = ref(0);
	const rippleShifts = ref<Map<string, number>>(new Map());

	// Use plain vars for refs that don't need reactivity (perf)
	let trimStartVal = 0;
	let trimEndVal = 0;
	let startTimeVal = 0;
	let durationVal = 0;

	function canExtendElementDuration(): boolean {
		const t = element.value.type;
		return t === "text" || t === "image" || t === "effect" || t === "sticker" || t === "caption";
	}

	function handleResizeStart({
		e,
		elementId,
		side,
	}: {
		e: MouseEvent;
		elementId: string;
		side: "left" | "right";
	}) {
		e.stopPropagation();
		e.preventDefault();

		// Prevent resize on locked tracks
		if (track.value.locked) return;

		const el = element.value;
		resizing.value = {
			elementId,
			side,
			startX: e.clientX,
			initialTrimStart: el.trimStart,
			initialTrimEnd: el.trimEnd,
			initialStartTime: el.startTime,
			initialDuration: el.duration,
		};

		currentTrimStart.value = trimStartVal = el.trimStart;
		currentTrimEnd.value = trimEndVal = el.trimEnd;
		currentStartTime.value = startTimeVal = el.startTime;
		currentDuration.value = durationVal = el.duration;
		onResizeStateChange?.({ isResizing: true });
	}

	function getPreviousElementEnd(): number {
		const els = track.value.elements;
		const currentEl = element.value;
		let prevEnd = 0;
		for (const el of els) {
			if (el.id === currentEl.id) continue;
			const elEnd = el.startTime + el.duration;
			if (elEnd <= currentEl.startTime + 0.001 && elEnd > prevEnd) {
				prevEnd = elEnd;
			}
		}
		return prevEnd;
	}

	function updateTrimFromMouseMove(clientX: number) {
		const rs = resizing.value;
		if (!rs) return;

		// Use a very small minimum so the user can trim as finely as they want.
		// Frame-snapping only happens on commit (handleResizeEnd), not during drag.
		const minDurationSeconds = 0.01;

		const deltaX = clientX - rs.startX;
		let deltaTime = deltaX / (50 * zoomLevel.value);
		let resizeSnapPoint: SnapPoint | null = null;

		if (snappingEnabled.value) {
			const tracks = editor.timeline.getTracks();
			const playheadTime = editor.playback.getCurrentTime();
			let snapPoints = findSnapPoints({ tracks, playheadTime, excludeElementId: element.value.id });
			if (rs.side === "right") {
				snapPoints = filterSnapPointsForRightTrimResize(snapPoints, track.value.id);
			}

			if (rs.side === "left") {
				const targetStartTime = rs.initialStartTime + deltaTime;
				const snapResult = snapToNearestPoint({ targetTime: targetStartTime, snapPoints, zoomLevel: zoomLevel.value });
				resizeSnapPoint = snapResult.snapPoint;
				if (snapResult.snapPoint) {
					deltaTime = snapResult.snappedTime - rs.initialStartTime;
				}
			} else {
				const baseEndTime = rs.initialStartTime + rs.initialDuration;
				const targetEndTime = baseEndTime + deltaTime;
				const snapResult = snapToNearestPoint({ targetTime: targetEndTime, snapPoints, zoomLevel: zoomLevel.value });
				resizeSnapPoint = snapResult.snapPoint;
				if (snapResult.snapPoint) {
					deltaTime = snapResult.snappedTime - baseEndTime;
				}
			}
		}
		onSnapPointChange?.(resizeSnapPoint);

		if (rs.side === "left") {
			const sourceDuration = rs.initialTrimStart + rs.initialDuration + rs.initialTrimEnd;
			const maxAllowed = sourceDuration - rs.initialTrimEnd - minDurationSeconds;
			const calculated = rs.initialTrimStart + deltaTime;
			const prevEnd = getPreviousElementEnd();

			if (calculated >= 0 && calculated <= maxAllowed) {
				const newTrimStart = Math.min(maxAllowed, calculated);
				const trimDelta = newTrimStart - rs.initialTrimStart;
				let newStartTime = rs.initialStartTime + trimDelta;
				let newDuration = rs.initialDuration - trimDelta;

				// Clamp: don't extend past previous element
				if (newStartTime < prevEnd) {
					const clampedDelta = rs.initialStartTime - prevEnd;
					newStartTime = prevEnd;
					newDuration = rs.initialDuration + clampedDelta;
					currentTrimStart.value = trimStartVal = rs.initialTrimStart - clampedDelta;
				} else {
					currentTrimStart.value = trimStartVal = newTrimStart;
				}
				currentStartTime.value = startTimeVal = newStartTime;
				currentDuration.value = durationVal = newDuration;
			} else if (calculated < 0) {
				if (canExtendElementDuration()) {
					const extensionAmount = Math.abs(calculated);
					const maxExtension = Math.min(rs.initialStartTime, rs.initialStartTime - prevEnd);
					const actualExtension = Math.min(extensionAmount, maxExtension);

					currentTrimStart.value = trimStartVal = 0;
					currentStartTime.value = startTimeVal = rs.initialStartTime - actualExtension;
					currentDuration.value = durationVal = rs.initialDuration + actualExtension;
				} else {
					const trimDelta = 0 - rs.initialTrimStart;
					let newStartTime = rs.initialStartTime + trimDelta;
					let newDuration = rs.initialDuration - trimDelta;

					// Clamp: don't extend past previous element
					if (newStartTime < prevEnd) {
						newStartTime = prevEnd;
						newDuration = rs.initialStartTime + rs.initialDuration - prevEnd;
					}

					currentTrimStart.value = trimStartVal = 0;
					currentStartTime.value = startTimeVal = newStartTime;
					currentDuration.value = durationVal = newDuration;
				}
			}
		} else {
			const sourceDuration = rs.initialTrimStart + rs.initialDuration + rs.initialTrimEnd;
			const newTrimEnd = rs.initialTrimEnd - deltaTime;

			if (newTrimEnd < 0) {
				if (canExtendElementDuration()) {
					const extensionNeeded = Math.abs(newTrimEnd);
					const baseDuration = rs.initialDuration + rs.initialTrimEnd;

					currentDuration.value = durationVal = baseDuration + extensionNeeded;
					currentTrimEnd.value = trimEndVal = 0;
				} else {
					const extensionToLimit = rs.initialTrimEnd;

					currentDuration.value = durationVal = rs.initialDuration + extensionToLimit;
					currentTrimEnd.value = trimEndVal = 0;
				}
			} else {
				const maxTrimEnd = sourceDuration - rs.initialTrimStart - minDurationSeconds;
				const clampedTrimEnd = Math.min(maxTrimEnd, Math.max(0, newTrimEnd));
				const trimDelta = clampedTrimEnd - rs.initialTrimEnd;
				const newDuration = rs.initialDuration - trimDelta;

				currentTrimEnd.value = trimEndVal = clampedTrimEnd;
				currentDuration.value = durationVal = newDuration;
			}
		}

		// Ripple preview: optionally push overlapping downstream clips (magnet-style).
		if (rs.side === "right") {
			if (getMainTrackMagnet()) {
				const newEndTime = startTimeVal + durationVal;
				const shifts = new Map<string, number>();
				// Only consider clips **downstream** of the one being trimmed. Using every
				// element with startTime < newEnd catches **upstream** clips too (they always
				// start before a later clip's end), which wrongly shifts them — e.g. shortening
				// clip 2 moves clip 1 to the ripple boundary during drag.
				const els = [...track.value.elements]
					.filter((el) => el.id !== element.value.id)
					.filter((el) => el.startTime >= rs.initialStartTime - 0.001)
					.sort((a, b) => a.startTime - b.startTime);

				let pushBoundary = newEndTime;
				for (const el of els) {
					if (el.startTime < pushBoundary - 0.001) {
						shifts.set(el.id, pushBoundary);
						pushBoundary = pushBoundary + el.duration;
					} else {
						break;
					}
				}
				rippleShifts.value = shifts;
			} else {
				// Rolling trim: adjust length without preview-shoving later clips (esp. away from accidental snap-to-end).
				rippleShifts.value = new Map();
			}
		} else {
			rippleShifts.value = new Map();
		}
	}

	function handleResizeEnd() {
		const rs = resizing.value;
		if (!rs) return;

		// Snap final values to frame boundaries on commit for clean frame-aligned edits
		const activeProject = editor.project.getActive();
		const projectFps = activeProject?.settings?.fps ?? 30;
		const finalTrimStart = snapTimeToFrame({ time: trimStartVal, fps: projectFps });
		const finalTrimEnd = snapTimeToFrame({ time: trimEndVal, fps: projectFps });
		const finalStartTime = snapTimeToFrame({ time: startTimeVal, fps: projectFps });
		const finalDuration = snapTimeToFrame({ time: durationVal, fps: projectFps });

		const trimStartChanged = finalTrimStart !== rs.initialTrimStart;
		const trimEndChanged = finalTrimEnd !== rs.initialTrimEnd;
		const startTimeChanged = finalStartTime !== rs.initialStartTime;
		const durationChanged = finalDuration !== rs.initialDuration;

		const anyChanged = trimStartChanged || trimEndChanged || startTimeChanged || durationChanged;

		if (anyChanged) {
			// Commit all resize changes atomically via a single command
			// to avoid intermediate states (e.g. trimStart changed but duration not yet)
			editor.timeline.updateElementTrim({
				elementId: element.value.id,
				trimStart: finalTrimStart,
				trimEnd: finalTrimEnd,
				startTime: startTimeChanged ? finalStartTime : undefined,
				duration: durationChanged ? finalDuration : undefined,
			});
		}

		resizing.value = null;
		rippleShifts.value = new Map();
		onResizeStateChange?.({ isResizing: false });
		onSnapPointChange?.(null);
	}

	// Global listeners while resizing
	let cleanupListeners: (() => void) | null = null;

	watch(resizing, (rs) => {
		cleanupListeners?.();
		cleanupListeners = null;

		if (!rs) return;

		const onMove = (e: MouseEvent) => updateTrimFromMouseMove(e.clientX);
		const onUp = () => handleResizeEnd();

		document.addEventListener("mousemove", onMove);
		document.addEventListener("mouseup", onUp);

		cleanupListeners = () => {
			document.removeEventListener("mousemove", onMove);
			document.removeEventListener("mouseup", onUp);
		};
	});

	onUnmounted(() => {
		cleanupListeners?.();
	});

	return {
		resizing,
		isResizing: ref(false), // computed from resizing !== null in template
		handleResizeStart,
		currentTrimStart,
		currentTrimEnd,
		currentStartTime,
		currentDuration,
		rippleShifts,
	};
}
