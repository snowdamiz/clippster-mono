/**
 * Assemble Editable Accept payloads into an Image Editor project + Image Library export.
 * Quick Accept only writes a flat image into the library.
 */

import { createImageProject } from "@/editor/bridge/image-project-loader";
import { flushAndSerializeActiveImageProject } from "@/editor/bridge/image-project-document";
import { EditorCore } from "@/editor/core";
import { processMediaAssets } from "@/editor/lib/media/processing";
import { buildImageElement, buildTextElement } from "@/editor/lib/timeline/element-utils";
import { TIMELINE_CONSTANTS } from "@/editor/constants/timeline-constants";
import { createProject as createImageEditorProject } from "@/services/imageEditorApi";
import { createImageAsset } from "@/services/database/image-assets";
import type { ThumbnailRecipe } from "@/services/aiThumbnailApi";
import { resizeImageBlobToCanvas } from "@/lib/imageResize";

async function fetchAsFile(url: string, filename: string): Promise<File> {
	const response = await fetch(url);
	const blob = await response.blob();
	const ext = blob.type.includes("jpeg") || blob.type.includes("jpg") ? "jpg" : "png";
	const name = filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`;
	return new File([blob], name, { type: blob.type || "image/png" });
}

async function fetchNormalizedFile(
	url: string,
	filename: string,
	width: number,
	height: number,
): Promise<File> {
	const response = await fetch(url);
	const raw = await response.blob();
	const mime = raw.type.includes("jpeg") || raw.type.includes("jpg") ? "image/jpeg" : "image/png";
	const normalized = await resizeImageBlobToCanvas(raw, width, height, {
		fit: "cover",
		mime,
		quality: 0.92,
	});
	const ext = mime === "image/jpeg" ? "jpg" : "png";
	const name = filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`;
	return new File([normalized], name, { type: mime });
}

async function writeBlobToLibrary(blob: Blob, filename: string): Promise<{ filePath: string; fileSize: number }> {
	const { invoke } = await import("@tauri-apps/api/core");
	const { writeFile, mkdir, exists } = await import("@tauri-apps/plugin-fs");
	const appData = await invoke<string>("get_app_data_dir");
	const dir = `${appData}/image-library`;
	if (!(await exists(dir))) {
		await mkdir(dir, { recursive: true });
	}
	const filePath = `${dir}/${filename}`;
	const bytes = new Uint8Array(await blob.arrayBuffer());
	await writeFile(filePath, bytes);
	return { filePath, fileSize: bytes.byteLength };
}

export async function acceptQuickThumbnail(opts: {
	imageUrl: string;
	name?: string;
	canvasWidth?: number;
	canvasHeight?: number;
}): Promise<{ assetId: string; filePath: string }> {
	const width = opts.canvasWidth || 1280;
	const height = opts.canvasHeight || 720;
	const file = await fetchNormalizedFile(opts.imageUrl, opts.name || "ai-thumbnail", width, height);
	const { filePath, fileSize } = await writeBlobToLibrary(
		file,
		`ai_thumb_${Date.now()}_${file.name.replace(/[^\w.\-]+/g, "_")}`,
	);

	const assetId = await createImageAsset({
		name: opts.name || "AI Thumbnail",
		filePath,
		fileSize,
		mimeType: file.type,
		width,
		height,
		imageType: "thumbnail",
		sourceType: "ai_generated",
		canvasWidth: width,
		canvasHeight: height,
		exportFormat: file.type.includes("jpeg") ? "jpg" : "png",
	});

	return { assetId, filePath };
}

function textLayersFromRecipe(recipe: ThumbnailRecipe | null | undefined) {
	if (!recipe) return [];
	if (Array.isArray(recipe.text_layers)) return recipe.text_layers;
	if (Array.isArray(recipe.layers)) {
		return recipe.layers.filter((l) => l.type === "text") as any[];
	}
	return [];
}

function shapesFromRecipe(recipe: ThumbnailRecipe | null | undefined) {
	if (!recipe) return [];
	if (Array.isArray(recipe.shapes)) return recipe.shapes as any[];
	if (Array.isArray(recipe.layers)) {
		return recipe.layers.filter((l) => l.type === "shape") as any[];
	}
	return [];
}

