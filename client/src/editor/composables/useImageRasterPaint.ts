/**
 * Compositor-mode brush / eraser: paints on the selected image layer's bitmap,
 * or creates a new raster layer when nothing suitable is selected.
 *
 * Eraser paints an opaque mask on the scratch canvas (source-over), then merges
 * onto the media with destination-out — matching Photoshop's destructive erase.
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
let scratchHasInkFlag = false;

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
	scratchHasInkFlag = false;
	return canvas;
}

function applySelectionClip(ctx: CanvasRenderingContext2D, width: number, height: number) {
	const selection = useImageEditorTools().getLiveSelection();
	if (!selection) return;
	clipSelectionToContext(ctx, selection, width, height, selection.type);
}

/**
 * Draw a brush dab. For eraser, always paint an opaque erase *mask* with
 * source-over — never destination-out on an empty scratch (that writes nothing).
 */
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
	ctx.globalCompositeOperation = "source-over";
	const { r, g, b } = parseHexRgb(color);
	const hard = Math.min(1, Math.max(0, hardness));
	if (hard >= 0.99) {
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
	} else {
		gradient.addColorStop(0, `rgba(${r},${g},${b},${opacity})`);
		gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
	}
	ctx.fillStyle = gradient;
	ctx.beginPath();
	ctx.arc(x, y, radius, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

async function mergeScratchOntoMedia(
	mediaId: string,
	scratch: HTMLCanvasElement,
	mode: "paint" | "erase",
	element: ImageElement,
) {
	const editor = EditorCore.getInstance();
	const project = editor.project.getActiveOrNull();
	if (!project) return false;

	const asset = await editor.media.ensureAssetHydrated(mediaId);
	if (!asset || asset.type !== "image") return false;

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
		return false;
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

	return writeNativeCanvasToMedia(mediaId, work);
}

/** Live overlay: paint shows ink; erase shows a checkerboard punch-out (not opaque white). */
let checkerPattern: CanvasPattern | null = null;

function getCheckerPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
	if (checkerPattern) return checkerPattern;
	const tile = document.createElement("canvas");
	tile.width = 16;
	tile.height = 16;
	const t = tile.getContext("2d");
	if (!t) return null;
	t.fillStyle = "#c8c8c8";
	t.fillRect(0, 0, 16, 16);
	t.fillStyle = "#ffffff";
	t.fillRect(0, 0, 8, 8);
	t.fillRect(8, 8, 8, 8);
	checkerPattern = ctx.createPattern(tile, "repeat");
	return checkerPattern;
}

export function blitScratchToOverlay(
	scratch: HTMLCanvasElement,
	overlay: HTMLCanvasElement,
	mode: "paint" | "erase" = "paint",
) {
	const ctx = overlay.getContext("2d");
	if (!ctx) return;
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.clearRect(0, 0, overlay.width, overlay.height);
	if (mode === "erase") {
		ctx.drawImage(scratch, 0, 0);
		ctx.globalCompositeOperation = "source-in";
		const pattern = getCheckerPattern(ctx);
		ctx.fillStyle = pattern ?? "rgba(200,200,200,0.9)";
		ctx.fillRect(0, 0, overlay.width, overlay.height);
		ctx.globalCompositeOperation = "source-over";
		return;
	}
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

	function isEraserTool() {
		return activeTool.value === "eraser";
	}

	function effectiveHardness() {
		return activeTool.value === "pencil" ? 1 : brushHardness.value;
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
		scratchHasInkFlag = false;
		lastX = pt.x;
		lastY = pt.y;

		const eraser = isEraserTool();
		const radius = brushSize.value / 2;
		const opacity = brushOpacity.value;
		ctx.save();
		applySelectionClip(ctx, width, height);
		drawDab(ctx, pt.x, pt.y, radius, fillColor.value, opacity, eraser, effectiveHardness());
		ctx.restore();
		scratchHasInkFlag = true;
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

		const eraser = isEraserTool();
		const radius = brushSize.value / 2;
		const opacity = brushOpacity.value;
		const { r, g, b } = parseHexRgb(fillColor.value);
		const hardness = effectiveHardness();

		ctx.save();
		applySelectionClip(ctx, width, height);
		if (hardness >= 0.99) {
			ctx.lineCap = "round";
			ctx.lineJoin = "round";
			ctx.lineWidth = brushSize.value;
			ctx.globalCompositeOperation = "source-over";
			ctx.strokeStyle = eraser ? `rgba(0,0,0,${opacity})` : `rgba(${r},${g},${b},${opacity})`;
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
		scratchHasInkFlag = true;
		lastX = pt.x;
		lastY = pt.y;
	}

	async function endStroke(selectedElements: Array<{ trackId: string; elementId: string }>) {
		isPainting.value = false;
		const scratch = scratchCanvas.value;
		if (!scratch || !scratchHasInkFlag) {
			paintPreviewActive.value = false;
			scratchCanvas.value = null;
			scratchHasInkFlag = false;
			return;
		}

		const editor = EditorCore.getInstance();
		const eraser = isEraserTool();
		let target = findSelectedImageLayer(editor, selectedElements);
		if (!target && eraser) {
			useImageEditorTools().selectFirstImageIfNeeded();
			target = findSelectedImageLayer(editor, editor.selection.getSelectedElements());
		}

		try {
			if (target) {
				const wrote = await mergeScratchOntoMedia(
					target.mediaId,
					scratch,
					eraser ? "erase" : "paint",
					target.element,
				);
				if (wrote) {
					const label =
						eraser ? "Eraser stroke" : activeTool.value === "pencil" ? "Pencil stroke" : "Brush stroke";
					recordImageEditHistory(label);
				}
			} else if (!eraser) {
				await commitCanvasAsNewLayer(scratch, activeTool.value === "pencil" ? "Pencil" : "Brush");
				recordImageEditHistory(activeTool.value === "pencil" ? "Pencil layer" : "Brush layer");
			}
		} catch (e) {
			console.error("[useImageRasterPaint] Commit failed:", e);
		}

		const ctx = scratch.getContext("2d");
		if (ctx) ctx.clearRect(0, 0, scratch.width, scratch.height);
		scratchHasInkFlag = false;
		paintPreviewActive.value = false;
	}

	function clearScratchPreview() {
		if (scratchCanvas.value) {
			const ctx = scratchCanvas.value.getContext("2d");
			if (ctx) ctx.clearRect(0, 0, scratchCanvas.value.width, scratchCanvas.value.height);
		}
		scratchHasInkFlag = false;
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
