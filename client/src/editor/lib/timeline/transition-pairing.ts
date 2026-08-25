import type { Transition } from "../../types/transitions";
import type { ImageElement, TimelineTrack, VideoElement } from "../../types/timeline";

/**
 * Max forward gap (incoming starts after outgoing end). 0.1s was too strict: float drift
 * from duration sums, trim nudges, and bridge imports often land 0.05–0.3s apart while still
 * being one logical cut.
 */
export const TRANSITION_MAX_FORWARD_GAP_SEC = 1.0;

/**
 * Max overlap backward (incoming starts slightly before outgoing end). Handles trim/ripple
 * quirks and frame-aligned overlaps without rejecting the junction.
 */
export const TRANSITION_MAX_OVERLAP_BACK_SEC = 0.5;

/** @deprecated Use {@link TRANSITION_MAX_FORWARD_GAP_SEC} — kept for any external imports. */
export const TRANSITION_ADJACENCY_GAP_SEC = TRANSITION_MAX_FORWARD_GAP_SEC;

export type TransitionMediaElement = VideoElement | ImageElement;

/** True when `incoming` is the logical segment after `outgoing` on the same track. */
export function isAdjacentMediaCuts({
	outgoingEnd,
	incomingStart,
	forwardGapSec = TRANSITION_MAX_FORWARD_GAP_SEC,
	overlapBackSec = TRANSITION_MAX_OVERLAP_BACK_SEC,
}: {
	outgoingEnd: number;
	incomingStart: number;
	forwardGapSec?: number;
	overlapBackSec?: number;
}): boolean {
	const delta = incomingStart - outgoingEnd;
	return delta <= forwardGapSec && delta >= -overlapBackSec;
}

function sortedVisibleMediaElements(track: TimelineTrack): TransitionMediaElement[] {
	if (track.type !== "video") return [];
	return [...track.elements]
		.filter((e) => !("hidden" in e && e.hidden) && (e.type === "video" || e.type === "image"))
		.sort((a, b) => (a.startTime !== b.startTime ? a.startTime - b.startTime : a.id.localeCompare(b.id)));
}

/**
 * When adding a transition from the assets panel, `targetElementId` must be the **incoming**
 * (right-hand) clip. If the user has the left clip selected at a cut, return the incoming id.
 */
export function resolveTransitionIncomingElementId({
	track,
	selectedElementId,
	forwardGapSec = TRANSITION_MAX_FORWARD_GAP_SEC,
	overlapBackSec = TRANSITION_MAX_OVERLAP_BACK_SEC,
}: {
	track: TimelineTrack;
	selectedElementId: string;
	forwardGapSec?: number;
	overlapBackSec?: number;
}): string | null {
	if (track.type !== "video") return null;

	const sorted = sortedVisibleMediaElements(track);
	const idx = sorted.findIndex((e) => e.id === selectedElementId);
	if (idx === -1) return null;

	const el = sorted[idx];
	const prev = idx > 0 ? sorted[idx - 1] : null;
	if (prev) {
		const outgoingEnd = prev.startTime + prev.duration;
		if (isAdjacentMediaCuts({ outgoingEnd, incomingStart: el.startTime, forwardGapSec, overlapBackSec })) {
			return el.id;
		}
	}

	const next = idx + 1 < sorted.length ? sorted[idx + 1] : null;
	if (next) {
		const outgoingEnd = el.startTime + el.duration;
		if (isAdjacentMediaCuts({ outgoingEnd, incomingStart: next.startTime, forwardGapSec, overlapBackSec })) {
			return next.id;
		}
	}

	return null;
}

/**
 * Resolve outgoing/incoming media elements for a transition on a video track.
 * Supports the common mistake of storing `targetElementId` on the **outgoing** (left) clip
 * when there is no previous neighbor (only the mis-keyed-left case).
 */
export function resolveTransitionMediaPair({
	transition,
	track,
	forwardGapSec = TRANSITION_MAX_FORWARD_GAP_SEC,
	overlapBackSec = TRANSITION_MAX_OVERLAP_BACK_SEC,
}: {
	transition: Transition;
	track: TimelineTrack;
	forwardGapSec?: number;
	overlapBackSec?: number;
}): { outgoing: TransitionMediaElement; incoming: TransitionMediaElement } | null {
	if (track.type !== "video") return null;

	const sorted = sortedVisibleMediaElements(track);
	const targetIdx = sorted.findIndex((e) => e.id === transition.targetElementId);
	if (targetIdx === -1) return null;

	const target = sorted[targetIdx];
	const prev = targetIdx > 0 ? sorted[targetIdx - 1] : null;

	if (prev) {
		const outgoingEnd = prev.startTime + prev.duration;
		if (
			isAdjacentMediaCuts({
				outgoingEnd,
				incomingStart: target.startTime,
				forwardGapSec,
				overlapBackSec,
			})
		) {
			return { outgoing: prev, incoming: target };
		}
	}

	const next = targetIdx + 1 < sorted.length ? sorted[targetIdx + 1] : null;
	if (next) {
		const outgoingEnd = target.startTime + target.duration;
		if (
			isAdjacentMediaCuts({
				outgoingEnd,
				incomingStart: next.startTime,
				forwardGapSec,
				overlapBackSec,
			})
		) {
			return { outgoing: target, incoming: next };
		}
	}

	return null;
}

export function transitionAppliesToTrack({
	transition,
	track,
}: {
	transition: Transition;
	track: TimelineTrack;
}): boolean {
	return track.elements.some((e) => e.id === transition.targetElementId);
}

/** Transitions whose pair includes this element (incoming target, outgoing left clip, or legacy mis-key). */
export function findTransitionForTrackElement({
	transitions,
	track,
	elementId,
}: {
	transitions: Transition[] | undefined;
	track: TimelineTrack;
	elementId: string;
}): Transition | null {
	for (const t of transitions ?? []) {
		if (!transitionAppliesToTrack({ transition: t, track })) continue;
		if (t.targetElementId === elementId) return t;
		const pair = resolveTransitionMediaPair({ transition: t, track });
		if (pair && (pair.outgoing.id === elementId || pair.incoming.id === elementId)) return t;
	}
	return null;
}

export function removeTransitionTargetsInvolvingElement({
	transitions,
	track,
	elementId,
}: {
	transitions: Transition[] | undefined;
	track: TimelineTrack;
	elementId: string;
}): Transition[] {
	const drop = new Set<string>();
	for (const t of transitions ?? []) {
		if (!transitionAppliesToTrack({ transition: t, track })) continue;
		if (t.targetElementId === elementId) {
			drop.add(t.targetElementId);
			continue;
		}
		const pair = resolveTransitionMediaPair({ transition: t, track });
		if (pair && (pair.outgoing.id === elementId || pair.incoming.id === elementId)) {
			drop.add(t.targetElementId);
		}
	}
	return (transitions ?? []).filter((t) => !drop.has(t.targetElementId));
}