async function createShapeImageFile(
	shape: Record<string, unknown>,
	canvasWidth: number,
	canvasHeight: number,
): Promise<File> {
	const pos = (shape.position as { x?: number; y?: number }) || {};
	const size = (shape.size as { width?: number; height?: number }) || {};
	const normW = typeof size.width === "number" ? size.width : 0.1;
	const normH = typeof size.height === "number" ? size.height : 0.02;
	const width = Math.max(4, Math.round(normW * canvasWidth));
	const height = Math.max(4, Math.round(normH * canvasHeight));

	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Canvas unavailable for shape rendering");

	const fill = String(shape.fill || shape.color || "#FF6B00");
	const opacity = typeof shape.opacity === "number" ? shape.opacity : 0.85;
	ctx.globalAlpha = opacity;
	ctx.fillStyle = fill;

	const shapeType = String(shape.type || shape.shape || "rect");
	if (shapeType === "circle" || shapeType === "ellipse") {
		ctx.beginPath();
		ctx.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
		ctx.fill();
	} else {
		ctx.fillRect(0, 0, width, height);
	}

	const blob = await new Promise<Blob>((resolve, reject) => {
		canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Failed to render shape"))), "image/png");
	});

	const id = String(shape.id || "shape");
	return new File([blob], `${id.replace(/[^\w.\-]+/g, "_")}.png`, { type: "image/png" });
}

function shapeTransform(
	shape: Record<string, unknown>,
	canvasWidth: number,
	canvasHeight: number,
) {
	const pos = (shape.position as { x?: number; y?: number }) || {};
	const size = (shape.size as { width?: number; height?: number }) || {};
	const xNorm = typeof pos.x === "number" ? pos.x : 0.1;
	const yNorm = typeof pos.y === "number" ? pos.y : 0.1;
	const normW = typeof size.width === "number" ? size.width : 0.1;
	const normH = typeof size.height === "number" ? size.height : 0.02;
	const pixelW = normW * canvasWidth;
	const pixelH = normH * canvasHeight;

	return {
		scale: 1,
		position: {
			x: xNorm * canvasWidth - canvasWidth / 2 + pixelW / 2,
			y: yNorm * canvasHeight - canvasHeight / 2 + pixelH / 2,
		},
		rotate: Number(shape.rotation || shape.rotate || 0),
	};
}

export async function acceptEditableThumbnail(opts: {
	plateUrl: string;
	recipe: ThumbnailRecipe | null;
	name?: string;
	canvasWidth?: number;
	canvasHeight?: number;
}): Promise<{ backendProjectId: number; assetId: string; filePath: string }> {
	const width = opts.canvasWidth || opts.recipe?.canvas?.width || 1280;
	const height = opts.canvasHeight || opts.recipe?.canvas?.height || 720;
	const name = opts.name || "AI Thumbnail";

	await createImageProject({
		name,
		canvasSize: { width, height },
	});

	const editor = EditorCore.getInstance();
	const project = editor.project.getActiveOrNull();
	if (!project) throw new Error("Failed to create image project");

	// Plate as background image layer (normalized to exact canvas size)
	const plateFile = await fetchNormalizedFile(opts.plateUrl, "plate", width, height);
	const dt = new DataTransfer();
	dt.items.add(plateFile);
	const processed = await processMediaAssets({ files: dt.files, onProgress: () => {} });
	for (const asset of processed) {
		const mediaId = await editor.media.addMediaAsset({
			projectId: project.metadata.id,
			asset,
		});
		const element = buildImageElement({
			mediaId,
			name: "Background plate",
			duration: TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION,
			startTime: 0,
		});
		editor.timeline.insertElement({ element, placement: { mode: "auto" } });
	}

	// Shape / sticker layers from recipe (rendered as positioned PNG overlays)
	for (const shape of shapesFromRecipe(opts.recipe)) {
		const shapeFile = await createShapeImageFile(shape, width, height);
		const dt = new DataTransfer();
		dt.items.add(shapeFile);
		const processed = await processMediaAssets({ files: dt.files, onProgress: () => {} });
		for (const asset of processed) {
			const mediaId = await editor.media.addMediaAsset({
				projectId: project.metadata.id,
				asset,
			});
			const element = buildImageElement({
				mediaId,
				name: String(shape.id || "Shape"),
				duration: TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION,
				startTime: 0,
			});
			element.transform = shapeTransform(shape, width, height);
			element.opacity = typeof shape.opacity === "number" ? shape.opacity : 1;
			editor.timeline.insertElement({ element, placement: { mode: "auto" } });
		}
	}

	// Live text layers from recipe
	for (const layer of textLayersFromRecipe(opts.recipe)) {
		const pos = (layer as any).position || {};
		const xNorm = typeof pos.x === "number" ? pos.x : typeof layer.x === "number" ? layer.x : 0.1;
		const yNorm = typeof pos.y === "number" ? pos.y : typeof layer.y === "number" ? layer.y : 0.3;
		const stroke = (layer as any).stroke;
		const shadow = (layer as any).shadow;

		const element = buildTextElement({
			raw: {
				content: String((layer as any).content || ""),
				name: String((layer as any).id || (layer as any).content || "Hook").slice(0, 40),
				duration: TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION,
				fontSize: Number((layer as any).font_size || (layer as any).fontSize || 72),
				fontFamily: String((layer as any).font_family || (layer as any).fontFamily || "Montserrat"),
				fontWeight: (String((layer as any).font_weight || (layer as any).fontWeight || "900") as
					| "100"
					| "200"
					| "300"
					| "400"
					| "500"
					| "600"
					| "700"
					| "800"
					| "900"
					| "normal"
					| "bold"),
				color: String((layer as any).color || "#FFFFFF"),
				textAlign: ((layer as any).text_align || (layer as any).align || "left") as any,
				stroke: stroke
					? {
							color: stroke.color || "#000000",
							width: Number(stroke.width || 4),
						}
					: undefined,
				shadow: shadow
					? {
							color: shadow.color || "#000000",
							blur: Number(shadow.blur || 8),
							offsetX: Number(shadow.offset_x ?? shadow.offsetX ?? 2),
							offsetY: Number(shadow.offset_y ?? shadow.offsetY ?? 2),
						}
					: undefined,
				transform: {
					scale: Number((layer as any).scale || 1),
					position: {
						x: (xNorm - 0.5) * width,
						y: (yNorm - 0.5) * height,
					},
					rotate: 0,
				},
				opacity: 1,
			},
			startTime: 0,
		});
		editor.timeline.insertElement({ element, placement: { mode: "auto" } });
	}

	const serialized = await flushAndSerializeActiveImageProject();
	if (!serialized) throw new Error("Failed to serialize assembled project");

	const backend = await createImageEditorProject({
		name,
		project_data: serialized,
		canvas_width: width,
		canvas_height: height,
		thumbnail_url: opts.plateUrl,
	});

	// Flattened library export from preview canvas
	await new Promise((r) => setTimeout(r, 400));
	const canvas = editor.getPreviewCanvas();
	let blob: Blob | null = null;
	if (canvas) {
		blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
	}
	if (!blob) {
		const plate = await fetchAsFile(opts.plateUrl, "export");
		blob = plate;
	}

	const { filePath, fileSize } = await writeBlobToLibrary(blob, `ai_editable_${Date.now()}.png`);
	const assetId = await createImageAsset({
		name,
		filePath,
		fileSize,
		mimeType: "image/png",
		width,
		height,
		imageType: "thumbnail",
		sourceType: "ai_generated",
		sourceProjectId: String(backend.id),
		canvasWidth: width,
		canvasHeight: height,
		exportFormat: "png",
		editorProjectJson: JSON.stringify({
			...serialized,
			backendProjectId: backend.id,
		}),
	});

	EditorCore.reset();

	return { backendProjectId: backend.id, assetId, filePath };
}

