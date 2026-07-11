import type { TimelineTrack, ElementType } from "../../types/timeline";
import { TRACK_HEIGHTS, TRACK_GAP } from "../../constants/timeline-constants";
import type { ComputeDropTargetParams, DropTarget } from "../../types/timeline";
import { isMainTrack } from "./track-utils";

function getTrackAtY({
	mouseY,
	tracks,
	verticalDragDirection,
}: {
	mouseY: number;
	tracks: TimelineTrack[];
	verticalDragDirection?: "up" | "down" | null;
}): { trackIndex: number; relativeY: number } | null {
	let cumulativeHeight = 0;
	const EDGE_TOLERANCE = 6;

	for (let i = 0; i < tracks.length; i++) {
		const trackHeight = TRACK_HEIGHTS[tracks[i].type];
		const trackTop = cumulativeHeight;
		const trackBottom = trackTop + trackHeight;

		if (mouseY >= trackTop - EDGE_TOLERANCE && mouseY < trackBottom + EDGE_TOLERANCE) {
			return {
				trackIndex: i,
				relativeY: Math.max(0, Math.min(trackHeight, mouseY - trackTop)),
			};
		}

		if (i < tracks.length - 1 && verticalDragDirection) {
			const gapTop = trackBottom;
			const gapBottom = gapTop + TRACK_GAP;
			if (mouseY >= gapTop && mouseY < gapBottom) {
				const isDraggingUp = verticalDragDirection === "up";
				return {
					trackIndex: isDraggingUp ? i : i + 1,
					relativeY: isDraggingUp ? trackHeight - 1 : 0,
				};
			}
		}

		cumulativeHeight += trackHeight + TRACK_GAP;
	}

	return null;
}

function isCompatible({
	elementType,
	trackType,
}: {
	elementType: ElementType;
	trackType: TimelineTrack["type"];
}): boolean {
	if (elementType === "text") return trackType === "text";
	if (elementType === "caption") return trackType === "caption";
	if (elementType === "audio") return trackType === "audio";
	if (elementType === "sticker") return trackType === "sticker";
	if (elementType === "effect") return trackType === "effect";
	if (elementType === "video" || elementType === "image") {
		return trackType === "video";
	}
	return false;
}

function getMainTrackIndex({ tracks }: { tracks: TimelineTrack[] }): number {
	return tracks.findIndex((track) => isMainTrack(track));
}

/**
 * Find the first existing compatible non-main track that has no element
 * overlapping [startTime, startTime + duration).
 * Returns the track's array index, or -1 if none found.
 */
export function findCompatibleTrack({
	tracks,
	elementType,
	startTime,
	duration,
}: {
	tracks: TimelineTrack[];
	elementType: ElementType;
	startTime: number;
	duration: number;
}): number {
	const end = startTime + duration;
	for (let i = 0; i < tracks.length; i++) {
		const track = tracks[i];
		if (!isCompatible({ elementType, trackType: track.type })) continue;
		if (isMainTrack(track)) continue;
		// Check for overlap
		const hasOverlap = track.elements.some(
			(el) => el.startTime < end && el.startTime + el.duration > startTime,
		);
		if (!hasOverlap) return i;
	}
	return -1;
}

function findInsertIndex({
	elementType,
	tracks,
	preferredIndex,
	insertAbove,
}: {
	elementType: ElementType;
	tracks: TimelineTrack[];
	preferredIndex: number;
	insertAbove: boolean;
}): { index: number; position: "above" | "below" } {
	const mainTrackIndex = getMainTrackIndex({ tracks });

	if (elementType === "audio") {
		if (preferredIndex <= mainTrackIndex) {
			return { index: mainTrackIndex + 1, position: "below" };
		}
		return {
			index: insertAbove ? preferredIndex : preferredIndex + 1,
			position: insertAbove ? "above" : "below",
		};
	}

	const overlayInsertIndex = insertAbove ? preferredIndex : preferredIndex + 1;

	if (mainTrackIndex >= 0 && overlayInsertIndex > mainTrackIndex) {
		return { index: mainTrackIndex, position: "above" };
	}

	return {
		index: overlayInsertIndex,
		position: insertAbove ? "above" : "below",
	};
}

