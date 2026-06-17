import type { BaseNode } from "./nodes/base-node";
import { getPreviewEffectProcessingSize } from "../lib/preview-decode-settings";

export type CanvasRendererParams = {
	width: number;
	height: number;
	fps: number;
	preferOffscreen?: boolean;
	previewEffectProcessing?: boolean;
	backingWidth?: number;
	backingHeight?: number;
	willReadFrequently?: boolean;
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

	constructor({
		width,
		height,
		fps,
		preferOffscreen = true,
		previewEffectProcessing = false,
		backingWidth = width,
		backingHeight = height,
		willReadFrequently = false,
	}: CanvasRendererParams) {
		this.width = width;
		this.height = height;
		this.backingWidth = Math.max(1, Math.round(backingWidth));
		this.backingHeight = Math.max(1, Math.round(backingHeight));
		this.fps = fps;
		this.previewEffectProcessing = previewEffectProcessing;

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

		const context = this.canvas.getContext("2d", { willReadFrequently });
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
		ctx.fillStyle = "black";
		ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
		this.applyLogicalScale();
	}

	async render({ node, time }: { node: BaseNode; time: number }) {
		this.clear();
		await node.render({ renderer: this, time });
	}

	async renderToCanvas({
		node,
		time,
		targetCanvas,
	}: {
		node: BaseNode;
		time: number;
		targetCanvas: HTMLCanvasElement;
	}) {
		await this.render({ node, time });

		const ctx = targetCanvas.getContext("2d");
		if (!ctx) {
			throw new Error("Failed to get target canvas context");
		}

		ctx.drawImage(this.canvas, 0, 0, targetCanvas.width, targetCanvas.height);
	}
}
