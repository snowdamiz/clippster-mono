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

	/**
	 * Reused scratch layers for transition compositing.
	 * Always HTMLCanvasElement (not OffscreenCanvas): drawing OffscreenCanvas sources into
	 * another OffscreenCanvas with clip()/globalAlpha is buggy or no-ops in several Chromium
	 * / Electron builds, so crossfade/wipe/push previews looked broken while transforms
	 * (fade/slide/zoom) still appeared fine.
	 */
	private scratchOut: HTMLCanvasElement | null = null;
	private scratchIn: HTMLCanvasElement | null = null;

	private ensureScratchCanvases(w: number, h: number): {
		out: HTMLCanvasElement;
		in: HTMLCanvasElement;
	} {
		if (!this.scratchOut || this.scratchOut.width !== w || this.scratchOut.height !== h) {
			this.scratchOut = document.createElement("canvas");
			this.scratchOut.width = w;
			this.scratchOut.height = h;
			this.scratchIn = document.createElement("canvas");
			this.scratchIn.width = w;
			this.scratchIn.height = h;
		}
		return { out: this.scratchOut!, in: this.scratchIn! };
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
		const spreadHalf = this.getLayerSpreadHalf();
		const offset = spreadHalf * (1 - progress);
		let outgoingTime = time - offset;
		let incomingTime = time + offset;

		const outB = this.getClipTimelineBounds(this.outgoingNode);
		const inB = this.getClipTimelineBounds(this.incomingNode);
		const j = this.params.junctionTime;
		if (outB && inB) {
			// Widened same-file spread can push `incomingTime` well past the cut at progress≈0,
			// so wipes/crossfades looked like they started seconds early. Keep samples on-segment.
			outgoingTime = Math.min(Math.max(outgoingTime, outB.start), Math.min(outB.end, j));
			incomingTime = Math.max(Math.min(incomingTime, inB.end), Math.max(inB.start, j));
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
			const outP = this.outgoingNode?.prefetch({ renderer, time: outgoingTime }) ?? Promise.resolve();
			const inP = this.incomingNode?.prefetch({ renderer, time: incomingTime }) ?? Promise.resolve();
			await Promise.all([outP, inP]);
		} else if (time < this.params.junctionTime) {
			if (this.outgoingNode && this.isWithinClipTimelineBounds(this.outgoingNode, time)) {
				await this.outgoingNode.prefetch({ renderer, time });
			}
		} else if (
			this.incomingNode &&
			!this.params.suppressIncomingOutsideWindow &&
			this.isWithinClipTimelineBounds(this.incomingNode, time)
		) {
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

		const canvasW = renderer.width;
		const canvasH = renderer.height;
		const d = Math.max(1e-6, this.params.duration);
		const transitionStart = this.params.junctionTime - d / 2;
		const progress = (time - transitionStart) / d;
		const { outgoingTime, incomingTime } = this.getTransitionLayerDecodeTimes(time);

		const { out: outCanvas, in: inCanvas } = this.ensureScratchCanvases(canvasW, canvasH);

		const outCtx = outCanvas.getContext("2d", { willReadFrequently: true })!;
		(outCtx as CanvasRenderingContext2D).fillStyle = "black";
		(outCtx as CanvasRenderingContext2D).fillRect(0, 0, canvasW, canvasH);

		const inCtx = inCanvas.getContext("2d", { willReadFrequently: true })!;
		(inCtx as CanvasRenderingContext2D).fillStyle = "black";
		(inCtx as CanvasRenderingContext2D).fillRect(0, 0, canvasW, canvasH);

		const mainCtx = renderer.context;
		const mainCanvasRef = renderer.canvas;

		if (this.outgoingNode) {
			(renderer as any).canvas = outCanvas;
			(renderer as any).context = outCtx;
			await this.outgoingNode.render({ renderer, time: outgoingTime });
		}

		if (this.incomingNode) {
			(renderer as any).canvas = inCanvas;
			(renderer as any).context = inCtx;
			await this.incomingNode.render({ renderer, time: incomingTime });
		}

		(renderer as any).canvas = mainCanvasRef;
		(renderer as any).context = mainCtx;

		renderTransition(
			mainCtx as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
			canvasW,
			canvasH,
			outCanvas as CanvasImageSource,
			inCanvas as CanvasImageSource,
			progress,
			this.params.type,
		);
	}
}
