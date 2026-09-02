import { describe, expect, it } from "vitest";
import { colorDistanceSq, floodFillImageData, floodSelectMask } from "./image-flood-fill";

function makeImage(width: number, height: number, fill: [number, number, number, number]): ImageData {
	const data = new Uint8ClampedArray(width * height * 4);
	for (let i = 0; i < data.length; i += 4) {
		data[i] = fill[0];
		data[i + 1] = fill[1];
		data[i + 2] = fill[2];
		data[i + 3] = fill[3];
	}
	return { width, height, data, colorSpace: "srgb" } as ImageData;
}

describe("colorDistanceSq", () => {
	it("is zero for identical pixels", () => {
		expect(colorDistanceSq(10, 20, 30, 40, 10, 20, 30, 40)).toBe(0);
	});
});

describe("floodFillImageData", () => {
	it("fills a contiguous region and stops at a wall", () => {
		const image = makeImage(5, 3, [255, 255, 255, 255]);
		// vertical wall of black in column 2
		for (let y = 0; y < 3; y++) {
			const i = (y * 5 + 2) * 4;
			image.data[i] = 0;
			image.data[i + 1] = 0;
			image.data[i + 2] = 0;
		}

		const filled = floodFillImageData({
			image,
			x: 0,
			y: 1,
			fill: { r: 255, g: 0, b: 0, a: 255 },
			tolerance: 0,
		});

		expect(filled).toBe(6);
		expect(image.data[0]).toBe(255);
		expect(image.data[1]).toBe(0);
		expect(image.data[(2 * 4)]).toBe(0);
		expect(image.data[(3 * 4)]).toBe(255);
		expect(image.data[(3 * 4) + 1]).toBe(255);
	});

	it("respects a mask", () => {
		const image = makeImage(3, 1, [255, 255, 255, 255]);
		const mask = new Uint8ClampedArray(12);
		mask[3] = 255;
		mask[7] = 0;
		mask[11] = 255;

		floodFillImageData({
			image,
			x: 0,
			y: 0,
			fill: { r: 0, g: 255, b: 0, a: 255 },
			tolerance: 0,
			mask,
		});

		expect(image.data[0]).toBe(0);
		expect(image.data[1]).toBe(255);
		expect(image.data[4]).toBe(255);
	});
});

describe("floodSelectMask", () => {
	it("selects a contiguous region without mutating pixels", () => {
		const image = makeImage(5, 3, [255, 255, 255, 255]);
		for (let y = 0; y < 3; y++) {
			const i = (y * 5 + 2) * 4;
			image.data[i] = 0;
			image.data[i + 1] = 0;
			image.data[i + 2] = 0;
		}

		const { selected, count, maxX } = floodSelectMask({
			image,
			x: 0,
			y: 1,
			tolerance: 0,
			contiguous: true,
		});

		expect(count).toBe(6);
		expect(maxX).toBe(1);
		expect(selected[0]).toBe(1);
		expect(selected[2]).toBe(0);
		expect(image.data[0]).toBe(255);
		expect(image.data[1]).toBe(255);
	});

	it("selects every matching pixel when contiguous is off", () => {
		const image = makeImage(4, 1, [0, 0, 0, 255]);
		image.data[4] = 255;
		image.data[5] = 255;
		image.data[6] = 255;
		image.data[12] = 0;
		image.data[13] = 0;
		image.data[14] = 0;

		const { count, selected } = floodSelectMask({
			image,
			x: 0,
			y: 0,
			tolerance: 0,
			contiguous: false,
		});

		expect(count).toBe(3);
		expect(selected[0]).toBe(1);
		expect(selected[1]).toBe(0);
		expect(selected[3]).toBe(1);
	});
});