export function computeDropTarget({
	elementType,
	mouseX,
	mouseY,
	tracks,
	playheadTime,
	isExternalDrop,
	elementDuration,
	pixelsPerSecond,
	zoomLevel,
	verticalDragDirection,
	startTimeOverride,
	excludeElementId,
}: ComputeDropTargetParams): DropTarget {
	const xPositionRaw =
		typeof startTimeOverride === "number"
			? startTimeOverride
			: isExternalDrop
				? playheadTime
				: Math.max(0, mouseX / (pixelsPerSecond * zoomLevel));

	// Snap drops near the timeline origin so clips land flush at 00:00.
	const originSnapThresholdSec = 15 / (pixelsPerSecond * zoomLevel);
	const xPosition = xPositionRaw <= originSnapThresholdSec ? 0 : xPositionRaw;

	const mainTrackIndex = getMainTrackIndex({ tracks });

	if (tracks.length === 0) {
		if (elementType === "audio") {
			return {
				trackIndex: 0,
				isNewTrack: true,
				insertPosition: "below",
				xPosition,
			};
		}
		return { trackIndex: 0, isNewTrack: true, insertPosition: null, xPosition };
	}

	const trackAtMouse = getTrackAtY({ mouseY, tracks, verticalDragDirection });
	const singleInstanceTypes: ElementType[] = ["caption", "sticker", "text", "effect"];
	const totalTrackStackHeight = tracks.reduce(
		(sum, t, i) => sum + TRACK_HEIGHTS[t.type] + (i < tracks.length - 1 ? TRACK_GAP : 0),
		0,
	);

	function findNearestCompatibleTrackIndex(): number | null {
		if (!singleInstanceTypes.includes(elementType)) return null;
		const compatibleIndices = tracks
			.map((t, i) => ({ track: t, index: i }))
			.filter(({ track }) => isCompatible({ elementType, trackType: track.type }))
			.map(({ index }) => index);
		if (compatibleIndices.length === 0) return null;
		if (compatibleIndices.length === 1) return compatibleIndices[0];

		const sourceTrackIdx = tracks.findIndex((t) =>
			t.elements.some((el) => el.id === excludeElementId),
		);
		if (
			sourceTrackIdx >= 0 &&
			compatibleIndices.includes(sourceTrackIdx)
		) {
			return sourceTrackIdx;
		}

		let best: { idx: number; dist: number } | null = null;
		let cumulative = 0;
		for (let i = 0; i < tracks.length; i++) {
			const h = TRACK_HEIGHTS[tracks[i].type];
			const centerY = cumulative + h / 2;
			cumulative += h + TRACK_GAP;
			if (!compatibleIndices.includes(i)) continue;
			const dist = Math.abs(mouseY - centerY);
			if (!best || dist < best.dist) best = { idx: i, dist };
		}
		return best?.idx ?? compatibleIndices[0];
	}

	if (!trackAtMouse) {
		const isAboveAllTracks = mouseY < 0;

		if (elementType === "audio") {
			return {
				trackIndex: tracks.length,
				isNewTrack: true,
				insertPosition: "below",
				xPosition,
			};
		}

		if (isAboveAllTracks) {
			return {
				trackIndex: 0,
				isNewTrack: true,
				insertPosition: "above",
				xPosition,
			};
		}

		const nearTrackStack = mouseY >= -16 && mouseY <= totalTrackStackHeight + 16;
		const nearestCompatible = nearTrackStack ? findNearestCompatibleTrackIndex() : null;
		if (nearestCompatible !== null) {
			return {
				trackIndex: nearestCompatible,
				isNewTrack: false,
				insertPosition: null,
				xPosition,
			};
		}

		return {
			trackIndex: Math.max(0, mainTrackIndex),
			isNewTrack: true,
			insertPosition: "above",
			xPosition,
		};
	}

	const { trackIndex, relativeY } = trackAtMouse;
	const track = tracks[trackIndex];
	const trackHeight = TRACK_HEIGHTS[track.type];
	const isInUpperHalf = relativeY < trackHeight / 2;

	const isTrackCompatible = isCompatible({
		elementType,
		trackType: track.type,
	});

	// Effect-on-element: when dragging an effect over a video/image track,
	// find the element under the cursor and mark it as the drop target so
	// the effect gets added to that element's effects[] array.
	if (elementType === "effect" && track.type === "video") {
		const timeAtCursor = Math.max(0, mouseX / (pixelsPerSecond * zoomLevel));
		for (const el of track.elements) {
			if (timeAtCursor >= el.startTime && timeAtCursor < el.startTime + el.duration) {
				return {
					trackIndex,
					isNewTrack: false,
					insertPosition: null,
					xPosition,
					targetElementId: el.id,
					targetTrackId: track.id,
				};
			}
		}
	}

	// Allow drop on compatible tracks even with overlap — MoveElementCommand
	// will ripple-push overlapping elements forward automatically.
	if (isTrackCompatible) {
		// Enforce z-order rules:
		// - Audio tracks must stay below the main track
		// - Non-audio tracks (video, text, sticker, effect, caption) must stay above the main track
		if (elementType === "audio" && mainTrackIndex >= 0 && trackIndex <= mainTrackIndex) {
			return {
				trackIndex: mainTrackIndex + 1,
				isNewTrack: true,
				insertPosition: "below",
				xPosition,
			};
		}
		if (elementType !== "audio" && mainTrackIndex >= 0 && trackIndex > mainTrackIndex) {
			return {
				trackIndex: mainTrackIndex,
				isNewTrack: false,
				insertPosition: null,
				xPosition,
			};
		}
		return {
			trackIndex,
			isNewTrack: false,
			insertPosition: null,
			xPosition,
		};
	}

	let insertAbove = isInUpperHalf;
	if (verticalDragDirection) {
		insertAbove = verticalDragDirection === "up";
	}

	const { index, position } = findInsertIndex({
		elementType,
		tracks,
		preferredIndex: trackIndex,
		insertAbove,
	});

	return {
		trackIndex: index,
		isNewTrack: true,
		insertPosition: position,
		xPosition,
	};
}

