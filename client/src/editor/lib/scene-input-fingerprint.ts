import type { TimelineTrack } from "../types/timeline";
import type { MediaAsset } from "../types/assets";
import type { Transition } from "../types/transitions";
import type { TBackground, TCanvasSize } from "../types/project";

/**
 * Fast stable string for skipping redundant buildScene when timeline inputs are unchanged.
 * Not cryptographic — only for cache keys.
 */
export function computeSceneInputFingerprint(params: {
	tracks: TimelineTrack[];
	mediaAssets: MediaAsset[];
	transitions: Transition[];
	canvasSize: TCanvasSize;
	background: TBackground;
	duration: number;
}): string {
	const { tracks, mediaAssets, transitions, canvasSize, background, duration } = params;

	const mediaPart = mediaAssets
		.map((m) => `${m.id}:${m.type}:${m.file?.size ?? 0}:${m.width ?? 0}:${m.height ?? 0}`)
		.sort()
		.join("|");

	const trackPart = JSON.stringify(
		tracks.map((t) => ({
			id: t.id,
			type: t.type,
			hidden: "hidden" in t ? t.hidden : undefined,
			locked: "locked" in t ? t.locked : undefined,
			elements: t.elements.map((el) => ({
				id: el.id,
				type: el.type,
				startTime: el.startTime,
				duration: el.duration,
				hidden: "hidden" in el ? el.hidden : undefined,
				orderIndex: "orderIndex" in el ? el.orderIndex : undefined,
				mediaId: "mediaId" in el ? (el as { mediaId?: string }).mediaId : undefined,
				// Include effect stacks and masks in hash so edits invalidate cache
				effects: "effects" in el ? (el as { effects?: unknown }).effects : undefined,
				masks: "masks" in el ? (el as { masks?: unknown }).masks : undefined,
				keyframes: "keyframes" in el ? (el as { keyframes?: unknown }).keyframes : undefined,
			})),
		})),
	);

	const trPart = JSON.stringify(
		transitions.map((tr) => ({
			id: tr.id,
			type: tr.type,
			duration: tr.duration,
			targetElementId: tr.targetElementId,
			trackId: tr.trackId,
		})),
	);

	const bgPart = JSON.stringify(background);
	const sizePart = `${canvasSize.width}x${canvasSize.height}`;
	return `${duration.toFixed(4)}|${sizePart}|${bgPart}|${mediaPart}|${trackPart}|${trPart}`;
}
