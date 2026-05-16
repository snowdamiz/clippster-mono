/**
 * Composable for generating preview thumbnails from the editor canvas.
 * Renders a specific frame to an offscreen canvas and exports as blob/dataURL.
 */
import { ref } from "vue";
import { useEditor } from "./useEditor";
import { CanvasRenderer } from "../renderer/canvas-renderer";
import { buildScene } from "../renderer/scene-builder";

export interface ThumbnailOptions {
	/** Time in seconds to capture */
	time: number;
	/** Output width (height auto-calculated from aspect ratio) */
	width?: number;
	/** Output format */
	format?: "image/png" | "image/jpeg" | "image/webp";
	/** JPEG/WebP quality 0-1 */
	quality?: number;
}

export function useThumbnailGenerator() {
	const { editor, version } = useEditor();
	const isGenerating = ref(false);

	async function generateThumbnail(options: ThumbnailOptions): Promise<Blob | null> {
		const project = editor.project.getActive();
		if (!project) return null;

		isGenerating.value = true;
		try {
			const canvasWidth = project.settings?.canvasSize?.width ?? 1920;
			const canvasHeight = project.settings?.canvasSize?.height ?? 1080;
			const fps = project.settings?.fps ?? 30;
			const background = project.settings?.background;

			const outputWidth = options.width ?? 320;
			const outputHeight = Math.round(outputWidth * (canvasHeight / canvasWidth));

			const tracks = editor.timeline.getTracks();
			const mediaAssets = editor.media.getAssets();
			const duration = editor.timeline.getTotalDuration();

			const renderTree = buildScene({
				tracks,
				mediaAssets,
				duration,
				canvasSize: { width: canvasWidth, height: canvasHeight },
				background,
				transitions: [],
				canvasSourceFraming: project.settings?.canvasSourceFraming ?? null,
			});

			const renderer = new CanvasRenderer({ width: canvasWidth, height: canvasHeight, fps });

			// Render to offscreen canvas at full resolution
			const fullCanvas = new OffscreenCanvas(canvasWidth, canvasHeight);
			await renderer.renderToCanvas({
				node: renderTree,
				time: Math.max(0, Math.min(options.time, duration)),
				targetCanvas: fullCanvas as any,
			});

			// Scale down to thumbnail size
			const thumbCanvas = new OffscreenCanvas(outputWidth, outputHeight);
			const thumbCtx = thumbCanvas.getContext("2d");
			if (!thumbCtx) return null;

			thumbCtx.drawImage(fullCanvas, 0, 0, outputWidth, outputHeight);

			const format = options.format ?? "image/jpeg";
			const quality = options.quality ?? 0.85;
			const blob = await thumbCanvas.convertToBlob({ type: format, quality });
			return blob;
		} catch (err) {
			console.error("[ThumbnailGenerator] Failed to generate thumbnail:", err);
			return null;
		} finally {
			isGenerating.value = false;
		}
	}

	async function generateThumbnailDataURL(options: ThumbnailOptions): Promise<string | null> {
		const blob = await generateThumbnail(options);
		if (!blob) return null;
		return new Promise((resolve) => {
			const reader = new FileReader();
			reader.onloadend = () => resolve(reader.result as string);
			reader.onerror = () => resolve(null);
			reader.readAsDataURL(blob);
		});
	}

	async function generateThumbnailStrip(options: {
		count: number;
		width?: number;
		format?: "image/png" | "image/jpeg" | "image/webp";
		quality?: number;
	}): Promise<(Blob | null)[]> {
		const duration = editor.timeline.getTotalDuration();
		if (duration <= 0 || options.count <= 0) return [];

		const step = duration / options.count;
		const thumbnails: (Blob | null)[] = [];

		for (let i = 0; i < options.count; i++) {
			const time = i * step + step / 2;
			const blob = await generateThumbnail({
				time,
				width: options.width ?? 160,
				format: options.format,
				quality: options.quality,
			});
			thumbnails.push(blob);
		}

		return thumbnails;
	}

	return {
		isGenerating,
		generateThumbnail,
		generateThumbnailDataURL,
		generateThumbnailStrip,
	};
}
