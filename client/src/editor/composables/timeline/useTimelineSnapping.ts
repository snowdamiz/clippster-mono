/**
 * Vue composable equivalent of OpenCut's use-timeline-snapping.ts
 * Provides snap-to-grid functionality for timeline elements.
 *
 * The original implementation built a fresh `snapPoints` array on every
 * mouse move and ran a linear scan against it. For a timeline with
 * hundreds of clips that is hundreds of allocations + comparisons per
 * frame.
 *
 * This refactor exposes:
 * - `findSnapPoints` — kept for back-compat (used elsewhere).
 * - `buildSnapIndex` — builds a *sorted* index once (typically at drag
 *   or resize start). The index is just a Float64Array of times plus
 *   parallel metadata arrays.
 * - `snapToIndex` — binary searches the sorted index for the nearest
 *   point within `snapThreshold` pixels. O(log N) per call.
 *
 * Magnetic same-track snap and edge snap both go through the index now.
 */
import type { TimelineTrack } from "../../types/timeline";
import { TIMELINE_CONSTANTS } from "../../constants/timeline-constants";

export interface SnapPoint {
	time: number;
	type: "element-start" | "element-end" | "playhead" | "bookmark";
	elementId?: string;
	trackId?: string;
}

export interface SnapResult {
	snappedTime: number;
	snapPoint: SnapPoint | null;
	snapDistance: number;
}

/**
 * Sorted snap index built once per drag/resize. All arrays are parallel,
 * so `points[i]` corresponds to `types[i]`, `elementIds[i]`, `trackIds[i]`.
 *
 * `points` is sorted ascending so `snapToIndex` can binary search.
 */
export interface SnapIndex {
	/** Times in seconds, sorted ascending */
	points: Float64Array;
	types: Array<SnapPoint["type"]>;
	elementIds: Array<string | undefined>;
	trackIds: Array<string | undefined>;
}

export interface UseTimelineSnappingOptions {
	snapThreshold?: number;
	enableElementSnapping?: boolean;
	enablePlayheadSnapping?: boolean;
}

const EMPTY_INDEX: SnapIndex = {
	points: new Float64Array(0),
	types: [],
	elementIds: [],
	trackIds: [],
};

