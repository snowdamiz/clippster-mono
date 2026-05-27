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
	/**
	 * Timeline span (seconds) used to sample outgoing vs incoming during the transition.
	 * Defaults to `duration` (half on each side of `time`). For two adjacent segments from the
	 * same source file, a wider spread pulls visibly different frames so crossfade/wipe/dissolve
	 * are not imperceptible on slow-moving content.
	 */
	sampleSpread?: number;
	/** Other cuts on this track — skip simple fallback draws while any of these windows is active */
	peerTransitionWindows?: { start: number; end: number }[];
	/**
	 * When the incoming clip is also the outgoing clip of a later transition on this track,
	 * skip incoming-only fallback so the later node owns middle playback (avoids double paint).
	 */
	suppressIncomingOutsideWindow?: boolean;
}

/**
 * Composites two child nodes (outgoing + incoming) using a transition effect.
 * During the transition window, both children are rendered to scratch canvases
 * and blended onto the main renderer. Outside the window, children render normally.
 */
export class TransitionNode extends BaseNode<TransitionNodeParams> {
	/** The outgoing (left) video node */
	outgoingNode: BaseNode | null = null;
	/** The incoming (right) video node */
	incomingNode: BaseNode | null = null;
	private incomingPrewarmed = false;

	/**
	 * Reused scratch layers for transition compositing.
	 * Always HTMLCanvasElement (not OffscreenCanvas): drawing OffscreenCanvas sources into
	 * another OffscreenCanvas with clip()/globalAlpha is buggy or no-ops in several Chromium
	 * / Electron builds, so crossfade/wipe/push previews looked broken while transforms
	 * (fade/slide/zoom) still appeared fine.
	 */
	private scratchOut: HTMLCanvasElement | null = null;
	private scratchIn: HTMLCanvasElement | null = null;
	private scratchComposite: HTMLCanvasElement | null = null;
	private scratchOutCtx: CanvasRenderingContext2D | null = null;
	private scratchInCtx: CanvasRenderingContext2D | null = null;
	private scratchCompositeCtx: CanvasRenderingContext2D | null = null;

	private ensureScratchCanvases(w: number, h: number): {
		out: HTMLCanvasElement;
		in: HTMLCanvasElement;
		composite: HTMLCanvasElement;
		outCtx: CanvasRenderingContext2D;
		inCtx: CanvasRenderingContext2D;
		compositeCtx: CanvasRenderingContext2D;
	} {
		if (!this.scratchOut || this.scratchOut.width !== w || this.scratchOut.height !== h) {
			this.scratchOut = document.createElement("canvas");
			this.scratchOut.width = w;
			this.scratchOut.height = h;
			this.scratchIn = document.createElement("canvas");
			this.scratchIn.width = w;
			this.scratchIn.height = h;
			this.scratchComposite = document.createElement("canvas");
			this.scratchComposite.width = w;
			this.scratchComposite.height = h;
			this.scratchOutCtx = this.scratchOut.getContext("2d");
			this.scratchInCtx = this.scratchIn.getContext("2d");
			this.scratchCompositeCtx = this.scratchComposite.getContext("2d");
			if (!this.scratchOutCtx || !this.scratchInCtx || !this.scratchCompositeCtx) {
				throw new Error("Failed to create transition scratch canvas contexts");
			}
		}
		return {
			out: this.scratchOut!,
			in: this.scratchIn!,
			composite: this.scratchComposite!,
			outCtx: this.scratchOutCtx!,
			inCtx: this.scratchInCtx!,
			compositeCtx: this.scratchCompositeCtx!,
		};
	}

	private prepareScratchContext(
		canvas: HTMLCanvasElement,
		ctx: CanvasRenderingContext2D,
		renderer: CanvasRenderer,
	): CanvasRenderingContext2D {
		// Reset state left by the previous frame, then apply the same logical->backing transform
		// CanvasRenderer uses for the main preview canvas. This keeps masks and transforms centered
		// while compositing at preview backing resolution instead of full project resolution.
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = "source-over";
		ctx.filter = "none";
		ctx.fillStyle = "black";
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		ctx.setTransform(
			canvas.width / renderer.width,
			0,
			0,
			canvas.height / renderer.height,
			0,
			0,
		);
		return ctx;
	}

