import type { CanvasRenderer } from "./canvas-renderer";
import { BaseNode } from "./nodes/base-node";
import { TransitionNode } from "./nodes/transition-node";
import { VideoNode } from "./nodes/video-node";

/**
 * Block until every video layer that is on-screen (or about to start) has its
 * first realtime frames in the stable preview cache. Call this only from
 * before-play / paused paths — never from the realtime composition loop.
 */
export async function prepareSceneForRealtimePlayback({
	root,
	renderer,
	time,
}: {
	root: BaseNode;
	renderer: CanvasRenderer;
	time: number;
}): Promise<void> {
	const videos: VideoNode[] = [];
	const visit = (node: BaseNode) => {
		if (node instanceof VideoNode) {
			videos.push(node);
		}
		if (node instanceof TransitionNode) {
			if (node.outgoingNode) visit(node.outgoingNode);
			if (node.incomingNode) visit(node.incomingNode);
		}
		for (const child of node.children) {
			visit(child);
		}
	};
	visit(root);
	await Promise.all(
		videos.map((node) => node.prepareRealtimeEntry({ renderer, time })),
	);
}