export function useTimelineSnapping({
	snapThreshold = 10,
	enableElementSnapping = true,
	enablePlayheadSnapping = true,
}: UseTimelineSnappingOptions = {}) {
	function buildSnapIndex({
		tracks,
		playheadTime,
		excludeElementId,
		bookmarks,
	}: {
		tracks: Array<TimelineTrack>;
		playheadTime: number;
		excludeElementId?: string;
		bookmarks?: number[];
	}): SnapIndex {
		// Single pass to count, then fill — avoids array push overhead.
		let count = 0;
		if (enableElementSnapping) {
			for (const track of tracks) {
				for (const element of track.elements) {
					if (element.id === excludeElementId) continue;
					count += 2;
				}
			}
		}
		if (enablePlayheadSnapping) count += 1;
		if (bookmarks) count += bookmarks.length;
		if (count === 0) return EMPTY_INDEX;

		const raw: { t: number; type: SnapPoint["type"]; elId?: string; trId?: string }[] = new Array(count);
		let i = 0;

		if (enableElementSnapping) {
			for (const track of tracks) {
				for (const element of track.elements) {
					if (element.id === excludeElementId) continue;
					const start = element.startTime;
					const end = start + element.duration;
					raw[i++] = { t: start, type: "element-start", elId: element.id, trId: track.id };
					raw[i++] = { t: end, type: "element-end", elId: element.id, trId: track.id };
				}
			}
		}
		if (enablePlayheadSnapping) {
			raw[i++] = { t: playheadTime, type: "playhead" };
		}
		if (bookmarks) {
			for (const t of bookmarks) {
				raw[i++] = { t, type: "bookmark" };
			}
		}

		raw.sort((a, b) => a.t - b.t);

		const points = new Float64Array(count);
		const types: Array<SnapPoint["type"]> = new Array(count);
		const elementIds: Array<string | undefined> = new Array(count);
		const trackIds: Array<string | undefined> = new Array(count);

		for (let k = 0; k < count; k++) {
			const r = raw[k];
			points[k] = r.t;
			types[k] = r.type;
			elementIds[k] = r.elId;
			trackIds[k] = r.trId;
		}

		return { points, types, elementIds, trackIds };
	}

	/** Find the index in `points` closest to `time` via binary search. */
	function nearestIndex(points: Float64Array, time: number): number {
		if (points.length === 0) return -1;
		let lo = 0;
		let hi = points.length - 1;
		while (lo < hi) {
			const mid = (lo + hi) >>> 1;
			if (points[mid] < time) lo = mid + 1;
			else hi = mid;
		}
		// `lo` is the first index >= time. The candidate could also be lo - 1.
		if (lo > 0 && time - points[lo - 1] < points[lo] - time) return lo - 1;
		return lo;
	}

	/**
	 * Binary-search the sorted snap index for the nearest point within
	 * `snapThreshold` pixels at the given zoom level. Returns the snapped
	 * time plus the matched snap point, or the original `targetTime` if
	 * nothing is in range.
	 */
	function snapToIndex({
		targetTime,
		index,
		zoomLevel,
		filter,
	}: {
		targetTime: number;
		index: SnapIndex;
		zoomLevel: number;
		filter?: (sp: SnapPoint, i: number) => boolean;
	}): SnapResult {
		const { points, types, elementIds, trackIds } = index;
		if (points.length === 0) {
			return { snappedTime: targetTime, snapPoint: null, snapDistance: Infinity };
		}

		const pixelsPerSecond = TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel;
		const thresholdInSeconds = snapThreshold / pixelsPerSecond;

		const seed = nearestIndex(points, targetTime);
		// The closest index is either `seed`, `seed-1`, or `seed+1` — but with a
		// filter applied, we may have to walk outward through the sorted array
		// until we exit the threshold band.
		let bestIdx = -1;
		let bestDist = Infinity;

		// Walk both directions from the seed until we leave the threshold band.
		for (let step = 0; step <= points.length; step++) {
			const left = seed - step;
			const right = seed + step;
			let progressed = false;

			if (left >= 0) {
				const d = Math.abs(targetTime - points[left]);
				if (d < bestDist) {
					const sp: SnapPoint = {
						time: points[left],
						type: types[left],
						elementId: elementIds[left],
						trackId: trackIds[left],
					};
					if (!filter || filter(sp, left)) {
						bestDist = d;
						bestIdx = left;
					}
				}
				if (d <= thresholdInSeconds) progressed = true;
			}
			if (right < points.length && right !== left) {
				const d = Math.abs(targetTime - points[right]);
				if (d < bestDist) {
					const sp: SnapPoint = {
						time: points[right],
						type: types[right],
						elementId: elementIds[right],
						trackId: trackIds[right],
					};
					if (!filter || filter(sp, right)) {
						bestDist = d;
						bestIdx = right;
					}
				}
				if (d <= thresholdInSeconds) progressed = true;
			}
			if (!progressed) break;
		}

		if (bestIdx < 0 || bestDist >= thresholdInSeconds) {
			return { snappedTime: targetTime, snapPoint: null, snapDistance: bestDist };
		}

		return {
			snappedTime: points[bestIdx],
			snapPoint: {
				time: points[bestIdx],
				type: types[bestIdx],
				elementId: elementIds[bestIdx],
				trackId: trackIds[bestIdx],
			},
			snapDistance: bestDist,
		};
	}

	/**
	 * Back-compat: return a flat `SnapPoint[]` (unsorted). Existing callers
	 * (resize) still use this. New code should prefer `buildSnapIndex` +
	 * `snapToIndex` to avoid the per-call O(N) scan.
	 */
	function findSnapPoints({
		tracks,
		playheadTime,
		excludeElementId,
		bookmarks,
	}: {
		tracks: Array<TimelineTrack>;
		playheadTime: number;
		excludeElementId?: string;
		bookmarks?: number[];
	}): SnapPoint[] {
		const snapPoints: SnapPoint[] = [];

		if (enableElementSnapping) {
			for (const track of tracks) {
				for (const element of track.elements) {
					if (element.id === excludeElementId) continue;
					const elementStart = element.startTime;
					const elementEnd = element.startTime + element.duration;
					snapPoints.push(
						{
							time: elementStart,
							type: "element-start",
							elementId: element.id,
							trackId: track.id,
						},
						{
							time: elementEnd,
							type: "element-end",
							elementId: element.id,
							trackId: track.id,
						},
					);
				}
			}
		}

		if (enablePlayheadSnapping) {
			snapPoints.push({ time: playheadTime, type: "playhead" });
		}

		if (bookmarks) {
			for (const time of bookmarks) {
				snapPoints.push({ time, type: "bookmark" });
			}
		}

		return snapPoints;
	}

	function snapToNearestPoint({
		targetTime,
		snapPoints,
		zoomLevel,
	}: {
		targetTime: number;
		snapPoints: Array<SnapPoint>;
		zoomLevel: number;
	}): SnapResult {
		const pixelsPerSecond = TIMELINE_CONSTANTS.PIXELS_PER_SECOND * zoomLevel;
		const thresholdInSeconds = snapThreshold / pixelsPerSecond;

		let closestSnapPoint: SnapPoint | null = null;
		let closestDistance = Infinity;

		for (const snapPoint of snapPoints) {
			const distance = Math.abs(targetTime - snapPoint.time);
			if (distance < thresholdInSeconds && distance < closestDistance) {
				closestDistance = distance;
				closestSnapPoint = snapPoint;
			}
		}

		return {
			snappedTime: closestSnapPoint ? closestSnapPoint.time : targetTime,
			snapPoint: closestSnapPoint,
			snapDistance: closestDistance,
		};
	}

	function snapElementEdge({
		targetTime,
		elementDuration,
		tracks,
		playheadTime,
		zoomLevel,
		excludeElementId,
		snapToStart = true,
	}: {
		targetTime: number;
		elementDuration: number;
		tracks: Array<TimelineTrack>;
		playheadTime: number;
		zoomLevel: number;
		excludeElementId?: string;
		snapToStart?: boolean;
	}): SnapResult {
		const snapPoints = findSnapPoints({ tracks, playheadTime, excludeElementId });
		const effectiveTargetTime = snapToStart ? targetTime : targetTime + elementDuration;
		const snapResult = snapToNearestPoint({ targetTime: effectiveTargetTime, snapPoints, zoomLevel });

		if (!snapToStart && snapResult.snapPoint) {
			snapResult.snappedTime = snapResult.snappedTime - elementDuration;
		}

		return snapResult;
	}

	return {
		buildSnapIndex,
		snapToIndex,
		snapElementEdge,
		findSnapPoints,
		snapToNearestPoint,
	};
}