	private async renderChildToScratch({
		renderer,
		node,
		time,
		canvas,
		ctx,
	}: {
		renderer: CanvasRenderer;
		node: BaseNode;
		time: number;
		canvas: HTMLCanvasElement;
		ctx: CanvasRenderingContext2D;
	}): Promise<void> {
		this.prepareScratchContext(canvas, ctx, renderer);
		const mainCanvasRef = renderer.canvas;
		const mainCtx = renderer.context;
		const mainBackingWidth = renderer.backingWidth;
		const mainBackingHeight = renderer.backingHeight;

		try {
			renderer.canvas = canvas;
			renderer.context = ctx;
			renderer.backingWidth = canvas.width;
			renderer.backingHeight = canvas.height;
			await node.render({ renderer, time });
		} finally {
			renderer.canvas = mainCanvasRef;
			renderer.context = mainCtx;
			renderer.backingWidth = mainBackingWidth;
			renderer.backingHeight = mainBackingHeight;
		}
	}

	private getSampleHalfWidth(): number {
		const d = Math.max(1e-6, this.params.duration);
		const spread = Math.max(d, this.params.sampleSpread ?? d);
		return spread / 2;
	}

	private useWidenedLayerSpread(): boolean {
		const spread = this.params.sampleSpread;
		const d = Math.max(1e-6, this.params.duration);
		return spread != null && spread > d + 1e-9;
	}

	private getLayerSpreadHalf(): number {
		const d = Math.max(1e-6, this.params.duration);
		return this.useWidenedLayerSpread() ? this.getSampleHalfWidth() : d / 2;
	}

	private getClipTimelineBounds(node: BaseNode | null): { start: number; end: number } | null {
		if (!node) return null;
		const p = (node as { params?: { timeOffset?: number; duration?: number } }).params;
		if (
			p &&
			typeof p.timeOffset === "number" &&
			typeof p.duration === "number" &&
			Number.isFinite(p.timeOffset) &&
			Number.isFinite(p.duration)
		) {
			return { start: p.timeOffset, end: p.timeOffset + p.duration };
		}
		return null;
	}

	private isWithinClipTimelineBounds(node: BaseNode | null, time: number): boolean {
		const bounds = this.getClipTimelineBounds(node);
		if (!bounds) return true;
		return time >= bounds.start && time < bounds.end;
	}

	/** Only valid when {@link isInTransition} is true for `time`. */
	private getTransitionLayerDecodeTimes(time: number): { outgoingTime: number; incomingTime: number } {
		if (!this.useWidenedLayerSpread()) {
			return { outgoingTime: time, incomingTime: time };
		}

		const d = Math.max(1e-6, this.params.duration);
		const transitionStart = this.params.junctionTime - d / 2;
		const progress = Math.max(0, Math.min(1, (time - transitionStart) / d));
		const widenedHalf = this.getSampleHalfWidth();
		const extraIncomingLead = Math.max(0, widenedHalf - d / 2);
		const outgoingTime = time;
		let incomingTime = time + (1 - progress) * extraIncomingLead;

		const inB = this.getClipTimelineBounds(this.incomingNode);
		if (inB) {
			incomingTime = Math.max(
				Math.min(incomingTime, inB.end),
				Math.max(inB.start, this.params.junctionTime),
			);
		}

		return { outgoingTime, incomingTime };
	}

	private isInPeerTransitionWindow(time: number): boolean {
		const peers = this.params.peerTransitionWindows;
		if (!peers?.length) return false;
		return peers.some(({ start, end }) => time >= start && time < end);
	}

	private isInTransition(time: number): boolean {
		const d = Math.max(1e-6, this.params.duration);
		const start = this.params.junctionTime - d / 2;
		const end = this.params.junctionTime + d / 2;
		return time >= start && time < end;
	}

