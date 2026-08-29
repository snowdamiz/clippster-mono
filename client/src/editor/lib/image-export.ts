/**
 * Full-resolution still export for image mode.
 * Reuses the same scene tree as preview/video WYSIWYG — never snapshots the display canvas.
 */
import { EditorCore } from "../core";
import { CanvasRenderer } from "../renderer/canvas-renderer";
import { buildPreviewSceneTree } from "../renderer/preview-scene-sync";
import { getSceneTracksForExport } from "../renderer/scene-export-tracks";
import { setPreviewDecodeSinkSizeOverride } from "./preview-decode-settings";
import { getRenderFrame } from "../renderer/frame-policy";
import { mimeForImageStill, type ImageStillFormat } from "./image-export-format";

export type { ImageStillFormat };
export { mimeForImageStill };

function canvasToBlob(
	canvas: HTMLCanvasElement,
	mimeType: string,
	quality?: number,
): Promise<Blob | null> {
	return new Promise((resolve) => {
		canvas.toBlob((blob) => resolve(blob), mimeType, quality);
	});
}

export async function renderActiveProjectToImageBlob(
	format: ImageStillFormat = "png",
): Promise<Blob | null> {
	const editor = EditorCore.getInstance();
	const project = editor.project.getActiveOrNull();
	if (!project) return null;

	const width = Math.max(1, Math.round(project.settings.canvasSize.width));
	const height = Math.max(1, Math.round(project.settings.canvasSize.height));
	const fps = project.settings.fps ?? 30;
	const duration = Math.max(editor.timeline.getTotalDuration(), 1 / Math.max(1, fps));
	const time = getRenderFrame({
		time: editor.playback.getCurrentTime(),
		fps,
		duration,
	}).time;

	if (typeof document !== "undefined" && document.fonts?.ready) {
		await document.fonts.ready.catch(() => undefined);
	}

	setPreviewDecodeSinkSizeOverride({ width, height });
	try {
		const tree = buildPreviewSceneTree({
			tracks: getSceneTracksForExport(editor.timeline.getTracks()),
			mediaAssets: editor.media.getAssets(),
			duration,
			canvasSize: { width, height },
			background: project.settings.background ?? { type: "color", color: "transparent" },
			transitions: (() => {
				try {
					return editor.scenes.getActiveScene()?.transitions ?? [];
				} catch {
					return [];
				}
			})(),
			canvasSourceFraming: project.settings.canvasSourceFraming ?? null,
		});

		const bg = project.settings.background;
		const transparent =
			editor.imageMode ||
			(bg?.type === "color" && (bg.color === "transparent" || bg.color === "rgba(0,0,0,0)"));

		const renderer = new CanvasRenderer({
			width,
			height,
			fps,
			framePolicy: "exact-export",
			preferOffscreen: true,
			previewEffectProcessing: false,
			backingWidth: width,
			backingHeight: height,
			clearStyle: transparent ? "transparent" : "black",
		});

		const target = document.createElement("canvas");
		target.width = width;
		target.height = height;
		await renderer.renderToCanvas({ node: tree, time, targetCanvas: target });

		const mimeType = mimeForImageStill(format);
		const quality = format === "png" ? undefined : 0.92;
		return canvasToBlob(target, mimeType, quality);
	} finally {
		setPreviewDecodeSinkSizeOverride(null);
	}
}
