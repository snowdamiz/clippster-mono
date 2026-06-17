import { invoke } from "@tauri-apps/api/core";
import { buildPreviewSceneTree } from "./preview-scene-sync";
import { CanvasRenderer } from "./canvas-renderer";
import type { PreviewSceneInputs } from "./preview-scene-sync";
import { setPreviewDecodeSinkSizeOverride } from "../lib/preview-decode-settings";
import { videoCache } from "../video-cache/service";

export { getSceneTracksForExport } from "./scene-export-tracks";

type SceneFrameImageFormat = "jpeg" | "png";

const DEFAULT_SCENE_FRAME_FORMAT: SceneFrameImageFormat = "jpeg";
const SCENE_FRAME_JPEG_QUALITY = 0.92;

function getFrameMimeType(format: SceneFrameImageFormat): string {
	return format === "png" ? "image/png" : "image/jpeg";
}

function getFrameExtension(format: SceneFrameImageFormat): string {
	return format === "png" ? "png" : "jpg";
}

async function canvasToEncodedBytes(
	canvas: OffscreenCanvas | HTMLCanvasElement,
	format: SceneFrameImageFormat,
): Promise<Uint8Array> {
	const type = getFrameMimeType(format);
	const quality = format === "jpeg" ? SCENE_FRAME_JPEG_QUALITY : undefined;
	if (canvas instanceof HTMLCanvasElement) {
		const blob = await new Promise<Blob>((resolve, reject) => {
			canvas.toBlob(
				(b) => (b ? resolve(b) : reject(new Error("canvas toBlob failed"))),
				type,
				quality,
			);
		});
		return new Uint8Array(await blob.arrayBuffer());
	}
	const oc = canvas as OffscreenCanvas & { convertToBlob?: (opts?: ImageEncodeOptions) => Promise<Blob> };
	if (typeof oc.convertToBlob !== "function") {
		throw new Error("OffscreenCanvas.convertToBlob is not available in this environment");
	}
	const blob = await oc.convertToBlob({ type, quality });
	return new Uint8Array(await blob.arrayBuffer());
}

export type SceneFrameExportParams = {
	sessionId: string;
	sceneInputs: PreviewSceneInputs;
	exportDuration: number;
	/** Timeline time for frame 0 (segment exports). */
	timeOffset: number;
	fps: number;
	frameCount: number;
	imageFormat?: SceneFrameImageFormat;
	onProgress?: (p: { progress: number; phase: "frames" }) => void;
	isCancelled?: () => boolean;
};

/**
 * Renders the same scene tree as preview at full layout resolution and writes image frames for FFmpeg.
 * JPEG is the default staging format because these are already opaque final video frames; avoiding
 * per-frame PNG compression dramatically reduces export setup time while keeping one visual renderer.
 * @returns pattern path and frame count for `ExportConfig.scene_frame_pattern`.
 */
export async function writeSceneFrameSequenceToDisk(
	params: SceneFrameExportParams,
): Promise<{ pattern: string; frameCount: number }> {
	const {
		sessionId,
		sceneInputs,
		exportDuration,
		timeOffset,
		fps,
		frameCount,
		imageFormat = DEFAULT_SCENE_FRAME_FORMAT,
		onProgress,
		isCancelled,
	} = params;
	const { width, height } = sceneInputs.canvasSize;

	setPreviewDecodeSinkSizeOverride({ width, height });
	videoCache.clearAll();
	try {
		const tree = buildPreviewSceneTree(sceneInputs);
		const renderer = new CanvasRenderer({
			width,
			height,
			fps,
			preferOffscreen: true,
			previewEffectProcessing: false,
			backingWidth: width,
			backingHeight: height,
		});

		const n = Math.max(1, frameCount);
		for (let i = 0; i < n; i++) {
			if (isCancelled?.()) {
				throw new Error("Export cancelled");
			}
			const localT = Math.min(i / fps, Math.max(exportDuration - 1e-6, 0));
			const sceneTime = timeOffset + localT;
			await tree.prefetch({ renderer, time: sceneTime });
			await renderer.render({ node: tree, time: sceneTime });
			const bytes = await canvasToEncodedBytes(renderer.canvas, imageFormat);
			await invoke("write_scene_export_frame", {
				sessionId,
				frameIndexOneBased: i + 1,
				frameBytes: Array.from(bytes),
				extension: getFrameExtension(imageFormat),
			});
			onProgress?.({ progress: (i + 1) / n, phase: "frames" });
		}

		const [pattern, count] = await invoke<[string, number]>("finalize_scene_export_frames", {
			sessionId,
			extension: getFrameExtension(imageFormat),
		});
		return { pattern, frameCount: count };
	} finally {
		setPreviewDecodeSinkSizeOverride(null);
		videoCache.clearAll();
	}
}
