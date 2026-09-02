import { describe, expect, it } from "vitest";
import { syncCaptionElementTimelineBounds } from "./caption-sync";
import type { CaptionElement } from "../../types/timeline";

function makeCaption(overrides: Partial<CaptionElement> = {}): CaptionElement {
	return {
		id: "cap-1",
		type: "caption",
		name: "Caption",
		startTime: 2,
		duration: 5,
		trimStart: 0,
		trimEnd: 5,
		lines: [
			{
				text: "Hello world",
				startTime: 2,
				endTime: 3.5,
				words: [
					{ word: "Hello", start: 2, end: 2.5 },
					{ word: "world", start: 2.5, end: 3.5 },
				],
			},
		],
		style: {},
		transform: { position: { x: 0, y: 200 }, scale: 1, rotate: 0, opacity: 1 },
		...overrides,
	} as CaptionElement;
}

describe("syncCaptionElementTimelineBounds", () => {
	it("expands line visibility to match element timeline span", () => {
		const synced = syncCaptionElementTimelineBounds(makeCaption());
		expect(synced.lines[0].startTime).toBe(2);
		expect(synced.lines[0].endTime).toBe(7);
	});

	it("preserves word timings for karaoke highlighting", () => {
		const synced = syncCaptionElementTimelineBounds(makeCaption());
		expect(synced.lines[0].words).toEqual([
			{ word: "Hello", start: 2, end: 2.5 },
			{ word: "world", start: 2.5, end: 3.5 },
		]);
	});

	it("syncs all lines on multi-line captions", () => {
		const synced = syncCaptionElementTimelineBounds(
			makeCaption({
				duration: 8,
				lines: [
					{
						text: "Line one",
						startTime: 2,
						endTime: 4,
						words: [{ word: "Line", start: 2, end: 3 }],
					},
					{
						text: "Line two",
						startTime: 4,
						endTime: 6,
						words: [{ word: "two", start: 4, end: 5 }],
					},
				],
			}),
		);
		expect(synced.lines[0].startTime).toBe(2);
		expect(synced.lines[0].endTime).toBe(10);
		expect(synced.lines[1].startTime).toBe(2);
		expect(synced.lines[1].endTime).toBe(10);
	});
});
