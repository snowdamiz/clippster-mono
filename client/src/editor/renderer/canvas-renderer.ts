import type { BaseNode } from "./nodes/base-node";
import { getPreviewEffectProcessingSize } from "../lib/preview-decode-settings";
import type { FrameRenderPolicy } from "./frame-policy";

export type CanvasRendererParams = {
	width: number;
	height: number;
	fps: number;
	preferOffscreen?: boolean;
	previewEffectProcessing?: boolean;
	backingWidth?: number;
	backingHeight?: number;
	willReadFrequently?: boolean;
	framePolicy?: FrameRenderPolicy;
	/**
	 * Interactive preview renderers set this so paused/exact renders still warm
	 * decoders for upcoming segment cuts (pressing play right before a cut must
	 * not stall on a cold decoder). One-off renderers (thumbnails, covers,
	 * export) leave it off.
	 */
	prewarmUpcoming?: boolean;
	/**
	 * How to clear the backing store each frame.
	 * Use `"transparent"` for image-mode / PNG alpha (checkerboard shows through in CSS).
	 * Video preview stays `"black"`.
	 */
	clearStyle?: "black" | "transparent";
};

export class CanvasRenderer {
	canvas: OffscreenCanvas | HTMLCanvasElement;
	context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
	width: number;
	height: number;
	backingWidth: number;
	backingHeight: number;
	fps: number;
	previewEffectProcessing: boolean;
	framePolicy: FrameRenderPolicy;
	prewarmUpcoming: boolean;
	clearStyle: "black" | "transparent";

	constructor({
		width,
		height,
		fps,
		preferOffscreen = true,
		previewEffectProcessing = false,
		backingWidth = width,
		backingHeight = height,
		willReadFrequently = false,
		framePolicy = "exact-preview",
		prewarmUpcoming = false,
		clearStyle = "black",
	}: CanvasRendererParams) {
		this.width = width;
		this.height = height;
		this.backingWidth = Math.max(1, Math.round(backingWidth));
		this.backingHeight = Math.max(1, Math.round(backingHeight));
		this.fps = fps;
		this.previewEffectProcessing = previewEffectProcessing;
		this.framePolicy = framePolicy;
		this.prewarmUpcoming = prewarmUpcoming;
		this.clearStyle = clearStyle;

		if (preferOffscreen) {
			try {
				this.canvas = new OffscreenCanvas(this.backingWidth, this.backingHeight);
			} catch {
				this.canvas = document.createElement("canvas");
				this.canvas.width = this.backingWidth;
				this.canvas.height = this.backingHeight;
			}
		} else {
			this.canvas = document.createElement("canvas");
			this.canvas.width = this.backingWidth;
			this.canvas.height = this.backingHeight;
		}

		const context = this.canvas.getContext("2d", {
			willReadFrequently,
			alpha: true,
		});
		if (!context) {
			throw new Error("Failed to get canvas context");
		}

		this.context = context as
			| OffscreenCanvasRenderingContext2D
			| CanvasRenderingContext2D;
	}

	getEffectProcessingSize(): { width: number; height: number } {
		if (!this.previewEffectProcessing) {
			return { width: this.backingWidth, height: this.backingHeight };
		}
		return getPreviewEffectProcessingSize(this.backingWidth, this.backingHeight);
	}

	getBackingSize(): { width: number; height: number } {
		return { width: this.backingWidth, height: this.backingHeight };
	}

	private applyLogicalScale() {
		this.context.setTransform(
			this.backingWidth / this.width,
			0,
			0,
			this.backingHeight / this.height,
			0,
			0,
		);
	}

	setSize({
		width,
		height,
		backingWidth = width,
		backingHeight = height,
		willReadFrequently = false,
	}: {
		width: number;
		height: number;
		backingWidth?: number;
		backingHeight?: number;
		willReadFrequently?: boolean;
	}) {
		this.width = width;
		this.height = height;
		this.backingWidth = Math.max(1, Math.round(backingWidth));
		this.backingHeight = Math.max(1, Math.round(backingHeight));

		if (this.canvas instanceof OffscreenCanvas) {
			this.canvas = new OffscreenCanvas(this.backingWidth, this.backingHeight);
		} else {
			this.canvas.width = this.backingWidth;
			this.canvas.height = this.backingHeight;
		}

		const context = this.canvas.getContext("2d", { willReadFrequently });
		if (!context) {
			throw new Error("Failed to get canvas context");
		}
		this.context = context as
			| OffscreenCanvasRenderingContext2D
			| CanvasRenderingContext2D;
	}

	private clear() {
		const ctx = this.context;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		// Reset paint state leaked by prior frames (effects/animations may leave alpha at 0).
		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = "source-over";
		ctx.filter = "none";
		if (this.clearStyle === "transparent") {
			ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		} else {
			ctx.fillStyle = "black";
			ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
		}
		this.applyLogicalScale();
	}

	async prefetchFrame({
		node,
		time,
		signal,
	}: {
		node: BaseNode;
		time: number;
		signal?: AbortSignal;
	}) {
		if (signal?.aborted) return;
		await node.prefetch({ renderer: this, time });
	}

	async composeFrame({
		node,
		time,
		signal,
	}: {
		node: BaseNode;
		time: number;
		signal?: AbortSignal;
	}) {
		if (signal?.aborted) return;
		this.clear();
		await node.render({ renderer: this, time, skipPrefetch: true });
	}

	async render({
		node,
		time,
		signal,
	}: {
		node: BaseNode;
		time: number;
		signal?: AbortSignal;
	}) {
		await this.prefetchFrame({ node, time, signal });
		await this.composeFrame({ node, time, signal });
	}

	async renderToCanvas({
		node,
		time,
		targetCanvas,
		signal,
	}: {
		node: BaseNode;
		time: number;
		targetCanvas: HTMLCanvasElement;
		signal?: AbortSignal;
	}) {
		await this.render({ node, time, signal });
		if (signal?.aborted) return;

		const ctx = targetCanvas.getContext("2d");
		if (!ctx) {
			throw new Error("Failed to get target canvas context");
		}

		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = "source-over";
		if (this.clearStyle === "transparent") {
			ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
		}
		ctx.drawImage(this.canvas, 0, 0, targetCanvas.width, targetCanvas.height);
	}
}
