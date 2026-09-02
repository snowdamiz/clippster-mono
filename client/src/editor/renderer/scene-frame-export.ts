import { invoke } from "@tauri-apps/api/core";
import { buildPreviewSceneTree } from "./preview-scene-sync";
import { CanvasRenderer } from "./canvas-renderer";
import type { PreviewSceneInputs } from "./preview-scene-sync";
import type { TBackground } from "../types/project";
import { getPreviewDecodeSinkSize } from "../lib/preview-decode-settings";
import { videoCache } from "../video-cache/service";
import { getRenderFrame } from "./frame-policy";
import { prewarmSceneSegmentsForExport } from "./scene-export-prewarm";

export { getSceneTracksForExport } from "./scene-export-tracks";

type SceneFrameImageFormat = "jpeg" | "png";

const DEFAULT_SCENE_FRAME_FORMAT: SceneFrameImageFormat = "jpeg";
const SCENE_FRAME_JPEG_QUALITY = 0.92;
const FRAME_WRITE_BATCH_SIZE = 4;
const MAX_PENDING_WRITE_BATCHES = 2;

function getFrameMimeType(format: SceneFrameImageFormat): string {
	return format === "png" ? "image/png" : "image/jpeg";
}

function getFrameExtension(format: SceneFrameImageFormat): string {
	return format === "png" ? "png" : "jpg";
}

function isTransparentBackground(background: TBackground): boolean {
	if (background.type !== "color") return false;
	const color = (background.color || "").toLowerCase();
	return color === "transparent" || color === "rgba(0,0,0,0)" || color === "#00000000";
}

/**
 * Match PreviewPanel.vue CanvasRenderer settings so export pixels follow the
 * same decode + compositing path as playback (WYSIWYG).
 */
export function createPreviewParityExportRenderer({
	width,
	height,
	fps,
	background,
}: {
	width: number;
	height: number;
	fps: number;
	background: TBackground;
}): CanvasRenderer {
	const backing = getPreviewDecodeSinkSize();
	return new CanvasRenderer({
		width,
		height,
		fps,
		framePolicy: "realtime",
		prewarmUpcoming: true,
		preferOffscreen: false,
		previewEffectProcessing: true,
		backingWidth: backing.width,
		backingHeight: backing.height,
		exportRetainLastFrame: true,
		clearStyle: isTransparentBackground(background) ? "transparent" : "black",
	});
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
	const oc = canvas as OffscreenCanvas & {
		convertToBlob?: (opts?: ImageEncodeOptions) => Promise<Blob>;
	};
	if (typeof oc.convertToBlob !== "function") {
		throw new Error("OffscreenCanvas.convertToBlob is not available in this environment");
	}
	const blob = await oc.convertToBlob({ type, quality });
	return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Binary framing for raw Tauri IPC: repeated little-endian u32 byte length + encoded image bytes.
 * Keeping the payload binary avoids expanding every JPEG byte into a JSON number.
 */
export function packEncodedFrameBatch(frames: Uint8Array[]): Uint8Array {
	const totalBytes = frames.reduce((sum, frame) => sum + 4 + frame.byteLength, 0);
	const payload = new Uint8Array(totalBytes);
	const view = new DataView(payload.buffer);
	let offset = 0;
	for (const frame of frames) {
		view.setUint32(offset, frame.byteLength, true);
		offset += 4;
		payload.set(frame, offset);
		offset += frame.byteLength;
	}
	return payload;
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

export function getSceneFrameTime({
	frameIndex,
	fps,
	exportDuration,
	timeOffset,
	sceneDuration,
}: {
	frameIndex: number;
	fps: number;
	exportDuration: number;
	timeOffset: number;
	sceneDuration: number;
}): number {
	const localTime = Math.min(
		frameIndex / Math.max(1, fps),
		Math.max(exportDuration - 1e-6, 0),
	);
	return getRenderFrame({
		time: timeOffset + localTime,
		fps,
		duration: sceneDuration,
	}).time;
}

/**
 * Renders through the same scene tree + CanvasRenderer path as preview playback,
 * then writes JPEG/PNG frames for FFmpeg. Do not reset decoders or override decode
 * size — export must match what the user already saw in the preview canvas.
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
	const { canvasSize, background } = sceneInputs;
	const { width, height } = canvasSize;

	videoCache.beginExportSession();
	let renderer: CanvasRenderer | null = null;
	const encodeCanvas = new OffscreenCanvas(width, height);

	try {
		const tree = buildPreviewSceneTree(sceneInputs);
		renderer = createPreviewParityExportRenderer({
			width,
			height,
			fps,
			background,
		});

		await prewarmSceneSegmentsForExport(tree, renderer);

		const n = Math.max(1, frameCount);
		const pendingWrites: Promise<unknown>[] = [];
		let writeBatch: Uint8Array[] = [];
		let writeBatchFirstFrame = 1;
		const flushWriteBatch = async () => {
			if (writeBatch.length === 0) return;
			const payload = packEncodedFrameBatch(writeBatch);
			const firstFrameIndex = writeBatchFirstFrame;
			writeBatch = [];
			writeBatchFirstFrame = firstFrameIndex + FRAME_WRITE_BATCH_SIZE;
			pendingWrites.push(invoke("write_scene_export_frame_batch", payload, {
				headers: {
					"x-clippster-scene-session": sessionId,
					"x-clippster-frame-first-index": String(firstFrameIndex),
					"x-clippster-frame-extension": getFrameExtension(imageFormat),
				},
			}));
			if (pendingWrites.length >= MAX_PENDING_WRITE_BATCHES) {
				await pendingWrites.shift();
			}
		};

		for (let i = 0; i < n; i++) {
			if (isCancelled?.()) {
				throw new Error("Export cancelled");
			}
			const sceneTime = getSceneFrameTime({
				frameIndex: i,
				fps,
				exportDuration,
				timeOffset,
				sceneDuration: sceneInputs.duration,
			});
			await renderer.renderToCanvas({
				node: tree,
				time: sceneTime,
				targetCanvas: encodeCanvas,
			});
			const bytes = await canvasToEncodedBytes(encodeCanvas, imageFormat);
			if (writeBatch.length === 0) {
				writeBatchFirstFrame = i + 1;
			}
			writeBatch.push(bytes);
			if (writeBatch.length >= FRAME_WRITE_BATCH_SIZE) {
				await flushWriteBatch();
			}
			onProgress?.({ progress: (i + 1) / n, phase: "frames" });
		}
		await flushWriteBatch();
		await Promise.all(pendingWrites);

		const [pattern, count] = await invoke<[string, number]>("finalize_scene_export_frames", {
			sessionId,
			extension: getFrameExtension(imageFormat),
		});
		return { pattern, frameCount: count };
	} finally {
		renderer?.dispose();
		videoCache.endExportSession();
	}
}
