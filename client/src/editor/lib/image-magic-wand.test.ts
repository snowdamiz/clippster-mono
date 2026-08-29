import { describe, expect, it } from "vitest";
import { getImageDrawLayout } from "./image-layer-mapping";
import { maskToContours, selectionFromWandMask, simplifyPolyline } from "./image-magic-wand";

function rectMask(width: number, height: number, x0: number, y0: number, x1: number, y1: number) {
	const mask = new Uint8Array(width * height);
	for (let y = y0; y < y1; y++) {
		for (let x = x0; x < x1; x++) {
			mask[y * width + x] = 1;
		}
	}
	return mask;
}

function pointInPoly(x: number, y: number, ring: Array<{ x: number; y: number }>): boolean {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const xi = ring[i].x;
		const yi = ring[i].y;
		const xj = ring[j].x;
		const yj = ring[j].y;
		const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
		if (intersect) inside = !inside;
	}
	return inside;
}

describe("maskToContours", () => {
	it("traces a closed ring around a solid rectangle", () => {
		const mask = rectMask(8, 8, 2, 2, 6, 6);
		const rings = maskToContours(mask, 8, 8);
		expect(rings.length).toBeGreaterThanOrEqual(1);
		expect(rings.length).toBe(1);
		const ring = rings[0];
		expect(ring.length).toBeGreaterThanOrEqual(4);
		expect(pointInPoly(4, 4, ring)).toBe(true);
		expect(pointInPoly(0.2, 0.2, ring)).toBe(false);
	});

	it("emits a hole ring for a donut", () => {
		const mask = rectMask(10, 10, 1, 1, 9, 9);
		for (let y = 4; y < 6; y++) {
			for (let x = 4; x < 6; x++) mask[y * 10 + x] = 0;
		}
		const rings = maskToContours(mask, 10, 10);
		expect(rings.length).toBeGreaterThanOrEqual(2);
	});
});

describe("simplifyPolyline", () => {
	it("collapses a colinear run to endpoints", () => {
		const out = simplifyPolyline(
			[
				{ x: 0, y: 0 },
				{ x: 1, y: 0 },
				{ x: 2, y: 0 },
				{ x: 3, y: 0 },
			],
			0.1,
		);
		expect(out).toEqual([
			{ x: 0, y: 0 },
			{ x: 3, y: 0 },
		]);
	});
});

describe("selectionFromWandMask", () => {
	it("maps a native mask onto a canvas-space path", () => {
		const layout = getImageDrawLayout({
			canvasW: 100,
			canvasH: 100,
			nativeW: 10,
			nativeH: 10,
		});
		const mask = rectMask(10, 10, 2, 2, 8, 8);
		const selection = selectionFromWandMask(layout, mask, 10, 10);
		expect(selection).not.toBeNull();
		expect(selection!.type).toBe("path");
		expect(selection!.points!.length).toBeGreaterThanOrEqual(3);
		expect(selection!.rings!.length).toBeGreaterThanOrEqual(1);
		expect(selection!.width).toBeGreaterThan(0.2);
		expect(selection!.height).toBeGreaterThan(0.2);
	});
});
