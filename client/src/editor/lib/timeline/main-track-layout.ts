import type { TimelineElement, TimelineTrack } from "../../types/timeline";
import { isMainTrack } from "./track-utils";
import { snapTimeToFrame } from "../time";

/** Segment types laid end-to-end on the main story track (no gaps). */
const MAIN_SEGMENT_TYPES = new Set<string>(["video", "image"]);

/**
 * Pack main-video segments contiguously from t=0 in timeline order (sort by current start).
 * Removes gaps between clips after insert, trim, or move.
 */
export function collapseMainVideoTrackGaps(
	track: TimelineTrack,
	fps: number,
): TimelineTrack {
	if (!isMainTrack(track)) return track;

	const segments = track.elements.filter((e) => MAIN_SEGMENT_TYPES.has(e.type));
	const rest = track.elements.filter((e) => !MAIN_SEGMENT_TYPES.has(e.type));

	if (segments.length === 0) return track;

	const sorted = [...segments].sort((a, b) =>
		a.startTime !== b.startTime ? a.startTime - b.startTime : a.id.localeCompare(b.id),
	);

	let acc = 0;
	const packed: TimelineElement[] = sorted.map((el) => {
		const startTime = snapTimeToFrame({ time: acc, fps });
		const next = { ...el, startTime };
		acc = startTime + el.duration;
		return next;
	});

	return {
		...track,
		elements: [...packed, ...rest],
	} as typeof track;
}

export function collapseMainVideoTracksIfPresent(
	tracks: TimelineTrack[],
	fps: number,
): TimelineTrack[] {
	return tracks.map((t) =>
		isMainTrack(t) ? collapseMainVideoTrackGaps(t, fps) : t,
	);
}
