import { EditorCore } from "../core";
import { processMediaAssets } from "./media/processing";
import { buildImageElement } from "./timeline/element-utils";
import { TIMELINE_CONSTANTS } from "../constants/timeline-constants";
import { storageService } from "../storage/tauri-storage-adapter";
import type { ImageElement } from "../types/timeline";
import { pushImageHistoryEntry, type PixelHistoryEntry } from "../types/image-document";

export async function loadBitmapFromAsset(asset: {
	filePath?: string;
	file: File;
}): Promise<ImageBitmap> {
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

export async function writeCanvasToAssetFile(
	canvas: HTMLCanvasElement,
	filePath: string,
): Promise<void> {
	const blob = await new Promise<Blob>((resolve, reject) => {
		canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/png");
	});
	const { writeFile } = await import("@tauri-apps/plugin-fs");
	await writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

export function findSelectedImageLayer(
	editor: EditorCore,
	selected: Array<{ trackId: string; elementId: string }>,
): { trackId: string; elementId: string; mediaId: string; element: ImageElement } | null {
	if (selected.length !== 1) return null;
	const { trackId, elementId } = selected[0];
	const track = editor.timeline.getTracks().find((t) => t.id === trackId);
	const el = track?.elements.find((e) => e.id === elementId);
	if (!el || el.type !== "image") return null;
	const image = el as ImageElement;
	return image.mediaId ? { trackId, elementId, mediaId: image.mediaId, element: image } : null;
}

export async function commitCanvasAsNewLayer(
	canvas: HTMLCanvasElement,
	name: string,
	position?: { x: number; y: number },
): Promise<void> {
	const editor = EditorCore.getInstance();
	const project = editor.project.getActiveOrNull();
	if (!project) return;

	const blob = await new Promise<Blob>((resolve, reject) => {
		canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/png");
	});
	const file = new File([blob], `${name.toLowerCase()}_${Date.now()}.png`, { type: "image/png" });
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
		if (position) {
			element.transform = { scale: 1, position: { x: position.x, y: position.y }, rotate: 0 };
		}
		editor.timeline.insertElement({ element, placement: { mode: "auto" } });
	}
}

export async function writeNativeCanvasToMedia(
	mediaId: string,
	work: HTMLCanvasElement,
): Promise<boolean> {
	const editor = EditorCore.getInstance();
	const project = editor.project.getActiveOrNull();
	if (!project) return false;
	const asset = await editor.media.ensureAssetHydrated(mediaId);
	if (!asset || asset.type !== "image") return false;

	const blob = await new Promise<Blob>((resolve, reject) => {
		// Prefer faster PNG encode; quality arg ignored for PNG but keeps API consistent.
		work.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/png");
	});
	const baseName = (asset.name || "image").replace(/\.\w+$/, "");
	const file = new File([blob], `${baseName}.png`, { type: "image/png", lastModified: Date.now() });
	const url = URL.createObjectURL(file);

	// Swap the live raster first so the preview updates immediately.
	editor.media.replaceAssetRaster({ id: mediaId, file, url });
	editor.renderer.invalidatePreviewSceneCache();
	editor.save.markDirty();

	// Persist off the critical path so the stroke feels instant.
	if (asset.filePath) {
		void writeCanvasToAssetFile(work, asset.filePath).catch((e) => {
			console.warn("[writeNativeCanvasToMedia] Disk write failed:", e);
		});
	}
	void storageService
		.saveMediaAsset({
			projectId: project.metadata.id,
			mediaAsset: { ...asset, file, url, isHydrated: true },
		})
		.catch((e) => {
			console.warn("[writeNativeCanvasToMedia] Storage save failed:", e);
		});

	return true;
}

export function recordImageEditHistory(label: string) {
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

export function getActivePixelSelection() {
	const editor = EditorCore.getInstance();
	const selection = editor.project.getActiveOrNull()?.settings.imageDocument?.selection;
	if (!selection) return null;
	if (selection.type === "path") {
		if (selection.rings?.some((ring) => ring.length >= 3)) return selection;
		return selection.points && selection.points.length >= 3 ? selection : null;
	}
	if (selection.width < 0.005 || selection.height < 0.005) return null;
	if (selection.type !== "rect" && selection.type !== "ellipse") return null;
	return selection;
}
