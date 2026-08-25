import { describe, expect, it } from "vitest";
import {
	getTimelineVisibleRange,
	isElementInVisibleRange,
} from "./useTimelineViewport";

describe("timeline viewport culling", () => {
	it("converts scroll geometry to an overscanned time range", () => {
		expect(
			getTimelineVisibleRange({
				scrollLeft: 1_000,
				viewportWidth: 500,
				zoomLevel: 2,
				overscanPx: 200,
			}),
		).toEqual({ startTime: 8, endTime: 17 });
	});

	it("clamps the leading overscan to timeline zero", () => {
		expect(
			getTimelineVisibleRange({
				scrollLeft: 50,
				viewportWidth: 500,
				zoomLevel: 1,
				overscanPx: 200,
			}).startTime,
		).toBe(0);
	});

	it("keeps selected or dragged elements outside the viewport", () => {
		const element = { id: "selected", startTime: 100, duration: 5 };
		expect(
			isElementInVisibleRange(element, { startTime: 0, endTime: 10 }, new Set(["selected"])),
		).toBe(true);
	});

	it("uses live ripple positions when deciding visibility", () => {
		const element = { id: "shifted", startTime: 100, duration: 5 };
		expect(
			isElementInVisibleRange(element, { startTime: 0, endTime: 10 }, new Set(), 4),
		).toBe(true);
	});

	it("includes clips touching either viewport boundary", () => {
		const retained = new Set<string>();
		expect(
			isElementInVisibleRange(
				{ id: "left", startTime: 5, duration: 5 },
				{ startTime: 10, endTime: 20 },
				retained,
			),
		).toBe(true);
		expect(
			isElementInVisibleRange(
				{ id: "right", startTime: 20, duration: 5 },
				{ startTime: 10, endTime: 20 },
				retained,
			),
		).toBe(true);
	});
});
