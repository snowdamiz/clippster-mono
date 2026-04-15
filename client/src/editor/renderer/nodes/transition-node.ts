import type { CanvasRenderer } from "../canvas-renderer";
import { BaseNode } from "./base-node";
import { renderTransition } from "../effects/canvas-transitions";
import type { TransitionType } from "../../types/transitions";

export interface TransitionNodeParams {
	type: TransitionType;
	/** Duration of the transition overlap in seconds */
	duration: number;
	/** Timeline time where clips meet (incoming element startTime) */
	junctionTime: number;
}

/**
 * Composites two child nodes (outgoing + incoming) using a transition effect.
 * During the transition window, both children are rendered to offscreen canvases
 * and blended together. Outside the window, children render normally.
 */
export class TransitionNode extends BaseNode<TransitionNodeParams> {
	/** The outgoing (left) video node */
	outgoingNode: BaseNode | null = null;
	/** The incoming (right) video node */
	incomingNode: BaseNode | null = null;

	private isInTransition(time: number): boolean {
		const start = this.params.junctionTime - this.params.duration / 2;
		const end = this.params.junctionTime + this.params.duration / 2;
		return time >= start && time < end;
	}

	async prefetch({ renderer, time }: { renderer: CanvasRenderer; time: number }): Promise<void> {
		const promises: Promise<void>[] = [];
		if (this.outgoingNode) promises.push(this.outgoingNode.prefetch({ renderer, time }));
		if (this.incomingNode) promises.push(this.incomingNode.prefetch({ renderer, time }));
		await Promise.all(promises);
	}

	async render({ renderer, time }: { renderer: CanvasRenderer; time: number }): Promise<void> {
		if (!this.isInTransition(time)) {
			// Outside transition window — render whichever node is active normally
			if (this.outgoingNode) await this.outgoingNode.render({ renderer, time });
			if (this.incomingNode) await this.incomingNode.render({ renderer, time });
			return;
		}

		const w = renderer.width;
		const h = renderer.height;
		const transitionStart = this.params.junctionTime - this.params.duration / 2;
		const progress = (time - transitionStart) / this.params.duration;

		// Use OffscreenCanvas if available (matches renderer), fall back to regular canvas
		let outCanvas: HTMLCanvasElement | OffscreenCanvas;
		let inCanvas: HTMLCanvasElement | OffscreenCanvas;
		try {
			outCanvas = new OffscreenCanvas(w, h);
			inCanvas = new OffscreenCanvas(w, h);
		} catch {
			outCanvas = document.createElement("canvas");
			outCanvas.width = w;
			outCanvas.height = h;
			inCanvas = document.createElement("canvas");
			inCanvas.width = w;
			inCanvas.height = h;
		}

		const outCtx = outCanvas.getContext("2d")!;
		(outCtx as CanvasRenderingContext2D).fillStyle = "black";
		(outCtx as CanvasRenderingContext2D).fillRect(0, 0, w, h);

		const inCtx = inCanvas.getContext("2d")!;
		(inCtx as CanvasRenderingContext2D).fillStyle = "black";
		(inCtx as CanvasRenderingContext2D).fillRect(0, 0, w, h);

		// Save the main renderer state, render each node to its temp canvas
		const mainCtx = renderer.context;
		const mainCanvasRef = renderer.canvas;

		if (this.outgoingNode) {
			(renderer as any).canvas = outCanvas;
			(renderer as any).context = outCtx;
			await this.outgoingNode.render({ renderer, time });
		}

		if (this.incomingNode) {
			(renderer as any).canvas = inCanvas;
			(renderer as any).context = inCtx;
			await this.incomingNode.render({ renderer, time });
		}

		// Restore the main renderer
		(renderer as any).canvas = mainCanvasRef;
		(renderer as any).context = mainCtx;

		// Composite using the transition effect
		renderTransition(
			mainCtx as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
			w,
			h,
			outCanvas as CanvasImageSource,
			inCanvas as CanvasImageSource,
			progress,
			this.params.type,
		);
	}
}
