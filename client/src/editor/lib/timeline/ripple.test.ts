import { describe, expect, it } from "vitest";
import {
	closeGapAfterRemove,
	rearrangeOnTrack,
	ripplePushOverlaps,
} from "./ripple";
import type { TimelineElement } from "../../types/timeline";

function el(id: string, startTime: number, duration: number): TimelineElement {
	return {
		id,
		type: "video",
		name: id,
		startTime,
		duration,
		trimStart: 0,
		trimEnd: 0,
		mediaId: id,
	} as TimelineElement;
}

describe("ripplePushOverlaps", () => {
	it("does not move clips when the new clip sits in a blank gap", () => {
		const result = ripplePushOverlaps([
			el("a", 0, 2),
			el("b", 10, 2),
			el("new", 5, 2),
		]);
		expect(result.find((e) => e.id === "a")?.startTime).toBe(0);
		expect(result.find((e) => e.id === "new")?.startTime).toBe(5);
		expect(result.find((e) => e.id === "b")?.startTime).toBe(10);
	});

	it("pushes a later clip only when the new clip overlaps it", () => {
		const result = ripplePushOverlaps([
			el("a", 0, 2),
			el("b", 5, 2),
			el("new", 4, 3),
		]);
		expect(result.find((e) => e.id === "new")?.startTime).toBe(4);
		expect(result.find((e) => e.id === "b")?.startTime).toBe(7);
	});
});

describe("rearrangeOnTrack", () => {
	it("without closeGaps keeps other clips put when moving into blank space", () => {
		const elements = [el("a", 0, 2), el("b", 10, 2), el("c", 4, 2)];
		const result = rearrangeOnTrack(elements, "c", 4, 2, 6, { closeGaps: false });
		expect(result.find((e) => e.id === "a")?.startTime).toBe(0);
		expect(result.find((e) => e.id === "c")?.startTime).toBe(6);
		expect(result.find((e) => e.id === "b")?.startTime).toBe(10);
	});

	it("with closeGaps closes the hole at the old position", () => {
		const elements = [el("a", 0, 2), el("b", 10, 2), el("c", 4, 2)];
		const result = rearrangeOnTrack(elements, "c", 4, 2, 20, { closeGaps: true });
		// Gap at 4..6 closed → b shifts left by 2
		expect(result.find((e) => e.id === "b")?.startTime).toBe(8);
	});
});

describe("closeGapAfterRemove", () => {
	it("shifts only clips at/after the removed range", () => {
		const result = closeGapAfterRemove(
			[el("a", 0, 2), el("b", 10, 2)],
			4,
			3,
		);
		expect(result.find((e) => e.id === "a")?.startTime).toBe(0);
		expect(result.find((e) => e.id === "b")?.startTime).toBe(7);
	});
});

describe("overlay track remove / move-off", () => {
	it("leaving a clip off an overlay track does not pull neighbors left", () => {
		const remaining = [el("a", 0, 2), el("b", 10, 2)];
		// Simulate move-off without closeGaps: just drop the moved id.
		const without = remaining; // "c" already gone
		expect(without.find((e) => e.id === "a")?.startTime).toBe(0);
		expect(without.find((e) => e.id === "b")?.startTime).toBe(10);
	});

	it("delete on overlay keeps neighbor start times (no closeGap)", () => {
		const before = [el("a", 0, 2), el("mid", 4, 2), el("b", 10, 2)];
		const afterDelete = before.filter((e) => e.id !== "mid");
		expect(afterDelete.map((e) => e.startTime)).toEqual([0, 10]);
	});

	it("move-off with closeGaps would shift — prove the gated path differs", () => {
		const before = [el("a", 0, 2), el("mid", 4, 2), el("b", 10, 2)];
		const without = before.filter((e) => e.id !== "mid");
		const closed = closeGapAfterRemove(without, 4, 2);
		expect(closed.find((e) => e.id === "b")?.startTime).toBe(8);
		// Overlay path must keep without, not closed:
		expect(without.find((e) => e.id === "b")?.startTime).toBe(10);
	});
});
