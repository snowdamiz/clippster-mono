import { describe, expect, it, vi } from "vitest";
import {
	canvasPointToImagePixel,
	clipSelectionToContext,
	getImageDrawLayout,
	imagePixelToCanvasPoint,
	parseHexRgb,
	selectionBoundingBox,
} from "./image-layer-mapping";

describe("parseHexRgb", () => {
	it("parses 6-digit and 3-digit hex", () => {
		expect(parseHexRgb("#ff8800")).toEqual({ r: 255, g: 136, b: 0 });
		expect(parseHexRgb("#f80")).toEqual({ r: 255, g: 136, b: 0 });
	});
});

describe("getImageDrawLayout", () => {
	it("contain-fits a matching canvas image to the full frame", () => {
		const layout = getImageDrawLayout({
			canvasW: 1280,
			canvasH: 720,
			nativeW: 1280,
			nativeH: 720,
		});
		expect(layout.dx).toBe(0);
		expect(layout.dy).toBe(0);
		expect(layout.dw).toBe(1280);
		expect(layout.dh).toBe(720);
	});

	it("letterboxes a tall image on a wide canvas", () => {
		const layout = getImageDrawLayout({
			canvasW: 1000,
			canvasH: 500,
			nativeW: 100,
			nativeH: 200,
		});
		expect(layout.dw).toBeCloseTo(250);
		expect(layout.dh).toBeCloseTo(500);
		expect(layout.dx).toBeCloseTo(375);
		expect(layout.dy).toBeCloseTo(0);
	});
});

describe("canvasPointToImagePixel", () => {
	it("maps the canvas center to the image center with identity transform", () => {
		const layout = getImageDrawLayout({
			canvasW: 1000,
			canvasH: 500,
			nativeW: 200,
			nativeH: 100,
		});
		const pt = canvasPointToImagePixel(layout, 500, 250);
		expect(pt.x).toBeCloseTo(100);
		expect(pt.y).toBeCloseTo(50);
	});

	it("follows a translated layer", () => {
		const layout = getImageDrawLayout({
			canvasW: 1000,
			canvasH: 500,
			nativeW: 200,
			nativeH: 100,
			transform: { scale: 1, position: { x: 100, y: 0 }, rotate: 0 },
		});
		const pt = canvasPointToImagePixel(layout, 600, 250);
		expect(pt.x).toBeCloseTo(100);
		expect(pt.y).toBeCloseTo(50);
	});

	it("round-trips through imagePixelToCanvasPoint", () => {
		const layout = getImageDrawLayout({
			canvasW: 1000,
			canvasH: 500,
			nativeW: 200,
			nativeH: 100,
			transform: { scale: 1.25, position: { x: 40, y: -10 }, rotate: 0 },
		});
		const canvas = { x: 610, y: 240 };
		const image = canvasPointToImagePixel(layout, canvas.x, canvas.y);
		const back = imagePixelToCanvasPoint(layout, image.x, image.y);
		expect(back.x).toBeCloseTo(canvas.x);
		expect(back.y).toBeCloseTo(canvas.y);
	});
});

describe("selectionBoundingBox", () => {
	it("returns null for fewer than 3 points or a degenerate path", () => {
		expect(selectionBoundingBox([{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.4 }])).toBeNull();
		expect(
			selectionBoundingBox([
				{ x: 0.5, y: 0.5 },
				{ x: 0.501, y: 0.5 },
				{ x: 0.5, y: 0.501 },
			]),
		).toBeNull();
	});

	it("computes a normalized bbox for a lasso path", () => {
		const box = selectionBoundingBox([
			{ x: 0.2, y: 0.3 },
			{ x: 0.8, y: 0.25 },
			{ x: 0.6, y: 0.7 },
		]);
		expect(box).not.toBeNull();
		expect(box!.x).toBeCloseTo(0.2);
		expect(box!.y).toBeCloseTo(0.25);
		expect(box!.width).toBeCloseTo(0.6);
		expect(box!.height).toBeCloseTo(0.45);
	});
});

describe("clipSelectionToContext", () => {
	function mockCtx() {
		return {
			beginPath: vi.fn(),
			moveTo: vi.fn(),
			lineTo: vi.fn(),
			closePath: vi.fn(),
			ellipse: vi.fn(),
			rect: vi.fn(),
			clip: vi.fn(),
		};
	}

	it("clips a path selection through the polyline", () => {
		const ctx = mockCtx();
		clipSelectionToContext(
			ctx as unknown as CanvasRenderingContext2D,
			{
				type: "path",
				x: 0.1,
				y: 0.1,
				width: 0.4,
				height: 0.4,
				points: [
					{ x: 0.1, y: 0.1 },
					{ x: 0.5, y: 0.1 },
					{ x: 0.3, y: 0.5 },
				],
			},
			1000,
			500,
		);
		expect(ctx.moveTo).toHaveBeenCalledWith(100, 50);
		expect(ctx.lineTo).toHaveBeenCalledWith(500, 50);
		expect(ctx.lineTo).toHaveBeenCalledWith(300, 250);
		expect(ctx.clip).toHaveBeenCalledOnce();
		expect(ctx.rect).not.toHaveBeenCalled();
	});

	it("clips an ellipse selection", () => {
		const ctx = mockCtx();
		clipSelectionToContext(
			ctx as unknown as CanvasRenderingContext2D,
			{ type: "ellipse", x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
			200,
			100,
		);
		expect(ctx.ellipse).toHaveBeenCalledWith(100, 50, 50, 25, 0, 0, Math.PI * 2);
		expect(ctx.clip).toHaveBeenCalledOnce();
	});
});