	async prefetch({ renderer, time }: { renderer: CanvasRenderer; time: number }): Promise<void> {
		const inTransition = this.isInTransition(time);
		// Mirror render(): another transition owns this timeline instant — do not prefetch our
		// children at `time` (would stomp the shared middle clip's prefetchedFrame before it renders).
		if (!inTransition && this.isInPeerTransitionWindow(time)) {
			return;
		}

		const { outgoingTime, incomingTime } = inTransition
			? this.getTransitionLayerDecodeTimes(time)
			: { outgoingTime: time, incomingTime: time };

		if (inTransition) {
			const prefetches: Promise<void>[] = [];
			if (this.outgoingNode) {
				prefetches.push(this.outgoingNode.prefetch({ renderer, time: outgoingTime }));
			}
			if (this.incomingNode) {
				prefetches.push(this.incomingNode.prefetch({ renderer, time: incomingTime }));
			}
			await Promise.all(prefetches);
		} else if (time < this.params.junctionTime) {
			const d = Math.max(1e-6, this.params.duration);
			const transitionStart = this.params.junctionTime - d / 2;
			const prewarmStart = transitionStart - Math.min(0.5, d / 2);
			if (time < prewarmStart) {
				this.incomingPrewarmed = false;
			}
			if (this.outgoingNode && this.isWithinClipTimelineBounds(this.outgoingNode, time)) {
				await this.outgoingNode.prefetch({ renderer, time });
			}
			if (
				this.incomingNode &&
				time >= prewarmStart &&
				!this.incomingPrewarmed
			) {
				await this.incomingNode.prefetch({ renderer, time: transitionStart });
				this.incomingPrewarmed = true;
			}
		} else if (
			this.incomingNode &&
			!this.params.suppressIncomingOutsideWindow &&
			this.isWithinClipTimelineBounds(this.incomingNode, time)
		) {
			this.incomingPrewarmed = false;
			await this.incomingNode.prefetch({ renderer, time });
		}
	}

	async render({ renderer, time }: { renderer: CanvasRenderer; time: number }): Promise<void> {
		if (!this.isInTransition(time)) {
			if (this.isInPeerTransitionWindow(time)) {
				return;
			}
			if (time < this.params.junctionTime) {
				if (this.outgoingNode && this.isWithinClipTimelineBounds(this.outgoingNode, time)) {
					await this.outgoingNode.render({ renderer, time });
				}
			} else if (
				this.incomingNode &&
				!this.params.suppressIncomingOutsideWindow &&
				this.isWithinClipTimelineBounds(this.incomingNode, time)
			) {
				await this.incomingNode.render({ renderer, time });
			}
			return;
		}

		const { width: canvasW, height: canvasH } = renderer.getBackingSize();
		const d = Math.max(1e-6, this.params.duration);
		const transitionStart = this.params.junctionTime - d / 2;
		const progress = (time - transitionStart) / d;
		const { outgoingTime, incomingTime } = this.getTransitionLayerDecodeTimes(time);

		const { out: outCanvas, in: inCanvas, composite: compositeCanvas, outCtx, inCtx, compositeCtx } =
			this.ensureScratchCanvases(canvasW, canvasH);

		const mainCtx = renderer.context;

		if (this.outgoingNode) {
			await this.renderChildToScratch({
				renderer,
				node: this.outgoingNode,
				time: outgoingTime,
				canvas: outCanvas,
				ctx: outCtx,
			});
		} else {
			this.prepareScratchContext(outCanvas, outCtx, renderer);
		}

		if (this.incomingNode) {
			await this.renderChildToScratch({
				renderer,
				node: this.incomingNode,
				time: incomingTime,
				canvas: inCanvas,
				ctx: inCtx,
			});
		} else {
			this.prepareScratchContext(inCanvas, inCtx, renderer);
		}

		if (renderer.canvas instanceof HTMLCanvasElement) {
			mainCtx.save();
			mainCtx.setTransform(1, 0, 0, 1, 0, 0);
			mainCtx.clearRect(0, 0, canvasW, canvasH);
			renderTransition(
				mainCtx as CanvasRenderingContext2D,
				canvasW,
				canvasH,
				outCanvas as CanvasImageSource,
				inCanvas as CanvasImageSource,
				progress,
				this.params.type,
			);
			mainCtx.restore();
		} else {
			compositeCtx.setTransform(1, 0, 0, 1, 0, 0);
			compositeCtx.clearRect(0, 0, canvasW, canvasH);
			renderTransition(
				compositeCtx,
				canvasW,
				canvasH,
				outCanvas as CanvasImageSource,
				inCanvas as CanvasImageSource,
				progress,
				this.params.type,
			);
			mainCtx.save();
			mainCtx.setTransform(1, 0, 0, 1, 0, 0);
			mainCtx.globalAlpha = 1;
			mainCtx.globalCompositeOperation = "source-over";
			mainCtx.filter = "none";
			mainCtx.drawImage(compositeCanvas, 0, 0, canvasW, canvasH);
			mainCtx.restore();
		}
	}
}
