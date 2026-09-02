import type { BaseNode } from "./nodes/base-node";
import type { CanvasRenderer } from "./canvas-renderer";
import { VideoNode } from "./nodes/video-node";

function collectSceneNodes(node: BaseNode, out: BaseNode[]) {
	out.push(node);
	for (const child of node.children) {
		collectSceneNodes(child, out);
	}
}

/** Decode/load every segment before the export frame loop hits cold cuts. */
export async function prewarmSceneSegmentsForExport(
	root: BaseNode,
	renderer: CanvasRenderer,
): Promise<void> {
	const nodes: BaseNode[] = [];
	collectSceneNodes(root, nodes);

	// Prewarm in timeline order so image→video cuts decode the incoming clip
	// before the first frame is baked (matches preview playback warmup).
	const sorted = [...nodes].sort((a, b) => {
		const aStart = (a.params as { timeOffset?: number })?.timeOffset ?? 0;
		const bStart = (b.params as { timeOffset?: number })?.timeOffset ?? 0;
		return aStart - bStart;
	});

	for (const node of sorted) {
		const params = node.params as { timeOffset?: number } | undefined;
		if (params?.timeOffset == null) continue;
		await node.prewarm({ renderer, time: params.timeOffset });
		if (node instanceof VideoNode) {
			await node.prewarm({ renderer, time: params.timeOffset + 1 / renderer.fps });
		}
	}
}
