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

	for (let i = 0; i < tracks.length; i++) {
		const trackHeight = TRACK_HEIGHTS[tracks[i].type];
		const trackTop = cumulativeHeight;
		const trackBottom = trackTop + trackHeight;

		if (mouseY >= trackTop && mouseY < trackBottom) {
			return {
				trackIndex: i,
				relativeY: mouseY - trackTop,
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
	const xPosition =
		typeof startTimeOverride === "number"
			? startTimeOverride
			: isExternalDrop
				? playheadTime
				: Math.max(0, mouseX / (pixelsPerSecond * zoomLevel));

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
