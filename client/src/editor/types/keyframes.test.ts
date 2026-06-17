import { describe, it, expect } from "vitest";
import { evaluateKeyframeTrack, type KeyframeTrack } from "./keyframes";

const DEFAULT = 1.0;

function makeTrack(keyframes: KeyframeTrack["keyframes"]): KeyframeTrack {
	return { property: "scale", keyframes };
}

describe("evaluateKeyframeTrack", () => {
	const twoKeyframes = makeTrack([
		{ id: "a", offset: 0.25, value: 1.0, interpolation: "linear" },
		{ id: "b", offset: 0.75, value: 1.5, interpolation: "linear" },
	]);

	it("uses the clip base value before the first keyframe", () => {
		expect(evaluateKeyframeTrack(twoKeyframes, 0, DEFAULT)).toBe(1.0);
		expect(evaluateKeyframeTrack(twoKeyframes, 0.1, DEFAULT)).toBe(1.0);
		expect(evaluateKeyframeTrack(twoKeyframes, 0.25, DEFAULT)).toBe(1.0);
	});

	it("interpolates linearly between keyframes", () => {
		expect(evaluateKeyframeTrack(twoKeyframes, 0.5, DEFAULT)).toBeCloseTo(1.25, 5);
	});

	it("uses the clip base value after the last keyframe", () => {
		expect(evaluateKeyframeTrack(twoKeyframes, 0.75, DEFAULT)).toBe(1.5);
		expect(evaluateKeyframeTrack(twoKeyframes, 0.9, DEFAULT)).toBe(1.0);
		expect(evaluateKeyframeTrack(twoKeyframes, 1, DEFAULT)).toBe(1.0);
	});

	it("behaves identically when keyframes are unsorted in storage", () => {
		const unsorted = makeTrack([
			{ id: "b", offset: 0.75, value: 1.5, interpolation: "linear" },
			{ id: "a", offset: 0.25, value: 1.0, interpolation: "linear" },
		]);
		expect(evaluateKeyframeTrack(unsorted, 0.1, DEFAULT)).toBe(1.0);
		expect(evaluateKeyframeTrack(unsorted, 0.5, DEFAULT)).toBeCloseTo(1.25, 5);
		expect(evaluateKeyframeTrack(unsorted, 0.9, DEFAULT)).toBe(1.0);
	});

	it("clamps normalized time to 0..1", () => {
		expect(evaluateKeyframeTrack(twoKeyframes, -0.5, DEFAULT)).toBe(1.0);
		expect(evaluateKeyframeTrack(twoKeyframes, 1.5, DEFAULT)).toBe(1.0);
	});

	it("returns single keyframe value for entire clip", () => {
		const single = makeTrack([
			{ id: "a", offset: 0.5, value: 2.0, interpolation: "linear" },
		]);
		expect(evaluateKeyframeTrack(single, 0, DEFAULT)).toBe(2.0);
		expect(evaluateKeyframeTrack(single, 0.5, DEFAULT)).toBe(2.0);
		expect(evaluateKeyframeTrack(single, 1, DEFAULT)).toBe(2.0);
	});

	it("respects hold interpolation until the next keyframe", () => {
		const holdTrack = makeTrack([
			{ id: "a", offset: 0.25, value: 1.0, interpolation: "hold" },
			{ id: "b", offset: 0.75, value: 1.5, interpolation: "linear" },
		]);
		expect(evaluateKeyframeTrack(holdTrack, 0.5, DEFAULT)).toBe(1.0);
	});

	it("returns to base when first keyframe is above base and last is at clip end", () => {
		const zoomTrack = makeTrack([
			{ id: "a", offset: 0.25, value: 1.5, interpolation: "linear" },
			{ id: "b", offset: 0.75, value: 1.5, interpolation: "linear" },
		]);
		expect(evaluateKeyframeTrack(zoomTrack, 0.1, DEFAULT)).toBe(1.0);
		expect(evaluateKeyframeTrack(zoomTrack, 0.5, DEFAULT)).toBe(1.5);
		expect(evaluateKeyframeTrack(zoomTrack, 0.9, DEFAULT)).toBe(1.0);
	});
});
