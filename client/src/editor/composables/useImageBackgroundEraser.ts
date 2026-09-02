/**
 * Photoshop-style Background Eraser + Magic Eraser (performance path).
 *
 * Strokes mutate an in-memory ImageData buffer only. Live feedback is a
 * canvas-space erase mask blitted to the paint overlay (checkerboard).
 * Media is written once on pointer-up — never mid-stroke.
 */
import { ref } from "vue";
import { EditorCore } from "../core";
import {
	applyCanvasToImageTransform,
	canvasPointToImagePixel,
	clipSelectionToContext,
	getImageDrawLayout,
} from "../lib/image-layer-mapping";
import { colorDistanceSq, visitMatchingPixels } from "../lib/image-flood-fill";
import {
	findSelectedImageLayer,
	loadBitmapFromAsset,
	recordImageEditHistory,
	writeNativeCanvasToMedia,
} from "../lib/image-raster-commit";
import { getCheckerPattern } from "./useImageRasterPaint";
import { useImageEditorTools } from "./useImageEditorTools";

export type BgEraserSampling = "continuous" | "once";
export type BgEraserLimits = "contiguous" | "discontiguous";

const bgEraserSampling = ref<BgEraserSampling>("continuous");
const bgEraserLimits = ref<BgEraserLimits>("contiguous");
const bgEraserTolerance = ref(32);
const isBgErasing = ref(false);
/** Canvas-space erase mask for live overlay (shared with PreviewPanel). */
const bgEraseScratch = ref<HTMLCanvasElement | null>(null);
const bgErasePreviewActive = ref(false);

function projectPixelFromEvent(
	event: PointerEvent,
	canvasEl: HTMLCanvasElement,
	projectWidth: number,
	projectHeight: number,
): { x: number; y: number } | null {
	const rect = canvasEl.getBoundingClientRect();
	if (rect.width <= 0 || rect.height <= 0) return null;
	return {
		x: Math.min(projectWidth, Math.max(0, ((event.clientX - rect.left) / rect.width) * projectWidth)),
		y: Math.min(projectHeight, Math.max(0, ((event.clientY - rect.top) / rect.height) * projectHeight)),
	};
}

function brushFalloff(dist: number, radius: number, hardness: number, opacity: number): number {
	if (dist > radius) return 0;
	const hard = Math.min(1, Math.max(0, hardness));
	const inner = radius * hard;
	let cover = 1;
	if (hard < 0.99 && dist > inner) {
		cover = 1 - (dist - inner) / Math.max(0.001, radius - inner);
	}
	return cover * opacity;
}

function nativeBrushRadius(
	layout: ReturnType<typeof getImageDrawLayout>,
	canvasBrushSize: number,
): number {
	const scale =
		Number.isFinite(layout.transform.scale) && layout.transform.scale !== 0
			? Math.abs(layout.transform.scale)
			: 1;
	const sx = layout.sw / Math.max(layout.dw, 1e-6);
	return Math.max(1, (canvasBrushSize / 2) * (sx / scale));
}

function ensureScratch(width: number, height: number): HTMLCanvasElement {
	const existing = bgEraseScratch.value;
	if (existing && existing.width === width && existing.height === height) return existing;
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	bgEraseScratch.value = canvas;
	return canvas;
}

