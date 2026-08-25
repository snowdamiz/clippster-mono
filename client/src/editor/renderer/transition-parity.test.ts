import { describe, expect, it } from "vitest";
import { renderTransition } from "./effects/canvas-transitions";

type PixelSource = { pixel: [number, number, number, number] };

class PixelContext {
	pixel: [number, number, number, number] = [0, 0, 0, 0];
	globalAlpha = 1;
	globalCompositeOperation = "source-over";
	filter = "none";

	save() {}
	restore() {}
	setTransform() {}

	drawImage(source: PixelSource) {
		const alpha = this.globalAlpha * (source.pixel[3] / 255);
		this.pixel = [
			Math.round(source.pixel[0] * alpha + this.pixel[0] * (1 - alpha)),
			Math.round(source.pixel[1] * alpha + this.pixel[1] * (1 - alpha)),
			Math.round(source.pixel[2] * alpha + this.pixel[2] * (1 - alpha)),
			Math.round((alpha + (this.pixel[3] / 255) * (1 - alpha)) * 255),
		];
	}
}

describe("preview/export transition pixel parity", () => {
	it("produces identical full-resolution pixels at transition progress samples", () => {
		const outgoing = { pixel: [255, 0, 0, 255] } satisfies PixelSource;
		const incoming = { pixel: [0, 0, 255, 255] } satisfies PixelSource;

		for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
			const preview = new PixelContext();
			const exported = new PixelContext();
			renderTransition(
				preview as unknown as CanvasRenderingContext2D,
				1920,
				1080,
				outgoing as unknown as CanvasImageSource,
				incoming as unknown as CanvasImageSource,
				progress,
				"crossfade",
			);
			renderTransition(
				exported as unknown as OffscreenCanvasRenderingContext2D,
				1920,
				1080,
				outgoing as unknown as CanvasImageSource,
				incoming as unknown as CanvasImageSource,
				progress,
				"crossfade",
			);
			expect(preview.pixel).toEqual(exported.pixel);
		}
	});
});
