import { describe, it, expect } from "vitest";
import { getValueForNewKeyframeAtOffset } from "./keyframe-property-defaults";
import type { ElementKeyframes } from "../types/keyframes";

describe("getValueForNewKeyframeAtOffset", () => {
	const elementKeyframes: ElementKeyframes = {
		elementId: "el-1",
		tracks: {
			scale: {
				property: "scale",
				keyframes: [
					{ id: "a", offset: 0.25, value: 1.0, interpolation: "linear" },
					{ id: "b", offset: 0.75, value: 1.5, interpolation: "linear" },
				],
			},
		},
	};

	it("uses static default when placing after the last keyframe", () => {
		expect(
			getValueForNewKeyframeAtOffset({
				elementKeyframes,
				property: "scale",
				offset: 1,
				staticDefault: 1,
			}),
		).toBe(1);
	});

	it("uses static default when placing before the first keyframe", () => {
		expect(
			getValueForNewKeyframeAtOffset({
				elementKeyframes,
				property: "scale",
				offset: 0,
				staticDefault: 1,
			}),
		).toBe(1);
	});

	it("samples the curve when placing between keyframes", () => {
		expect(
			getValueForNewKeyframeAtOffset({
				elementKeyframes,
				property: "scale",
				offset: 0.5,
				staticDefault: 1,
			}),
		).toBeCloseTo(1.25, 5);
	});
});