/** Compose plate + recipe text for postage-stamp feed preview (~200px wide). */
export async function composeEditableFeedPreview(opts: {
	plateUrl: string;
	recipe: ThumbnailRecipe | null;
	canvasWidth?: number;
	canvasHeight?: number;
	feedWidth?: number;
}): Promise<string> {
	const width = opts.canvasWidth || opts.recipe?.canvas?.width || 1280;
	const height = opts.canvasHeight || opts.recipe?.canvas?.height || 720;
	const feedWidth = opts.feedWidth ?? 200;
	const scale = feedWidth / width;
	const feedHeight = Math.max(1, Math.round(height * scale));

	const plate = await fetchNormalizedFile(opts.plateUrl, "plate-preview", width, height);
	const bitmap = await createImageBitmap(plate);
	try {
		const canvas = document.createElement("canvas");
		canvas.width = feedWidth;
		canvas.height = feedHeight;
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Canvas unavailable for feed preview");
		ctx.drawImage(bitmap, 0, 0, feedWidth, feedHeight);

		for (const layer of textLayersFromRecipe(opts.recipe)) {
			const content = String(layer.content || layer.text || "");
			if (!content) continue;
			const pos = (layer.position as { x?: number; y?: number }) || {};
			const xNorm = typeof pos.x === "number" ? pos.x : 0.5;
			const yNorm = typeof pos.y === "number" ? pos.y : 0.2;
			const fontSize = Math.max(10, Math.round(Number(layer.font_size || layer.fontSize || 72) * scale));
			const color = String(layer.color || layer.fill || "#FFFFFF");
			const stroke = String(layer.stroke || layer.stroke_color || "#000000");
			const strokeWidth = Math.max(1, Math.round(Number(layer.stroke_width || layer.strokeWidth || 4) * scale));
			ctx.font = `bold ${fontSize}px Impact, "Arial Black", sans-serif`;
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.lineWidth = strokeWidth;
			ctx.strokeStyle = stroke;
			ctx.fillStyle = color;
			const x = xNorm * feedWidth;
			const y = yNorm * feedHeight;
			ctx.strokeText(content, x, y);
			ctx.fillText(content, x, y);
		}

		return canvas.toDataURL("image/jpeg", 0.88);
	} finally {
		bitmap.close();
	}
}
