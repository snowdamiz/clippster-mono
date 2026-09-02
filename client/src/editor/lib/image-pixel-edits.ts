import { EditorCore } from "../core";
import type { PixelSelection } from "../types/image-document";
import {
	applyCanvasToImageTransform,
	applyImageToCanvasTransform,
	canvasPointToImagePixel,
	clipSelectionToContext,
	getImageDrawLayout,
	parseHexRgb,
} from "./image-layer-mapping";
import { floodFillImageData, floodSelectMask } from "./image-flood-fill";
import { selectionFromWandMask } from "./image-magic-wand";
import {
	commitCanvasAsNewLayer,
	findSelectedImageLayer,
	getActivePixelSelection,
	loadBitmapFromAsset,
	recordImageEditHistory,
	writeNativeCanvasToMedia,
} from "./image-raster-commit";

function selectionToCanvasRect(
	selection: PixelSelection,
	canvasW: number,
	canvasH: number,
): { x: number; y: number; w: number; h: number } {
	return {
		x: selection.x * canvasW,
		y: selection.y * canvasH,
		w: selection.width * canvasW,
		h: selection.height * canvasH,
	};
}

async function loadSelectedImageWork() {
	const editor = EditorCore.getInstance();
	const project = editor.project.getActiveOrNull();
	if (!project) return null;
	const target = findSelectedImageLayer(editor, editor.selection.getSelectedElements());
	if (!target) return null;
	const asset = await editor.media.ensureAssetHydrated(target.mediaId);
	if (!asset || asset.type !== "image") return null;
	const bitmap = await loadBitmapFromAsset(asset);
	const work = document.createElement("canvas");
	work.width = bitmap.width;
	work.height = bitmap.height;
	const ctx = work.getContext("2d", { willReadFrequently: true });
	if (!ctx) {
		bitmap.close();
		return null;
	}
	ctx.drawImage(bitmap, 0, 0);
	bitmap.close();
	const { width: canvasW, height: canvasH } = project.settings.canvasSize;
	const layout = getImageDrawLayout({
		canvasW,
		canvasH,
		nativeW: work.width,
		nativeH: work.height,
		crop: target.element.crop,
		mediaFit: target.element.mediaFit,
		transform: target.element.transform,
		flip: target.element.flip,
	});
	return { editor, project, target, work, ctx, layout, canvasW, canvasH };
}

function buildSelectionMask(
	layout: ReturnType<typeof getImageDrawLayout>,
	selection: PixelSelection,
): Uint8ClampedArray | null {
	const maskCanvas = document.createElement("canvas");
	maskCanvas.width = layout.nativeW;
	maskCanvas.height = layout.nativeH;
	const ctx = maskCanvas.getContext("2d");
	if (!ctx) return null;
	ctx.save();
	applyCanvasToImageTransform(ctx, layout);
	clipSelectionToContext(ctx, selection, layout.canvasW, layout.canvasH, selection.type);
	ctx.fillStyle = "#fff";
	ctx.fillRect(0, 0, layout.canvasW, layout.canvasH);
	ctx.restore();
	return ctx.getImageData(0, 0, layout.nativeW, layout.nativeH).data;
}

export async function floodFillAtCanvasPoint({
	canvasX,
	canvasY,
	color,
	tolerance,
	selection,
}: {
	canvasX: number;
	canvasY: number;
	color: string;
	tolerance: number;
	selection?: PixelSelection | null;
}): Promise<boolean> {
	const loaded = await loadSelectedImageWork();
	if (!loaded) return false;
	const { target, work, ctx, layout } = loaded;
	const mapped = canvasPointToImagePixel(layout, canvasX, canvasY);
	const imagePt = {
		x: Math.round(mapped.x),
		y: Math.round(mapped.y),
	};
	if (
		imagePt.x < 0 ||
		imagePt.y < 0 ||
		imagePt.x >= work.width ||
		imagePt.y >= work.height
	) {
		return false;
	}

	const liveSelection = selection ?? getActivePixelSelection();
	const mask = liveSelection ? buildSelectionMask(layout, liveSelection) : null;
	const { r, g, b } = parseHexRgb(color);
	const image = ctx.getImageData(0, 0, work.width, work.height);
	const filled = floodFillImageData({
		image,
		x: imagePt.x,
		y: imagePt.y,
		fill: { r, g, b, a: 255 },
		tolerance,
		mask,
	});
	if (filled <= 0) return false;
	ctx.putImageData(image, 0, 0);
	const wrote = await writeNativeCanvasToMedia(target.mediaId, work);
	if (wrote) recordImageEditHistory("Fill");
	return wrote;
}

export async function magicWandAtCanvasPoint({
	canvasX,
	canvasY,
	tolerance,
	contiguous,
}: {
	canvasX: number;
	canvasY: number;
	tolerance: number;
	contiguous: boolean;
}): Promise<PixelSelection | null> {
	const loaded = await loadSelectedImageWork();
	if (!loaded) return null;
	const { work, ctx, layout } = loaded;
	const mapped = canvasPointToImagePixel(layout, canvasX, canvasY);
	const imagePt = { x: Math.round(mapped.x), y: Math.round(mapped.y) };
	if (imagePt.x < 0 || imagePt.y < 0 || imagePt.x >= work.width || imagePt.y >= work.height) {
		return null;
	}
	const image = ctx.getImageData(0, 0, work.width, work.height);
	const { selected, count } = floodSelectMask({
		image,
		x: imagePt.x,
		y: imagePt.y,
		tolerance,
		contiguous,
	});
	if (count <= 0) return null;
	return selectionFromWandMask(layout, selected, work.width, work.height);
}

