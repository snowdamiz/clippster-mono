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
		const similarity = normalizeSimilarity(settings.similarity);
		const smoothness = normalizeSmoothness(settings.smoothness);
		const spillReduction = normalizeSpill(settings.spillReduction);

		// Normalise settings: the GPU shader expects 0-1 ranges
		const gpuSettings: ChromakeySettings = {
			...settings,
			similarity,
			smoothness,
			spillReduction,
		};
		const gpuOk = applyChromakeyGPU(ctx, w, h, gpuSettings);
		if (gpuOk) return;
		console.warn("[Chromakey] GPU pass failed, using CPU fallback", {
			width: w,
			height: h,
			color: gpuSettings.color,
			similarity: gpuSettings.similarity,
			smoothness: gpuSettings.smoothness,
			spillReduction: gpuSettings.spillReduction,
		});
		// Fall through to CPU path on failure
	}

	// ── CPU fallback path ─────────────────────────────────────────────────
	const keyColor = hexToRgb(settings.color);
	if (!keyColor) return;

	const imageData = ctx.getImageData(0, 0, w, h);
	const data = imageData.data;

	const similarity = normalizeSimilarity(settings.similarity);
	const smoothness = normalizeSmoothness(settings.smoothness);
	const spillReduction = normalizeSpill(settings.spillReduction);

	// Convert key color to YCbCr for better chroma matching.
	// We keep Cb/Cr in normalized [0..1] to match the GPU math.
	const keyCb = (-0.169 * keyColor.r - 0.331 * keyColor.g + 0.5 * keyColor.b + 128) / 255;
	const keyCr = (0.5 * keyColor.r - 0.419 * keyColor.g - 0.081 * keyColor.b + 128) / 255;
	const edgeDist = Math.max(similarity + smoothness, similarity + 0.001);
	const spillRange = similarity + smoothness * 2 + 0.05;

	for (let i = 0; i < data.length; i += 4) {
		const r = data[i];
		const g = data[i + 1];
		const b = data[i + 2];

		// Convert pixel to YCbCr
		const cb = (-0.169 * r - 0.331 * g + 0.5 * b + 128) / 255;
		const cr = (0.5 * r - 0.419 * g - 0.081 * b + 128) / 255;

		// Chroma distance (ignore luminance for better results)
		const dist = Math.sqrt((cb - keyCb) ** 2 + (cr - keyCr) ** 2);
		const alpha = clamp01(smoothstep(similarity, edgeDist, dist));
		data[i + 3] = Math.round(alpha * data[i + 3]);

		if (spillReduction > 0) {
			const chromaProximity = Math.max(0, 1 - dist / Math.max(spillRange, 0.001));
			const spillMask = Math.min(1, (1 - alpha + chromaProximity) * 0.5) * spillReduction;
			if (spillMask > 0) {
				applySpillReduction(data, i, keyColor, spillMask);
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

function normalizeSimilarity(uiValue: number | undefined): number {
	return clamp01((uiValue ?? 0) / 100) * 0.4;
}

function normalizeSmoothness(uiValue: number | undefined): number {
	return clamp01((uiValue ?? 0) / 100) * 0.2;
}

function normalizeSpill(uiValue: number | undefined): number {
	return clamp01((uiValue ?? 0) / 100);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
	const width = Math.max(edge1 - edge0, 1e-6);
	const t = clamp01((x - edge0) / width);
	return t * t * (3 - 2 * t);
}

function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}
