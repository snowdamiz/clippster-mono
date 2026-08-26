/**
 * Compositor-mode brush / eraser: paints on the selected image layer's bitmap,
 * or creates a new raster layer when nothing suitable is selected.
 */
import { ref } from "vue";
import { EditorCore } from "../core";
import { processMediaAssets } from "../lib/media/processing";
import { buildImageElement } from "../lib/timeline/element-utils";
import { TIMELINE_CONSTANTS } from "../constants/timeline-constants";
import { storageService } from "../storage/tauri-storage-adapter";
import type { ImageElement } from "../types/timeline";
import { useImageEditorTools } from "./useImageEditorTools";
import type { PixelHistoryEntry } from "../types/image-document";
import { pushImageHistoryEntry } from "../types/image-document";

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

function drawDab(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	radius: number,
	color: string,
	opacity: number,
	eraser: boolean,
) {
	ctx.save();
	if (eraser) {
		ctx.globalCompositeOperation = "destination-out";
		ctx.fillStyle = `rgba(0,0,0,${opacity})`;
	} else {
		ctx.globalCompositeOperation = "source-over";
		const hex = color.replace("#", "");
		const r = parseInt(hex.slice(0, 2), 16);
		const g = parseInt(hex.slice(2, 4), 16);
		const b = parseInt(hex.slice(4, 6), 16);
		ctx.fillStyle = `rgba(${r},${g},${b},${opacity})`;
	}
	ctx.beginPath();
	ctx.arc(x, y, radius, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

async function loadBitmapFromAsset(asset: { filePath?: string; file: File }): Promise<ImageBitmap> {
	if (asset.filePath) {
		const { invoke } = await import("@tauri-apps/api/core");
		const dataUrl = await invoke<string>("read_file_as_data_url", { filePath: asset.filePath });
		const res = await fetch(dataUrl);
		const blob = await res.blob();
		return createImageBitmap(blob);
	}
	if (asset.file.size > 0) {
		return createImageBitmap(asset.file);
	}
	throw new Error("Media asset has no readable file");
}

async function writeCanvasToAssetFile(
	canvas: HTMLCanvasElement,
	filePath: string,
): Promise<void> {
	const blob = await new Promise<Blob>((resolve, reject) => {
		canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/png");
	});
	const { writeFile } = await import("@tauri-apps/plugin-fs");
	await writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

function findTargetImageLayer(
	editor: EditorCore,
	selected: Array<{ trackId: string; elementId: string }>,
): { trackId: string; elementId: string; mediaId: string } | null {
	if (selected.length !== 1) return null;
	const { trackId, elementId } = selected[0];
	const track = editor.timeline.getTracks().find((t) => t.id === trackId);
	const el = track?.elements.find((e) => e.id === elementId);
	if (!el || el.type !== "image") return null;
	const mediaId = (el as ImageElement).mediaId;
	return mediaId ? { trackId, elementId, mediaId } : null;
}

async function commitScratchAsNewLayer(canvas: HTMLCanvasElement, name: string) {
	const editor = EditorCore.getInstance();
	const project = editor.project.getActiveOrNull();
	if (!project) return;

	const blob = await new Promise<Blob>((resolve, reject) => {
		canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/png");
	});
	const file = new File([blob], `paint_${Date.now()}.png`, { type: "image/png" });
	const dt = new DataTransfer();
	dt.items.add(file);
	const processed = await processMediaAssets({ files: dt.files, onProgress: () => {} });
	for (const asset of processed) {
		const mediaId = await editor.media.addMediaAsset({
			projectId: project.metadata.id,
			asset,
		});
		const element = buildImageElement({
			mediaId,
			name,
			duration: TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION,
			startTime: 0,
		});
		editor.timeline.insertElement({ element, placement: { mode: "auto" } });
	}
}

async function mergeScratchOntoMedia(
	mediaId: string,
	scratch: HTMLCanvasElement,
	mode: "paint" | "erase",
) {
	const editor = EditorCore.getInstance();
	const project = editor.project.getActiveOrNull();
	if (!project) return;

	const asset = await editor.media.ensureAssetHydrated(mediaId);
	if (!asset || asset.type !== "image") return;

	const { width, height } = project.settings.canvasSize;
	const work = document.createElement("canvas");
	work.width = width;
	work.height = height;
	const ctx = work.getContext("2d");
	if (!ctx) return;

	const bitmap = await loadBitmapFromAsset(asset);
	try {
		ctx.drawImage(bitmap, 0, 0, width, height);
	} finally {
		bitmap.close();
	}

	ctx.save();
	ctx.globalCompositeOperation = mode === "erase" ? "destination-out" : "source-over";
	ctx.drawImage(scratch, 0, 0);
	ctx.restore();

	const filePath = asset.filePath;
	if (!filePath) {
		await commitScratchAsNewLayer(scratch, mode === "erase" ? "Eraser" : "Brush");
		return;
	}

	await writeCanvasToAssetFile(work, filePath);

	// Refresh in-memory file so renderer picks up changes
	try {
		const { readFile } = await import("@tauri-apps/plugin-fs");
		const bytes = await readFile(filePath);
		asset.file = new File([bytes], asset.name, { type: "image/png" });
		if (asset.url?.startsWith("blob:")) {
			URL.revokeObjectURL(asset.url);
		}
		asset.url = URL.createObjectURL(asset.file);
		asset.isHydrated = true;
		await storageService.saveMediaAsset({ projectId: project.metadata.id, mediaAsset: asset });
		editor.save.markDirty();
	} catch (e) {
		console.warn("[useImageRasterPaint] Failed to refresh media after paint:", e);
	}
}

function recordPaintHistory(label: string) {
	const editor = EditorCore.getInstance();
	const project = editor.project.getActiveOrNull();
	const doc = project?.settings.imageDocument;
	if (!doc) return;
	const entry: PixelHistoryEntry = {
		id: `hist_${Date.now()}`,
		name: label,
		timestamp: Date.now(),
		snapshotRef: "compositor-raster",
	};
	void editor.project.updateSettings({
		settings: {
			imageDocument: pushImageHistoryEntry(doc, entry),
		} as any,
	});
}

export function blitScratchToOverlay(scratch: HTMLCanvasElement, overlay: HTMLCanvasElement) {
	const ctx = overlay.getContext("2d");
	if (!ctx) return;
	ctx.clearRect(0, 0, overlay.width, overlay.height);
	ctx.drawImage(scratch, 0, 0);
}

export function useImageRasterPaint() {
	const { brushSize, brushOpacity, fillColor, activeTool } = useImageEditorTools();

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

		isPainting.value = true;
		paintPreviewActive.value = true;
		lastX = pt.x;
		lastY = pt.y;

		const eraser = activeTool.value === "eraser";
		const radius = brushSize.value / 2;
		const opacity = brushOpacity.value;
		drawDab(ctx, pt.x, pt.y, radius, fillColor.value, opacity, eraser);
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

		ctx.lineCap = "round";
		ctx.lineJoin = "round";
		ctx.lineWidth = brushSize.value;
		if (eraser) {
			ctx.globalCompositeOperation = "destination-out";
			ctx.strokeStyle = `rgba(0,0,0,${opacity})`;
		} else {
			ctx.globalCompositeOperation = "source-over";
			const hex = fillColor.value.replace("#", "");
			const r = parseInt(hex.slice(0, 2), 16);
			const g = parseInt(hex.slice(2, 4), 16);
			const b = parseInt(hex.slice(4, 6), 16);
			ctx.strokeStyle = `rgba(${r},${g},${b},${opacity})`;
		}
		ctx.beginPath();
		ctx.moveTo(lastX, lastY);
		ctx.lineTo(pt.x, pt.y);
		ctx.stroke();

		drawDab(ctx, pt.x, pt.y, radius, fillColor.value, opacity, eraser);
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
				);
				recordPaintHistory(eraser ? "Eraser stroke" : "Brush stroke");
			} else if (!eraser) {
				await commitScratchAsNewLayer(scratch, "Brush");
				recordPaintHistory("Brush layer");
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
