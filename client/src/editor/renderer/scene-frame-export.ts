import { invoke } from "@tauri-apps/api/core";
import { buildPreviewSceneTree } from "./preview-scene-sync";
import { CanvasRenderer } from "./canvas-renderer";
import type { PreviewSceneInputs } from "./preview-scene-sync";

export { getSceneTracksForExport } from "./scene-export-tracks";

async function canvasToPngBytes(canvas: OffscreenCanvas | HTMLCanvasElement): Promise<Uint8Array> {
	if (canvas instanceof HTMLCanvasElement) {
		const blob = await new Promise<Blob>((resolve, reject) => {
			canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas toBlob failed"))), "image/png");
		});
		return new Uint8Array(await blob.arrayBuffer());
	}
	const oc = canvas as OffscreenCanvas & { convertToBlob?: (opts?: ImageEncodeOptions) => Promise<Blob> };
	if (typeof oc.convertToBlob !== "function") {
		throw new Error("OffscreenCanvas.convertToBlob is not available in this environment");
	}
	const blob = await oc.convertToBlob({ type: "image/png" });
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
	onProgress?: (p: { progress: number; phase: "frames" }) => void;
	isCancelled?: () => boolean;
};

/**
 * Renders the same scene tree as preview at full layout resolution and writes PNGs for FFmpeg.
 * @returns pattern path and frame count for `ExportConfig.scene_frame_pattern`.
 */
export async function writeSceneFrameSequenceToDisk(
	params: SceneFrameExportParams,
): Promise<{ pattern: string; frameCount: number }> {
	const { sessionId, sceneInputs, exportDuration, timeOffset, fps, frameCount, onProgress, isCancelled } = params;
	const { width, height } = sceneInputs.canvasSize;
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
		await renderer.render({ node: tree, time: sceneTime });
		const bytes = await canvasToPngBytes(renderer.canvas);
		await invoke("write_scene_export_frame", {
			sessionId,
			frameIndexOneBased: i + 1,
			pngBytes: Array.from(bytes),
		});
		onProgress?.({ progress: (i + 1) / n, phase: "frames" });
	}

	const [pattern, count] = await invoke<[string, number]>("finalize_scene_export_frames", {
		sessionId,
	});
	return { pattern, frameCount: count };
}