export function getDropLineY({
	dropTarget,
	tracks,
}: {
	dropTarget: DropTarget;
	tracks: TimelineTrack[];
}): number {
	const safeTrackIndex = Math.min(
		Math.max(dropTarget.trackIndex, 0),
		tracks.length,
	);
	let y = 0;

	for (let i = 0; i < safeTrackIndex; i++) {
		y += TRACK_HEIGHTS[tracks[i].type] + TRACK_GAP;
	}

	return y;
}

export function getDropIndicatorGeometry({
	dropTarget,
	tracks,
	insertGapIndex = null,
	insertGapSize = 0,
}: {
	dropTarget: DropTarget;
	tracks: TimelineTrack[];
	/** Track index at which an insert gap is open (tracks at/after this are shifted down). */
	insertGapIndex?: number | null;
	insertGapSize?: number;
}): { y: number; height: number; isNewTrack: boolean } {
	const safeTrackIndex = Math.min(
		Math.max(dropTarget.trackIndex, 0),
		tracks.length,
	);

	let y = 0;
	for (let i = 0; i < safeTrackIndex; i++) {
		y += TRACK_HEIGHTS[tracks[i].type] + TRACK_GAP;
	}

	if (
		insertGapIndex != null &&
		insertGapSize > 0 &&
		safeTrackIndex >= insertGapIndex
	) {
		y += insertGapSize;
	}

	if (dropTarget.isNewTrack) {
		const gapCenterY = safeTrackIndex > 0 ? y - TRACK_GAP / 2 - (insertGapSize > 0 ? insertGapSize / 2 : 0) : 0;
		return { y: gapCenterY, height: TRACK_GAP + insertGapSize, isNewTrack: true };
	}

	const trackHeight =
		safeTrackIndex < tracks.length
			? TRACK_HEIGHTS[tracks[safeTrackIndex].type]
			: 0;

	return { y, height: trackHeight, isNewTrack: false };
}