export function useImageBackgroundEraser() {
	const { brushSize, brushHardness, brushOpacity, getLiveSelection } = useImageEditorTools();

	let work: HTMLCanvasElement | null = null;
	let workCtx: CanvasRenderingContext2D | null = null;
	/** Full-buffer pixel data — mutated in place; no per-dab full copies. */
	let pixels: ImageData | null = null;
	let mediaId: string | null = null;
	let layout: ReturnType<typeof getImageDrawLayout> | null = null;
	let mask: Uint8ClampedArray | null = null;
	let lastX = 0;
	let lastY = 0;
	let onceSample: [number, number, number, number] | null = null;
	let scratchCtx: CanvasRenderingContext2D | null = null;
	let pendingCanvasPts: Array<{ x: number; y: number }> = [];
	let starting = false;

	function renderBgErasePreview() {
		if (!work || !layout || !scratchCtx) return;
		const { canvasW, canvasH } = layout;
		scratchCtx.setTransform(1, 0, 0, 1, 0, 0);
		scratchCtx.clearRect(0, 0, canvasW, canvasH);
		const pattern = getCheckerPattern(scratchCtx);
		if (pattern) {
			scratchCtx.fillStyle = pattern;
			scratchCtx.fillRect(0, 0, canvasW, canvasH);
		}
		scratchCtx.save();
		applyCanvasToImageTransform(scratchCtx, layout);
		scratchCtx.drawImage(work, 0, 0);
		scratchCtx.restore();
	}

	function eraseDab(cx: number, cy: number) {
		if (!work || !workCtx || !pixels || !layout) return;
		const data = pixels.data;
		const w = work.width;
		const h = work.height;
		const radius = nativeBrushRadius(layout, brushSize.value);
		const hardness = brushHardness.value;
		const opacity = brushOpacity.value;
		const tolerance = bgEraserTolerance.value;
		const maxDist = Math.max(0, tolerance) ** 2;

		const sampleX = Math.min(w - 1, Math.max(0, Math.round(cx)));
		const sampleY = Math.min(h - 1, Math.max(0, Math.round(cy)));
		const si = (sampleY * w + sampleX) * 4;

		let sr: number, sg: number, sb: number, sa: number;
		if (bgEraserSampling.value === "once" && onceSample) {
			[sr, sg, sb, sa] = onceSample;
		} else {
			sr = data[si];
			sg = data[si + 1];
			sb = data[si + 2];
			sa = data[si + 3];
			if (bgEraserSampling.value === "once") onceSample = [sr, sg, sb, sa];
		}

		// Already transparent under the crosshair — nothing to erase.
		if (sa === 0 && bgEraserSampling.value === "continuous") {
			return;
		}

		const r2 = radius * radius;
		const minX = Math.max(0, Math.floor(cx - radius));
		const maxX = Math.min(w - 1, Math.ceil(cx + radius));
		const minY = Math.max(0, Math.floor(cy - radius));
		const maxY = Math.min(h - 1, Math.ceil(cy + radius));
		const bw = maxX - minX + 1;
		const bh = maxY - minY + 1;
		if (bw <= 0 || bh <= 0) return;

		const matches = (i: number) =>
			colorDistanceSq(data[i], data[i + 1], data[i + 2], data[i + 3], sr, sg, sb, sa) <= maxDist;

		let erasedAny = false;

		if (bgEraserLimits.value === "contiguous") {
			const seen = new Uint8Array(bw * bh);
			const stack: number[] = [sampleX, sampleY];
			while (stack.length > 0) {
				const py = stack.pop()!;
				const px = stack.pop()!;
				if (px < minX || px > maxX || py < minY || py > maxY) continue;
				const local = (py - minY) * bw + (px - minX);
				if (seen[local]) continue;
				seen[local] = 1;
				const dx = px - cx;
				const dy = py - cy;
				if (dx * dx + dy * dy > r2) continue;
				const idx = py * w + px;
				if (mask && mask[idx * 4 + 3] === 0) continue;
				const pi = idx * 4;
				if (!matches(pi)) continue;

				const cover = brushFalloff(Math.hypot(dx, dy), radius, hardness, opacity);
				if (cover > 0) {
					const nextA = Math.max(0, Math.round(data[pi + 3] * (1 - cover)));
					if (nextA !== data[pi + 3]) erasedAny = true;
					data[pi + 3] = nextA;
					if (nextA === 0) {
						data[pi] = 0;
						data[pi + 1] = 0;
						data[pi + 2] = 0;
					}
				}
				stack.push(px - 1, py, px + 1, py, px, py - 1, px, py + 1);
			}
		} else {
			for (let py = minY; py <= maxY; py++) {
				for (let px = minX; px <= maxX; px++) {
					const idx = py * w + px;
					if (mask && mask[idx * 4 + 3] === 0) continue;
					const dx = px - cx;
					const dy = py - cy;
					const d2 = dx * dx + dy * dy;
					if (d2 > r2) continue;
					const pi = idx * 4;
					if (!matches(pi)) continue;
					const cover = brushFalloff(Math.sqrt(d2), radius, hardness, opacity);
					if (cover <= 0) continue;
					const nextA = Math.max(0, Math.round(data[pi + 3] * (1 - cover)));
					if (nextA !== data[pi + 3]) erasedAny = true;
					data[pi + 3] = nextA;
					if (nextA === 0) {
						data[pi] = 0;
						data[pi + 1] = 0;
						data[pi + 2] = 0;
					}
				}
			}
		}

		if (erasedAny) {
			// Region put only — avoids full-frame uploads every dab.
			workCtx.putImageData(pixels, 0, 0, minX, minY, bw, bh);
			renderBgErasePreview();
		}
	}

	function flushPending() {
		if (!isBgErasing.value || !layout || pendingCanvasPts.length === 0) return;
		const pts = pendingCanvasPts;
		pendingCanvasPts = [];
		for (const p of pts) {
			const dest = canvasPointToImagePixel(layout, p.x, p.y);
			const dx = dest.x - lastX;
			const dy = dest.y - lastY;
			const dist = Math.hypot(dx, dy);
			const step = Math.max(1, nativeBrushRadius(layout, brushSize.value) * 0.5);
			const n = Math.max(1, Math.floor(dist / step));
			for (let i = 1; i <= n; i++) {
				eraseDab(lastX + (dx * i) / n, lastY + (dy * i) / n);
			}
			lastX = dest.x;
			lastY = dest.y;
		}
	}

	async function startBgErase(event: PointerEvent, canvasEl: HTMLCanvasElement) {
		if (starting || isBgErasing.value) return false;
		starting = true;
		try {
			const editor = EditorCore.getInstance();
			const project = editor.project.getActiveOrNull();
			if (!project) return false;

			useImageEditorTools().selectFirstImageIfNeeded();
			const target = findSelectedImageLayer(editor, editor.selection.getSelectedElements());
			if (!target) return false;
			const asset = await editor.media.ensureAssetHydrated(target.mediaId);
			if (!asset || asset.type !== "image") return false;

			const bitmap = await loadBitmapFromAsset(asset);
			work = document.createElement("canvas");
			work.width = bitmap.width;
			work.height = bitmap.height;
			workCtx = work.getContext("2d", { willReadFrequently: true });
			if (!workCtx) {
				bitmap.close();
				return false;
			}
			workCtx.drawImage(bitmap, 0, 0);
			bitmap.close();
			pixels = workCtx.getImageData(0, 0, work.width, work.height);
			mediaId = target.mediaId;
			layout = getImageDrawLayout({
				canvasW: project.settings.canvasSize.width,
				canvasH: project.settings.canvasSize.height,
				nativeW: work.width,
				nativeH: work.height,
				crop: target.element.crop,
				mediaFit: target.element.mediaFit,
				transform: target.element.transform,
				flip: target.element.flip,
			});

			const selection = getLiveSelection();
			mask = null;
			if (selection) {
				const maskCanvas = document.createElement("canvas");
				maskCanvas.width = work.width;
				maskCanvas.height = work.height;
				const maskCtx = maskCanvas.getContext("2d");
				if (maskCtx) {
					maskCtx.save();
					applyCanvasToImageTransform(maskCtx, layout);
					clipSelectionToContext(maskCtx, selection, layout.canvasW, layout.canvasH, selection.type);
					maskCtx.fillStyle = "#fff";
					maskCtx.fillRect(0, 0, layout.canvasW, layout.canvasH);
					maskCtx.restore();
					mask = maskCtx.getImageData(0, 0, work.width, work.height).data;
				}
			}

			const scratch = ensureScratch(layout.canvasW, layout.canvasH);
			scratchCtx = scratch.getContext("2d");
			if (scratchCtx) {
				scratchCtx.setTransform(1, 0, 0, 1, 0, 0);
				scratchCtx.clearRect(0, 0, scratch.width, scratch.height);
			}
			bgErasePreviewActive.value = true;

			const pt = projectPixelFromEvent(event, canvasEl, layout.canvasW, layout.canvasH);
			if (!pt) return false;
			const dest = canvasPointToImagePixel(layout, pt.x, pt.y);
			onceSample = null;
			lastX = dest.x;
			lastY = dest.y;
			isBgErasing.value = true;
			eraseDab(dest.x, dest.y);
			renderBgErasePreview();
			flushPending();
			return true;
		} finally {
			starting = false;
		}
	}

	function continueBgErase(event: PointerEvent, canvasEl: HTMLCanvasElement) {
		const editor = EditorCore.getInstance();
		const project = editor.project.getActiveOrNull();
		if (!project) return;
		const { width, height } = project.settings.canvasSize;
		const pt = projectPixelFromEvent(event, canvasEl, width, height);
		if (!pt) return;

		if (!isBgErasing.value || !layout) {
			pendingCanvasPts.push(pt);
			return;
		}

		const dest = canvasPointToImagePixel(layout, pt.x, pt.y);
		const dx = dest.x - lastX;
		const dy = dest.y - lastY;
		const dist = Math.hypot(dx, dy);
		const step = Math.max(1, nativeBrushRadius(layout, brushSize.value) * 0.5);
		const n = Math.max(1, Math.floor(dist / step));
		for (let i = 1; i <= n; i++) {
			eraseDab(lastX + (dx * i) / n, lastY + (dy * i) / n);
		}
		lastX = dest.x;
		lastY = dest.y;
	}

	async function endBgErase() {
		isBgErasing.value = false;
		pendingCanvasPts = [];
		if (!work || !mediaId || !pixels || !workCtx) {
			bgErasePreviewActive.value = false;
			work = null;
			workCtx = null;
			pixels = null;
			mask = null;
			layout = null;
			onceSample = null;
			scratchCtx = null;
			return false;
		}
		try {
			workCtx.putImageData(pixels, 0, 0);
			await writeNativeCanvasToMedia(mediaId, work);
			recordImageEditHistory("Background eraser");
			return true;
		} catch (e) {
			console.error("[useImageBackgroundEraser] Commit failed:", e);
			return false;
		} finally {
			bgErasePreviewActive.value = false;
			work = null;
			workCtx = null;
			pixels = null;
			mediaId = null;
			mask = null;
			layout = null;
			onceSample = null;
			scratchCtx = null;
		}
	}

	return {
		bgEraserSampling,
		bgEraserLimits,
		bgEraserTolerance,
		isBgErasing,
		bgEraseScratch,
		bgErasePreviewActive,
		startBgErase,
		continueBgErase,
		endBgErase,
	};
}

