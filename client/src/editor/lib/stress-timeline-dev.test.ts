import { describe, expect, it } from "vitest";
import type { EditorCore } from "../core";
import type { TimelineElement, TimelineTrack } from "../types/timeline";
import {
	applyStressTimelineLayers,
	applyStressTimelineScenario,
	createStressTimelineTracks,
} from "./stress-timeline-dev";

function createEditor(initialTracks: TimelineTrack[] = []): {
	editor: EditorCore;
	getTracks: () => TimelineTrack[];
} {
	let tracks = initialTracks;
	const editor = {
		timeline: {
			getTracks: () => tracks,
			updateTracks: (next: TimelineTrack[]) => {
				tracks = next;
			},
		},
	} as unknown as EditorCore;
	return { editor, getTracks: () => tracks };
}

function elements(tracks: TimelineTrack[]): TimelineElement[] {
	return tracks.reduce<TimelineElement[]>((all, track) => {
		all.push(...(track.elements as TimelineElement[]));
		return all;
	}, []);
}

describe("stress timeline scenarios", () => {
	it("creates the deterministic 100-item dense default", () => {
		const first = createStressTimelineTracks();
		const second = createStressTimelineTracks("dense");

		expect(first).toEqual(second);
		expect(elements(first)).toHaveLength(100);
		expect(new Set(elements(first).map((element) => element.id)).size).toBe(100);
	});

	it("stacks overlays and effects at the same timestamp", () => {
		const tracks = createStressTimelineTracks("stacked");
		const stacked = elements(tracks);

		expect(stacked).toHaveLength(60);
		expect(stacked.every((element) => element.startTime === 5)).toBe(true);
		expect(stacked.every((element) => element.duration === 10)).toBe(true);
	});

	it("spans a long timeline without random data", () => {
		const tracks = createStressTimelineTracks("long");
		const longElements = elements(tracks);
		const endTime = Math.max(...longElements.map((element) => element.startTime + element.duration));

		expect(longElements).toHaveLength(120);
		expect(endTime).toBeGreaterThan(3500);
		expect(createStressTimelineTracks("long")).toEqual(tracks);
	});

	it("preserves the existing helper and avoids IDs colliding across runs", () => {
		const { editor, getTracks } = createEditor();

		expect(applyStressTimelineLayers(editor)).toEqual({ added: 100 });
		expect(applyStressTimelineScenario(editor, "dense")).toEqual({ added: 100 });

		const ids = elements(getTracks()).map((element) => element.id);
		expect(getTracks()).toHaveLength(6);
		expect(new Set(ids).size).toBe(ids.length);
	});
});
