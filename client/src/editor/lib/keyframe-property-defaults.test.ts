import { describe, it, expect } from "vitest";
import { getValueForNewKeyframeAtOffset, getKeyframePropertyStaticDefault } from "./keyframe-property-defaults";
import type { ElementKeyframes } from "../types/keyframes";
import type { VideoElement } from "../types/timeline";

describe("getKeyframePropertyStaticDefault", () => {
	it("defaults scale to 100% when transform.scale is missing", () => {
		const element = {
			id: "v1",
			type: "video",
			name: "Clip",
			startTime: 0,
			duration: 10,
			trimStart: 0,
			trimEnd: 0,
			mediaId: "m1",
			transform: { scale: undefined as unknown as number, position: { x: 0, y: 0 }, rotate: 0 },
			opacity: 1,
		} satisfies VideoElement;

		expect(getKeyframePropertyStaticDefault(element, "scale")).toBe(1);
	});
});

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
