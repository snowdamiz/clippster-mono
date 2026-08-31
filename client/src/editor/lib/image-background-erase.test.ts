import { describe, expect, it } from "vitest";
import { colorDistanceSq, visitMatchingPixels } from "./image-flood-fill";

describe("background / magic eraser primitives", () => {
	it("erases contiguous matching pixels inside a brush-like region via visitMatchingPixels", () => {
		const width = 8;
		const height = 8;
		const data = new Uint8ClampedArray(width * height * 4);
		// Fill with blue background
		for (let i = 0; i < width * height; i++) {
			data[i * 4] = 0;
			data[i * 4 + 1] = 0;
			data[i * 4 + 2] = 255;
			data[i * 4 + 3] = 255;
		}
		// Red subject in the center 2x2
		for (const [x, y] of [
			[3, 3],
			[4, 3],
			[3, 4],
			[4, 4],
		]) {
			const i = (y * width + x) * 4;
			data[i] = 255;
			data[i + 1] = 0;
			data[i + 2] = 0;
			data[i + 3] = 255;
		}

		const image = { width, height, data } as ImageData;
		const erased = visitMatchingPixels({
			image,
			x: 0,
			y: 0,
			tolerance: 8,
			contiguous: true,
			visit: (idx) => {
				const p = idx * 4;
				data[p] = 0;
				data[p + 1] = 0;
				data[p + 2] = 0;
				data[p + 3] = 0;
			},
		});

		expect(erased).toBe(width * height - 4);
		// Subject remains
		expect(data[(3 * width + 3) * 4 + 3]).toBe(255);
		// Background gone
		expect(data[3]).toBe(0);
	});

	it("colorDistanceSq treats near colors within tolerance", () => {
		expect(colorDistanceSq(10, 10, 10, 255, 12, 12, 12, 255)).toBeLessThanOrEqual(32 * 32);
		expect(colorDistanceSq(0, 0, 0, 255, 255, 0, 0, 255)).toBeGreaterThan(32 * 32);
	});
});
