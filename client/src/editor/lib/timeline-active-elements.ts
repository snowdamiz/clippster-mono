import type { TimelineTrack, TimelineElement } from "../types/timeline";

export type ActiveElementRef = {
	trackId: string;
	element: TimelineElement;
};

/**
 * Per-track sorted (by startTime) element list for fast "active at time" queries.
 */
export function buildActiveElementIndex(tracks: TimelineTrack[]): Map<string, TimelineElement[]> {
	const map = new Map<string, TimelineElement[]>();
	for (const t of tracks) {
		const sorted = [...t.elements].sort((a, b) => a.startTime - b.startTime);
		map.set(t.id, sorted);
	}
	return map;
}

/**
 * Elements whose [start, end) contains `time`, O(tracks * log n) with sorted arrays,
 * early exit when sorted by time (scan only overlapping window).
 */
export function getActiveElementsAtTime(
	tracks: TimelineTrack[],
	time: number,
	index: Map<string, TimelineElement[]>,
): ActiveElementRef[] {
	const out: ActiveElementRef[] = [];
	for (const track of tracks) {
		if ("hidden" in track && track.hidden) continue;
		const els = index.get(track.id);
		if (!els?.length) continue;
		for (const el of els) {
			if ("hidden" in el && el.hidden) continue;
			const start = el.startTime;
			const end = start + el.duration;
			if (time >= start && time < end) {
				out.push({ trackId: track.id, element: el });
			}
		}
	}
	return out;
}
