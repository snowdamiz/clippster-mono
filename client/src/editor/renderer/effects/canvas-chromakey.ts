import type { ChromakeySettings } from "../../types/chromakey";
import { applyChromakeyGPU } from "./webgl-chromakey";

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * Apply chromakey (green screen) removal to the canvas.
 *
 * Tries the WebGL2 GPU path first (much faster for HD/4K frames).
 * Falls back to the CPU getImageData pixel loop if WebGL2 is unavailable.
 */
export function applyChromakey(
	ctx: Ctx,
	w: number,
	h: number,
	settings: ChromakeySettings,
): void {
	if (!settings.enabled) return;

	// ── GPU fast path (WebGL2) ────────────────────────────────────────────
	// Only available on CanvasRenderingContext2D (not OffscreenCanvas workers).
	if (ctx instanceof CanvasRenderingContext2D) {
		// Normalise settings: the GPU shader expects 0-1 ranges
		const gpuSettings: ChromakeySettings = {
			...settings,
			similarity: settings.similarity / 100,
			smoothness: settings.smoothness / 100,
			spillReduction: (settings.spillReduction ?? 0) / 100,
		};
		const gpuOk = applyChromakeyGPU(ctx, w, h, gpuSettings);
		if (gpuOk) return;
		// Fall through to CPU path on failure
	}

	// ── CPU fallback path ─────────────────────────────────────────────────
	const keyColor = hexToRgb(settings.color);
	if (!keyColor) return;

	const imageData = ctx.getImageData(0, 0, w, h);
	const data = imageData.data;

	const similarity = settings.similarity / 100;
	const smoothness = settings.smoothness / 100;
	const spillReduction = settings.spillReduction / 100;

	// Convert key color to YCbCr for better chroma matching
	const keyY = 0.299 * keyColor.r + 0.587 * keyColor.g + 0.114 * keyColor.b;
	const keyCb = 128 - 0.168736 * keyColor.r - 0.331264 * keyColor.g + 0.5 * keyColor.b;
	const keyCr = 128 + 0.5 * keyColor.r - 0.418688 * keyColor.g - 0.081312 * keyColor.b;

	const maxDist = similarity * 200; // max chroma distance for full transparency
	const edgeDist = maxDist + smoothness * 100; // distance for edge blending

	for (let i = 0; i < data.length; i += 4) {
		const r = data[i];
		const g = data[i + 1];
		const b = data[i + 2];

		// Convert pixel to YCbCr
		const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
		const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

		// Chroma distance (ignore luminance for better results)
		const dist = Math.sqrt((cb - keyCb) ** 2 + (cr - keyCr) ** 2);

		if (dist < maxDist) {
			// Fully transparent
			data[i + 3] = 0;
		} else if (dist < edgeDist) {
			// Edge blending
			const alpha = (dist - maxDist) / (edgeDist - maxDist);
			data[i + 3] = Math.round(alpha * data[i + 3]);

			// Spill reduction: reduce the key color component
			if (spillReduction > 0) {
				applySpillReduction(data, i, keyColor, spillReduction * alpha);
			}
		} else if (spillReduction > 0) {
			// Spill reduction on non-keyed pixels that are close-ish
			const spillDist = edgeDist * 2;
			if (dist < spillDist) {
				const spillAmount = (1 - (dist - edgeDist) / (spillDist - edgeDist)) * spillReduction * 0.5;
				applySpillReduction(data, i, keyColor, spillAmount);
			}
		}
	}

	ctx.putImageData(imageData, 0, 0);
}

function applySpillReduction(
	data: Uint8ClampedArray,
	i: number,
	keyColor: { r: number; g: number; b: number },
	amount: number,
): void {
	// Reduce the dominant channel of the key color
	const maxChannel = Math.max(keyColor.r, keyColor.g, keyColor.b);
	if (maxChannel === keyColor.g) {
		// Green screen: reduce green, boost red/blue slightly
		const excess = Math.max(0, data[i + 1] - Math.max(data[i], data[i + 2]));
		data[i + 1] = Math.round(data[i + 1] - excess * amount);
	} else if (maxChannel === keyColor.b) {
		// Blue screen
		const excess = Math.max(0, data[i + 2] - Math.max(data[i], data[i + 1]));
		data[i + 2] = Math.round(data[i + 2] - excess * amount);
	} else {
		// Red screen
		const excess = Math.max(0, data[i] - Math.max(data[i + 1], data[i + 2]));
		data[i] = Math.round(data[i] - excess * amount);
	}
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	if (!result) return null;
	return {
		r: parseInt(result[1], 16),
		g: parseInt(result[2], 16),
		b: parseInt(result[3], 16),
	};
}
