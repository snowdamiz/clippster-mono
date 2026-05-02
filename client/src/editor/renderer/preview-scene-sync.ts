import { buildScene } from "./scene-builder";
import { computeSceneInputFingerprint } from "../lib/scene-input-fingerprint";
import type { RootNode } from "./nodes/root-node";
import type { TimelineTrack } from "../types/timeline";
import type { MediaAsset } from "../types/assets";
import type { Transition } from "../types/transitions";
import type { TBackground, TCanvasSize } from "../types/project";
import { previewPerfMarkBuildScene } from "../lib/preview-performance";

export type PreviewSceneInputs = {
	tracks: TimelineTrack[];
	mediaAssets: MediaAsset[];
	duration: number;
	canvasSize: TCanvasSize;
	background: TBackground;
	transitions: Transition[];
};

export type PreviewSceneCache = {
	fingerprint: string | null;
	tree: RootNode | null;
};

export function buildPreviewSceneTree(inputs: PreviewSceneInputs): RootNode {
	return buildScene({
		tracks: inputs.tracks,
		mediaAssets: inputs.mediaAssets,
		duration: inputs.duration,
		canvasSize: inputs.canvasSize,
		background: inputs.background,
		transitions: inputs.transitions,
	});
}

/**
 * Returns cached tree when fingerprint matches; otherwise builds and updates cache + perf marks.
 */
export function getPreviewSceneTreeCached(
	cache: PreviewSceneCache,
	inputs: PreviewSceneInputs,
): { tree: RootNode; buildMs: number; cacheHit: boolean } {
	const fp = computeSceneInputFingerprint({
		tracks: inputs.tracks,
		mediaAssets: inputs.mediaAssets,
		transitions: inputs.transitions,
		canvasSize: inputs.canvasSize,
		background: inputs.background,
		duration: inputs.duration,
	});

	if (cache.fingerprint === fp && cache.tree) {
		return { tree: cache.tree, buildMs: 0, cacheHit: true };
	}

	const t0 = performance.now();
	const tree = buildPreviewSceneTree(inputs);
	const buildMs = performance.now() - t0;
	previewPerfMarkBuildScene(buildMs);

	cache.fingerprint = fp;
	cache.tree = tree;
	return { tree, buildMs, cacheHit: false };
}

export function invalidatePreviewSceneCache(cache: PreviewSceneCache): void {
	cache.fingerprint = null;
	cache.tree = null;
}
