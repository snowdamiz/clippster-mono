/**
 * Clone / heal stamps in the selected image's native pixels.
 * Alt-click (or first click) sets the source; drag paints from that offset.
 */
import { ref } from "vue";
import { EditorCore } from "../core";
import {
	applyCanvasToImageTransform,
	canvasPointToImagePixel,
	clipSelectionToContext,
	getImageDrawLayout,
} from "../lib/image-layer-mapping";
import {
	findSelectedImageLayer,
	loadBitmapFromAsset,
	recordImageEditHistory,
	writeNativeCanvasToMedia,
} from "../lib/image-raster-commit";
import { useImageEditorTools } from "./useImageEditorTools";

const cloneSource = ref<{ canvasX: number; canvasY: number } | null>(null);
const isStamping = ref(false);

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

function samplePixel(
	data: Uint8ClampedArray,
	width: number,
	height: number,
	x: number,
	y: number,
): [number, number, number, number] {
	const ix = Math.min(width - 1, Math.max(0, Math.round(x)));
	const iy = Math.min(height - 1, Math.max(0, Math.round(y)));
	const i = (iy * width + ix) * 4;
	return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}

function blendHeal(
	sr: number,
	sg: number,
	sb: number,
	sa: number,
	dr: number,
	dg: number,
	db: number,
	da: number,
): [number, number, number, number] {
	if (sa === 0) return [dr, dg, db, da];
	const srcLum = 0.299 * sr + 0.587 * sg + 0.114 * sb;
	const dstLum = 0.299 * dr + 0.587 * dg + 0.114 * db;
	const scale = srcLum > 1 ? dstLum / srcLum : 1;
	return [
		Math.min(255, sr * scale * 0.65 + dr * 0.35),
		Math.min(255, sg * scale * 0.65 + dg * 0.35),
		Math.min(255, sb * scale * 0.65 + db * 0.35),
		Math.max(sa, da),
	];
}

export function useImageCloneStamp() {
	const { brushSize, brushHardness, brushOpacity, activeTool, getLiveSelection } = useImageEditorTools();

	let work: HTMLCanvasElement | null = null;
	let workCtx: CanvasRenderingContext2D | null = null;
	let sourceData: Uint8ClampedArray | null = null;
	let mask: Uint8ClampedArray | null = null;
	let mediaId: string | null = null;
	let offsetX = 0;
	let offsetY = 0;
	let lastX = 0;
	let lastY = 0;
	let layout: ReturnType<typeof getImageDrawLayout> | null = null;

	function setSourceFromEvent(event: PointerEvent, canvasEl: HTMLCanvasElement) {
		const editor = EditorCore.getInstance();
		const project = editor.project.getActiveOrNull();
		if (!project) return false;
		const pt = projectPixelFromEvent(
			event,
			canvasEl,
			project.settings.canvasSize.width,
			project.settings.canvasSize.height,
		);
		if (!pt) return false;
		cloneSource.value = { canvasX: pt.x, canvasY: pt.y };
		return true;
	}

	async function startStamp(event: PointerEvent, canvasEl: HTMLCanvasElement) {
		const editor = EditorCore.getInstance();
		const project = editor.project.getActiveOrNull();
		if (!project || !cloneSource.value) return false;
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
		sourceData = new Uint8ClampedArray(workCtx.getImageData(0, 0, work.width, work.height).data);
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

		const pt = projectPixelFromEvent(event, canvasEl, layout.canvasW, layout.canvasH);
		if (!pt) return false;
		const dest = canvasPointToImagePixel(layout, pt.x, pt.y);
		const src = canvasPointToImagePixel(layout, cloneSource.value.canvasX, cloneSource.value.canvasY);
		offsetX = src.x - dest.x;
		offsetY = src.y - dest.y;
		lastX = dest.x;
		lastY = dest.y;
		isStamping.value = true;
		stampAt(dest.x, dest.y);
		return true;
	}

	function stampAt(x: number, y: number) {
		if (!work || !workCtx || !sourceData) return;
		const radius = Math.max(1, brushSize.value / 2);
		const hardness = brushHardness.value;
		const opacity = brushOpacity.value;
		const heal = activeTool.value === "heal" || activeTool.value === "spot-heal";
		const dest = workCtx.getImageData(0, 0, work.width, work.height);
		const r2 = radius * radius;

		const minX = Math.max(0, Math.floor(x - radius));
		const maxX = Math.min(work.width - 1, Math.ceil(x + radius));
		const minY = Math.max(0, Math.floor(y - radius));
		const maxY = Math.min(work.height - 1, Math.ceil(y + radius));

		for (let py = minY; py <= maxY; py++) {
			for (let px = minX; px <= maxX; px++) {
				if (mask && mask[(py * work.width + px) * 4 + 3] === 0) continue;
				const dx = px - x;
				const dy = py - y;
				const d2 = dx * dx + dy * dy;
				if (d2 > r2) continue;
				const dist = Math.sqrt(d2);
				const inner = radius * hardness;
				let cover = 1;
				if (hardness < 0.99 && dist > inner) {
					cover = 1 - (dist - inner) / Math.max(0.001, radius - inner);
				}
				cover *= opacity;
				if (cover <= 0) continue;

				const i = (py * work.width + px) * 4;
				const [sr, sg, sb, sa] = samplePixel(sourceData, work.width, work.height, px + offsetX, py + offsetY);
				const dr = dest.data[i];
				const dg = dest.data[i + 1];
				const db = dest.data[i + 2];
				const da = dest.data[i + 3];
				const [nr, ng, nb, na] = heal
					? blendHeal(sr, sg, sb, sa, dr, dg, db, da)
					: [sr, sg, sb, sa];
				dest.data[i] = dr + (nr - dr) * cover;
				dest.data[i + 1] = dg + (ng - dg) * cover;
				dest.data[i + 2] = db + (nb - db) * cover;
				dest.data[i + 3] = da + (na - da) * cover;
			}
		}

		workCtx.putImageData(dest, 0, 0);
	}

	function continueStamp(event: PointerEvent, canvasEl: HTMLCanvasElement) {
		if (!isStamping.value || !layout) return;
		const pt = projectPixelFromEvent(event, canvasEl, layout.canvasW, layout.canvasH);
		if (!pt) return;
		const dest = canvasPointToImagePixel(layout, pt.x, pt.y);
		const dx = dest.x - lastX;
		const dy = dest.y - lastY;
		const dist = Math.hypot(dx, dy);
		const step = Math.max(1, brushSize.value * 0.35);
		const n = Math.max(1, Math.floor(dist / step));
		for (let i = 1; i <= n; i++) {
			stampAt(lastX + (dx * i) / n, lastY + (dy * i) / n);
		}
		lastX = dest.x;
		lastY = dest.y;
	}

	async function endStamp() {
		isStamping.value = false;
		if (!work || !mediaId) {
			work = null;
			workCtx = null;
			sourceData = null;
			mask = null;
			return;
		}
		try {
			await writeNativeCanvasToMedia(mediaId, work);
			recordImageEditHistory(
				activeTool.value === "spot-heal"
					? "Spot heal"
					: activeTool.value === "heal"
						? "Heal"
						: "Clone",
			);
		} catch (e) {
			console.error("[useImageCloneStamp] Commit failed:", e);
		}
		work = null;
		workCtx = null;
		sourceData = null;
		mask = null;
		mediaId = null;
		layout = null;
	}

	return {
		cloneSource,
		isStamping,
		setSourceFromEvent,
		startStamp,
		continueStamp,
		endStamp,
	};
}