export async function eraseMarqueeOnSelectedImage(
	selection = getActivePixelSelection(),
): Promise<boolean> {
	if (!selection) return false;
	const loaded = await loadSelectedImageWork();
	if (!loaded) return false;
	const { target, work, ctx, layout } = loaded;
	ctx.save();
	applyCanvasToImageTransform(ctx, layout);
	clipSelectionToContext(ctx, selection, layout.canvasW, layout.canvasH, selection.type);
	ctx.clearRect(0, 0, layout.canvasW, layout.canvasH);
	ctx.restore();
	const wrote = await writeNativeCanvasToMedia(target.mediaId, work);
	if (wrote) recordImageEditHistory("Clear selection");
	return wrote;
}

export async function copyMarqueeFromSelectedImage(
	selection = getActivePixelSelection(),
): Promise<boolean> {
	if (!selection) return false;
	const loaded = await loadSelectedImageWork();
	if (!loaded) return false;
	const { work, ctx, layout, canvasW, canvasH } = loaded;

	const composed = document.createElement("canvas");
	composed.width = canvasW;
	composed.height = canvasH;
	const composedCtx = composed.getContext("2d");
	if (!composedCtx) return false;
	composedCtx.save();
	applyImageToCanvasTransform(composedCtx, layout);
	composedCtx.drawImage(
		work,
		layout.sx,
		layout.sy,
		layout.sw,
		layout.sh,
		layout.dx,
		layout.dy,
		layout.dw,
		layout.dh,
	);
	composedCtx.restore();

	const rect = selectionToCanvasRect(selection, canvasW, canvasH);
	const slice = document.createElement("canvas");
	slice.width = Math.max(1, Math.round(rect.w));
	slice.height = Math.max(1, Math.round(rect.h));
	const sliceCtx = slice.getContext("2d");
	if (!sliceCtx) return false;
	sliceCtx.save();
	if (selection.type === "ellipse") {
		sliceCtx.beginPath();
		sliceCtx.ellipse(slice.width / 2, slice.height / 2, slice.width / 2, slice.height / 2, 0, 0, Math.PI * 2);
		sliceCtx.clip();
	} else if (selection.type === "path") {
		const rings = selection.rings?.length ? selection.rings : selection.points ? [selection.points] : [];
		sliceCtx.beginPath();
		for (const ring of rings) {
			ring.forEach((p, i) => {
				const px = p.x * canvasW - rect.x;
				const py = p.y * canvasH - rect.y;
				if (i === 0) sliceCtx.moveTo(px, py);
				else sliceCtx.lineTo(px, py);
			});
			sliceCtx.closePath();
		}
		if (rings.length > 0) sliceCtx.clip(rings.length > 1 ? "evenodd" : "nonzero");
	}
	sliceCtx.drawImage(composed, rect.x, rect.y, rect.w, rect.h, 0, 0, slice.width, slice.height);
	sliceCtx.restore();

	await commitCanvasAsNewLayer(slice, "Selection", {
		x: (selection.x + selection.width / 2 - 0.5) * canvasW,
		y: (selection.y + selection.height / 2 - 0.5) * canvasH,
	});
	recordImageEditHistory("Copy selection");
	return true;
}

export async function applyCanvasScratchToSelectedImage(
	scratch: HTMLCanvasElement,
	mode: "paint" | "erase",
	historyLabel: string,
): Promise<boolean> {
	const loaded = await loadSelectedImageWork();
	if (!loaded) {
		if (mode === "erase") return false;
		await commitCanvasAsNewLayer(scratch, historyLabel);
		recordImageEditHistory(historyLabel);
		return true;
	}
	const { target, work, ctx, layout } = loaded;
	ctx.save();
	applyCanvasToImageTransform(ctx, layout);
	ctx.globalCompositeOperation = mode === "erase" ? "destination-out" : "source-over";
	ctx.drawImage(scratch, 0, 0);
	ctx.restore();
	const wrote = await writeNativeCanvasToMedia(target.mediaId, work);
	if (wrote) recordImageEditHistory(historyLabel);
	return wrote;
}

export async function applyLinearGradient({
	x0,
	y0,
	x1,
	y1,
	from,
	to,
	selection,
}: {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
	from: string;
	to: string;
	selection?: PixelSelection | null;
}): Promise<boolean> {
	const editor = EditorCore.getInstance();
	const project = editor.project.getActiveOrNull();
	if (!project) return false;
	const { width, height } = project.settings.canvasSize;
	const scratch = document.createElement("canvas");
	scratch.width = width;
	scratch.height = height;
	const ctx = scratch.getContext("2d");
	if (!ctx) return false;
	ctx.save();
	const live = selection ?? getActivePixelSelection();
	if (live) clipSelectionToContext(ctx, live, width, height, live.type);
	const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
	gradient.addColorStop(0, from);
	gradient.addColorStop(1, to);
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, width, height);
	ctx.restore();
	return applyCanvasScratchToSelectedImage(scratch, "paint", "Gradient");
}

export function hasActiveMarquee(): boolean {
	return !!getActivePixelSelection();
}