/** Magic Eraser: one-click flood erase of similar colors. */
export async function magicEraseAtCanvasPoint({
	canvasX,
	canvasY,
	tolerance,
	contiguous,
}: {
	canvasX: number;
	canvasY: number;
	tolerance: number;
	contiguous: boolean;
}): Promise<boolean> {
	const editor = EditorCore.getInstance();
	const project = editor.project.getActiveOrNull();
	if (!project) return false;

	useImageEditorTools().selectFirstImageIfNeeded();
	const target = findSelectedImageLayer(editor, editor.selection.getSelectedElements());
	if (!target) return false;
	const asset = await editor.media.ensureAssetHydrated(target.mediaId);
	if (!asset || asset.type !== "image") return false;

	const bitmap = await loadBitmapFromAsset(asset);
	const work = document.createElement("canvas");
	work.width = bitmap.width;
	work.height = bitmap.height;
	const ctx = work.getContext("2d", { willReadFrequently: true });
	if (!ctx) {
		bitmap.close();
		return false;
	}
	ctx.drawImage(bitmap, 0, 0);
	bitmap.close();

	const layout = getImageDrawLayout({
		canvasW: project.settings.canvasSize.width,
		canvasH: project.settings.canvasSize.height,
		nativeW: work.width,
		nativeH: work.height,
		crop: target.element.crop,
		mediaFit: target.element.mediaFit,
		transform: target.element.transform,
		flip: target.element.flip,
	});

	const mapped = canvasPointToImagePixel(layout, canvasX, canvasY);
	const imagePt = { x: Math.round(mapped.x), y: Math.round(mapped.y) };
	if (imagePt.x < 0 || imagePt.y < 0 || imagePt.x >= work.width || imagePt.y >= work.height) {
		return false;
	}

	const selection = useImageEditorTools().getLiveSelection();
	let mask: Uint8ClampedArray | null = null;
	if (selection) {
		const maskCanvas = document.createElement("canvas");
		maskCanvas.width = work.width;
		maskCanvas.height = work.height;
		const maskCtx = maskCanvas.getContext("2d");
		if (maskCtx) {
			maskCtx.save();
			applyCanvasToImageTransform(maskCtx, layout);
			clipSelectionToContext(maskCtx, selection, layout.canvasW, layout.canvasH, selection.type);
			maskCtx.fillStyle = "#fff";
			maskCtx.fillRect(0, 0, layout.canvasW, layout.canvasH);
			maskCtx.restore();
			mask = maskCtx.getImageData(0, 0, work.width, work.height).data;
		}
	}

	const image = ctx.getImageData(0, 0, work.width, work.height);
	const erased = visitMatchingPixels({
		image,
		x: imagePt.x,
		y: imagePt.y,
		tolerance,
		mask,
		contiguous,
		visit: (idx) => {
			const p = idx * 4;
			image.data[p] = 0;
			image.data[p + 1] = 0;
			image.data[p + 2] = 0;
			image.data[p + 3] = 0;
		},
	});
	if (erased <= 0) return false;
	ctx.putImageData(image, 0, 0);
	const wrote = await writeNativeCanvasToMedia(target.mediaId, work);
	if (wrote) recordImageEditHistory("Magic eraser");
	return wrote;
}
