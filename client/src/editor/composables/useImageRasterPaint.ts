/**
 * Compositor-mode brush / eraser: paints on the selected image layer's bitmap,
 * or creates a new raster layer when nothing suitable is selected.
 */
import { ref } from "vue";
import { EditorCore } from "../core";
import type { ImageElement } from "../types/timeline";
import { useImageEditorTools } from "./useImageEditorTools";
import {
	applyCanvasToImageTransform,
	clipSelectionToContext,
	getImageDrawLayout,
	parseHexRgb,
} from "../lib/image-layer-mapping";
import {
	commitCanvasAsNewLayer,
	findSelectedImageLayer,
	loadBitmapFromAsset,
	recordImageEditHistory,
	writeNativeCanvasToMedia,
} from "../lib/image-raster-commit";

const scratchCanvas = ref<HTMLCanvasElement | null>(null);
const isPainting = ref(false);
const paintPreviewActive = ref(false);

function ensureScratch(width: number, height: number): HTMLCanvasElement {
	if (
		scratchCanvas.value &&
		scratchCanvas.value.width === width &&
		scratchCanvas.value.height === height
	) {
		return scratchCanvas.value;
	}
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	scratchCanvas.value = canvas;
	return canvas;
}

function scratchHasInk(canvas: HTMLCanvasElement): boolean {
	const ctx = canvas.getContext("2d");
	if (!ctx) return false;
	const { width, height } = canvas;
	const data = ctx.getImageData(0, 0, width, height).data;
	for (let i = 3; i < data.length; i += 4) {
		if (data[i] > 0) return true;
	}
	return false;
}

function applySelectionClip(ctx: CanvasRenderingContext2D, width: number, height: number) {
	const selection = useImageEditorTools().getLiveSelection();
	if (!selection) return;
	clipSelectionToContext(ctx, selection, width, height, selection.type);
}

