import type { CanvasRenderer } from "../canvas-renderer";
import { BaseNode } from "./base-node";
import { renderTransition } from "../effects/canvas-transitions";
import type { TransitionType } from "../../types/transitions";

type TransitionDebugLayer = "outgoing" | "incoming";
type TransitionDebugPhase = "prefetch" | "render";
type TransitionDebugContext = {
	transitionType: TransitionType;
	layer: TransitionDebugLayer;
	phase: TransitionDebugPhase;
	timelineTime: number;
	progress: number;
	outgoingTime: number;
	incomingTime: number;
};

const TRANSITION_DEBUG_KEY = "__clippsterTransitionDebug" as const;

type DebugRenderer = CanvasRenderer & {
	[TRANSITION_DEBUG_KEY]?: TransitionDebugContext;
};

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
	private lastDebugSample: { time: number; progress: number; outgoingTime: number; incomingTime: number } | null = null;
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

	private isDebugTransition(): boolean {
		return this.params.type === "diamondWipe";
	}

	private logDebug(event: string, payload: Record<string, unknown>): void {
		if (!this.isDebugTransition()) return;
		console.log(`[TransitionDebug][TransitionNode.${event}]`, {
			type: this.params.type,
			...payload,
		});
	}

	private async withRendererDebugContext<T>(
		renderer: CanvasRenderer,
		context: TransitionDebugContext,
		run: () => Promise<T>,
	): Promise<T> {
		const debugRenderer = renderer as DebugRenderer;
		const previous = debugRenderer[TRANSITION_DEBUG_KEY];
		debugRenderer[TRANSITION_DEBUG_KEY] = context;
		try {
			return await run();
		} finally {
			debugRenderer[TRANSITION_DEBUG_KEY] = previous;
		}
	}

	private async runTransitionChild({
		renderer,
		layer,
		phase,
		timelineTime,
		progress,
		sampleTime,
		outgoingTime,
		incomingTime,
		run,
	}: {
		renderer: CanvasRenderer;
		layer: TransitionDebugLayer;
		phase: TransitionDebugPhase;
		timelineTime: number;
		progress: number;
		sampleTime: number;
		outgoingTime: number;
		incomingTime: number;
		run: () => Promise<void>;
	}): Promise<void> {
		const started = performance.now();
		await this.withRendererDebugContext(
			renderer,
			{
				transitionType: this.params.type,
				layer,
				phase,
				timelineTime,
				progress,
				outgoingTime,
				incomingTime,
			},
			run,
		);
		this.logDebug(`${phase}-${layer}`, {
			timelineTime,
			progress,
			sampleTime,
			durationMs: performance.now() - started,
		});
	}

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
			const d = Math.max(1e-6, this.params.duration);
			const transitionStart = this.params.junctionTime - d / 2;
			const progress = Math.max(0, Math.min(1, (time - transitionStart) / d));
			const started = performance.now();
			if (this.outgoingNode) {
				await this.runTransitionChild({
					renderer,
					layer: "outgoing",
					phase: "prefetch",
					timelineTime: time,
					progress,
					sampleTime: outgoingTime,
					outgoingTime,
					incomingTime,
					run: () => this.outgoingNode!.prefetch({ renderer, time: outgoingTime }),
				});
			}
			if (this.incomingNode) {
				await this.runTransitionChild({
					renderer,
					layer: "incoming",
					phase: "prefetch",
					timelineTime: time,
					progress,
					sampleTime: incomingTime,
					outgoingTime,
					incomingTime,
					run: () => this.incomingNode!.prefetch({ renderer, time: incomingTime }),
				});
			}
			this.logDebug("prefetch", {
				timelineTime: time,
				progress,
				outgoingTime,
				incomingTime,
				durationMs: performance.now() - started,
			});
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
				await this.runTransitionChild({
					renderer,
					layer: "incoming",
					phase: "prefetch",
					timelineTime: time,
					progress: 0,
					sampleTime: transitionStart,
					outgoingTime: time,
					incomingTime: transitionStart,
					run: () => this.incomingNode!.prefetch({ renderer, time: transitionStart }),
				});
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

		const canvasW = renderer.width;
		const canvasH = renderer.height;
		const d = Math.max(1e-6, this.params.duration);
		const transitionStart = this.params.junctionTime - d / 2;
		const progress = (time - transitionStart) / d;
		const { outgoingTime, incomingTime } = this.getTransitionLayerDecodeTimes(time);
		const renderStarted = performance.now();
		const previousSample = this.lastDebugSample;

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
			await this.runTransitionChild({
				renderer,
				layer: "outgoing",
				phase: "render",
				timelineTime: time,
				progress,
				sampleTime: outgoingTime,
				outgoingTime,
				incomingTime,
				run: () => this.outgoingNode!.render({ renderer, time: outgoingTime }),
			});
		}

		if (this.incomingNode) {
			(renderer as any).canvas = inCanvas;
			(renderer as any).context = inCtx;
			await this.runTransitionChild({
				renderer,
				layer: "incoming",
				phase: "render",
				timelineTime: time,
				progress,
				sampleTime: incomingTime,
				outgoingTime,
				incomingTime,
				run: () => this.incomingNode!.render({ renderer, time: incomingTime }),
			});
		}

		(renderer as any).canvas = mainCanvasRef;
		(renderer as any).context = mainCtx;

		const effectStarted = performance.now();
		renderTransition(
			mainCtx as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
			canvasW,
			canvasH,
			outCanvas as CanvasImageSource,
			inCanvas as CanvasImageSource,
			progress,
			this.params.type,
		);
		this.logDebug("render", {
			timelineTime: time,
			progress,
			outgoingTime,
			incomingTime,
			timelineDelta: previousSample ? time - previousSample.time : null,
			progressDelta: previousSample ? progress - previousSample.progress : null,
			outgoingDelta: previousSample ? outgoingTime - previousSample.outgoingTime : null,
			incomingDelta: previousSample ? incomingTime - previousSample.incomingTime : null,
			effectMs: performance.now() - effectStarted,
			totalMs: performance.now() - renderStarted,
		});
		this.lastDebugSample = { time, progress, outgoingTime, incomingTime };
	}
}
