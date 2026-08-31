import type { TimelineElement } from "../../types/timeline";

/**
 * Shift clips that start at/after `removedStart` left by `removedDuration`
 * (close the hole left by a removed/moved clip).
 * Main-track magnet only — overlay tracks keep gaps.
 */
export function closeGapAfterRemove<T extends TimelineElement>(
	elements: T[],
	removedStart: number,
	removedDuration: number,
	excludeId?: string,
): T[] {
	if (removedDuration <= 0) return elements;
	return elements.map((el) => {
		if (excludeId && el.id === excludeId) return el;
		if (el.startTime >= removedStart - 0.001) {
			return {
				...el,
				startTime: Math.max(0, el.startTime - removedDuration),
			};
		}
		return el;
	});
}

/**
 * Sort by startTime, then push any overlapping clip forward so it starts
 * at the previous clip's end. Does nothing when clips do not overlap.
 */
export function ripplePushOverlaps<T extends TimelineElement>(
	elements: T[],
	_movedId?: string,
): T[] {
	const sorted = [...elements].sort((a, b) => a.startTime - b.startTime);
	const result: T[] = [];

	for (const el of sorted) {
		if (result.length > 0) {
			const prev = result[result.length - 1]!;
			const prevEnd = prev.startTime + prev.duration;
			if (el.startTime < prevEnd - 0.001) {
				result.push({ ...el, startTime: prevEnd });
				continue;
			}
		}
		result.push(el);
	}

	return result;
}

/**
 * Same-track rearrange.
 * - `closeGaps: true` (main track magnet): close the hole at the old position,
 *   then place and push overlaps.
 * - `closeGaps: false` (overlay tracks): place at `newStartTime` and only push
 *   clips that would actually overlap.
 */
export function rearrangeOnTrack<T extends TimelineElement>(
	elements: T[],
	movedId: string,
	oldStartTime: number,
	oldDuration: number,
	newStartTime: number,
	options?: { closeGaps?: boolean },
): T[] {
	const closeGaps = options?.closeGaps === true;
	const without = elements.filter((el) => el.id !== movedId);
	const base = closeGaps
		? closeGapAfterRemove(without, oldStartTime, oldDuration)
		: without;

	let adjustedStart = newStartTime;
	if (closeGaps && newStartTime >= oldStartTime + oldDuration - 0.001) {
		adjustedStart = Math.max(0, newStartTime - oldDuration);
	}

	const moved = elements.find((el) => el.id === movedId);
	if (!moved) return elements;

	const placed: T[] = [
		...base,
		{ ...moved, startTime: Math.max(0, adjustedStart) },
	];
	return ripplePushOverlaps(placed, movedId);
}

/**
 * Preview map of elementId → new startTime for live ripple while dragging.
 * Gap-closing only when `closeSourceGaps` is set (main-track magnet).
 * Destination always only pushes true overlaps.
 */
export function computeDragRipplePreview(params: {
	tracks: { id: string; elements: TimelineElement[] }[];
	sourceTrackId: string;
	targetTrackId: string;
	elementId: string;
	oldStartTime: number;
	duration: number;
	newStartTime: number;
	closeSourceGaps?: boolean;
}): Map<string, number> {
	const shifts = new Map<string, number>();
	const {
		tracks,
		sourceTrackId,
		targetTrackId,
		elementId,
		oldStartTime,
		duration,
		newStartTime,
		closeSourceGaps = false,
	} = params;

	const source = tracks.find((t) => t.id === sourceTrackId);
	if (!source) return shifts;

	if (sourceTrackId === targetTrackId) {
		const next = rearrangeOnTrack(
			source.elements,
			elementId,
			oldStartTime,
			duration,
			newStartTime,
			{ closeGaps: closeSourceGaps },
		);
		for (const el of next) {
			const orig = source.elements.find((e) => e.id === el.id);
			if (orig && Math.abs(orig.startTime - el.startTime) > 0.001 && el.id !== elementId) {
				shifts.set(el.id, el.startTime);
			}
		}
		return shifts;
	}

	if (closeSourceGaps) {
		for (const el of source.elements) {
			if (el.id === elementId) continue;
			if (el.startTime >= oldStartTime - 0.001) {
				shifts.set(el.id, Math.max(0, el.startTime - duration));
			}
		}
	}

	const target = tracks.find((t) => t.id === targetTrackId);
	if (target) {
		const phantom = {
			id: elementId,
			startTime: newStartTime,
			duration,
		} as TimelineElement;
		const next = ripplePushOverlaps([...target.elements, phantom], elementId);
		for (const el of next) {
			if (el.id === elementId) continue;
			const orig = target.elements.find((e) => e.id === el.id);
			if (orig && Math.abs(orig.startTime - el.startTime) > 0.001) {
				shifts.set(el.id, el.startTime);
			}
		}
	}

	return shifts;
}