function drawDab(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	radius: number,
	color: string,
	opacity: number,
	eraser: boolean,
	hardness: number,
) {
	ctx.save();
	const { r, g, b } = parseHexRgb(color);
	const hard = Math.min(1, Math.max(0, hardness));
	if (hard >= 0.99) {
		ctx.globalCompositeOperation = eraser ? "destination-out" : "source-over";
		ctx.fillStyle = eraser ? `rgba(0,0,0,${opacity})` : `rgba(${r},${g},${b},${opacity})`;
		ctx.beginPath();
		ctx.arc(x, y, radius, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
		return;
	}

	const inner = radius * hard;
	const gradient = ctx.createRadialGradient(x, y, inner, x, y, Math.max(radius, 0.5));
	if (eraser) {
		gradient.addColorStop(0, `rgba(0,0,0,${opacity})`);
		gradient.addColorStop(1, "rgba(0,0,0,0)");
		ctx.globalCompositeOperation = "destination-out";
	} else {
		gradient.addColorStop(0, `rgba(${r},${g},${b},${opacity})`);
		gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
		ctx.globalCompositeOperation = "source-over";
	}
	ctx.fillStyle = gradient;
	ctx.beginPath();
	ctx.arc(x, y, radius, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

function findTargetImageLayer(
	editor: EditorCore,
	selected: Array<{ trackId: string; elementId: string }>,
) {
	return findSelectedImageLayer(editor, selected);
}

async function mergeScratchOntoMedia(
	mediaId: string,
	scratch: HTMLCanvasElement,
	mode: "paint" | "erase",
	element: ImageElement,
) {
	const editor = EditorCore.getInstance();
	const project = editor.project.getActiveOrNull();
	if (!project) return;

	const asset = await editor.media.ensureAssetHydrated(mediaId);
	if (!asset || asset.type !== "image") return;

	const { width: canvasW, height: canvasH } = project.settings.canvasSize;
	const bitmap = await loadBitmapFromAsset(asset);
	const nativeW = bitmap.width;
	const nativeH = bitmap.height;
	const work = document.createElement("canvas");
	work.width = nativeW;
	work.height = nativeH;
	const ctx = work.getContext("2d");
	if (!ctx) {
		bitmap.close();
		return;
	}

	try {
		ctx.drawImage(bitmap, 0, 0);
	} finally {
		bitmap.close();
	}

	const layout = getImageDrawLayout({
		canvasW,
		canvasH,
		nativeW,
		nativeH,
		crop: element.crop,
		mediaFit: element.mediaFit,
		transform: element.transform,
		flip: element.flip,
	});

	ctx.save();
	applyCanvasToImageTransform(ctx, layout);
	ctx.globalCompositeOperation = mode === "erase" ? "destination-out" : "source-over";
	ctx.drawImage(scratch, 0, 0);
	ctx.restore();

	const filePath = asset.filePath;
	if (!filePath) {
		await commitCanvasAsNewLayer(scratch, mode === "erase" ? "Eraser" : "Brush");
		return;
	}

	try {
		await writeNativeCanvasToMedia(mediaId, work);
	} catch (e) {
		console.warn("[useImageRasterPaint] Failed to refresh media after paint:", e);
	}
}

export function blitScratchToOverlay(scratch: HTMLCanvasElement, overlay: HTMLCanvasElement) {
	const ctx = overlay.getContext("2d");
	if (!ctx) return;
	ctx.clearRect(0, 0, overlay.width, overlay.height);
	ctx.drawImage(scratch, 0, 0);
}

export function useImageRasterPaint() {
	const { brushSize, brushOpacity, brushHardness, fillColor, activeTool } = useImageEditorTools();

	let lastX = 0;
	let lastY = 0;

	function projectPixelFromEvent(
		event: PointerEvent,
		canvasEl: HTMLCanvasElement,
		projectWidth: number,
		projectHeight: number,
	): { x: number; y: number } | null {
		const rect = canvasEl.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return null;
		const x = ((event.clientX - rect.left) / rect.width) * projectWidth;
		const y = ((event.clientY - rect.top) / rect.height) * projectHeight;
		return {
			x: Math.min(projectWidth, Math.max(0, x)),
			y: Math.min(projectHeight, Math.max(0, y)),
		};
	}

	function startStroke(event: PointerEvent, canvasEl: HTMLCanvasElement) {
		const editor = EditorCore.getInstance();
		const project = editor.project.getActiveOrNull();
		if (!project) return false;

		const { width, height } = project.settings.canvasSize;
		const pt = projectPixelFromEvent(event, canvasEl, width, height);
		if (!pt) return false;

		const scratch = ensureScratch(width, height);
		const ctx = scratch.getContext("2d");
		if (!ctx) return false;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, width, height);

		isPainting.value = true;
		paintPreviewActive.value = true;
		lastX = pt.x;
		lastY = pt.y;

		const eraser = activeTool.value === "eraser";
		const radius = brushSize.value / 2;
		const opacity = brushOpacity.value;
		ctx.save();
		applySelectionClip(ctx, width, height);
		drawDab(ctx, pt.x, pt.y, radius, fillColor.value, opacity, eraser, brushHardness.value);
		ctx.restore();
		return true;
	}

	function continueStroke(event: PointerEvent, canvasEl: HTMLCanvasElement) {
		if (!isPainting.value || !scratchCanvas.value) return;
		const editor = EditorCore.getInstance();
		const project = editor.project.getActiveOrNull();
		if (!project) return;
		const { width, height } = project.settings.canvasSize;
		const pt = projectPixelFromEvent(event, canvasEl, width, height);
		if (!pt) return;

		const ctx = scratchCanvas.value.getContext("2d");
		if (!ctx) return;

		const eraser = activeTool.value === "eraser";
		const radius = brushSize.value / 2;
		const opacity = brushOpacity.value;
		const { r, g, b } = parseHexRgb(fillColor.value);
		const hardness = brushHardness.value;

		ctx.save();
		applySelectionClip(ctx, width, height);
		if (hardness >= 0.99) {
			ctx.lineCap = "round";
			ctx.lineJoin = "round";
			ctx.lineWidth = brushSize.value;
			if (eraser) {
				ctx.globalCompositeOperation = "destination-out";
				ctx.strokeStyle = `rgba(0,0,0,${opacity})`;
			} else {
				ctx.globalCompositeOperation = "source-over";
				ctx.strokeStyle = `rgba(${r},${g},${b},${opacity})`;
			}
			ctx.beginPath();
			ctx.moveTo(lastX, lastY);
			ctx.lineTo(pt.x, pt.y);
			ctx.stroke();
		} else {
			const dx = pt.x - lastX;
			const dy = pt.y - lastY;
			const dist = Math.hypot(dx, dy);
			const step = Math.max(1, radius * 0.35);
			const n = Math.max(1, Math.floor(dist / step));
			for (let i = 1; i <= n; i++) {
				drawDab(
					ctx,
					lastX + (dx * i) / n,
					lastY + (dy * i) / n,
					radius,
					fillColor.value,
					opacity,
					eraser,
					hardness,
				);
			}
		}
		drawDab(ctx, pt.x, pt.y, radius, fillColor.value, opacity, eraser, hardness);
		ctx.restore();
		lastX = pt.x;
		lastY = pt.y;
	}

	async function endStroke(selectedElements: Array<{ trackId: string; elementId: string }>) {
		isPainting.value = false;
		const scratch = scratchCanvas.value;
		if (!scratch || !scratchHasInk(scratch)) {
			paintPreviewActive.value = false;
			scratchCanvas.value = null;
			return;
		}

		const editor = EditorCore.getInstance();
		const eraser = activeTool.value === "eraser";
		const target = findTargetImageLayer(editor, selectedElements);

		try {
			if (target) {
				await mergeScratchOntoMedia(
					target.mediaId,
					scratch,
					eraser ? "erase" : "paint",
					target.element,
				);
				recordImageEditHistory(eraser ? "Eraser stroke" : "Brush stroke");
			} else if (!eraser) {
				await commitCanvasAsNewLayer(scratch, "Brush");
				recordImageEditHistory("Brush layer");
			}
		} catch (e) {
			console.error("[useImageRasterPaint] Commit failed:", e);
		}

		const ctx = scratch.getContext("2d");
		if (ctx) ctx.clearRect(0, 0, scratch.width, scratch.height);
		paintPreviewActive.value = false;
	}

	function clearScratchPreview() {
		if (scratchCanvas.value) {
			const ctx = scratchCanvas.value.getContext("2d");
			if (ctx) ctx.clearRect(0, 0, scratchCanvas.value.width, scratchCanvas.value.height);
		}
		paintPreviewActive.value = false;
	}

	return {
		scratchCanvas,
		isPainting,
		paintPreviewActive,
		startStroke,
		continueStroke,
		endStroke,
		clearScratchPreview,
	};
}
