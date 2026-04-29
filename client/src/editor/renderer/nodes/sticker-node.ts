import type { CanvasRenderer } from "../canvas-renderer";
import { BaseNode, type BaseNodeParams } from "./base-node";
import type { Transform, BlendMode } from "../../types/timeline";
import type { ElementKeyframes } from "../../types/keyframes";
import { getKeyframedValue } from "../../types/keyframes";
import type { ElementAnimation } from "../../types/animations";
import { computeAnimationTransforms, applyAnimationToContext } from "../effects/canvas-animations";

const STICKER_EPSILON = 1 / 1000;

export type StickerNodeParams = BaseNodeParams & {
	iconName: string;
	duration: number;
	timeOffset: number;
	trimStart: number;
	trimEnd: number;
	transform: Transform;
	opacity: number;
	color?: string;
	fadeIn?: number;
	fadeOut?: number;
	keyframes?: ElementKeyframes;
	animationIn?: ElementAnimation;
	animationOut?: ElementAnimation;
	animationLoop?: ElementAnimation;
	blendMode?: BlendMode;
};

export class StickerNode extends BaseNode<StickerNodeParams> {
	private image?: HTMLImageElement;
	private readyPromise: Promise<void>;
	private iconUrl: string;

	constructor(params: StickerNodeParams) {
		super(params);
		const color = this.params.color
			? `&color=${encodeURIComponent(this.params.color)}`
			: "";
		this.iconUrl = `https://api.iconify.design/${this.params.iconName}.svg?width=200&height=200${color}`;
		this.readyPromise = this.load();
	}

	private async load() {
		const image = new Image();
		image.crossOrigin = "anonymous";
		this.image = image;

		await new Promise<void>((resolve, reject) => {
			image.onload = () => resolve();
			image.onerror = () =>
				reject(new Error(`Failed to load sticker: ${this.params.iconName}`));
			image.src = this.iconUrl;
		});
	}

	private getStickerTime(time: number) {
		return time - this.params.timeOffset + this.params.trimStart;
	}

	private isInRange(time: number) {
		const stickerTime = this.getStickerTime(time);
		return (
			stickerTime >= this.params.trimStart - STICKER_EPSILON &&
			stickerTime < this.params.trimStart + this.params.duration
		);
	}

	async render({ renderer, time }: { renderer: CanvasRenderer; time: number }) {
		await super.render({ renderer, time });

		if (!this.isInRange(time)) {
			return;
		}

		await this.readyPromise;

		if (!this.image) {
			return;
		}

		const { transform, opacity } = this.params;

		// Resolve keyframed values
		const elapsed = time - this.params.timeOffset;
		const normalizedTime = this.params.duration > 0 ? elapsed / this.params.duration : 0;
		const kf = this.params.keyframes;
		let resolvedOpacity = getKeyframedValue({ elementKeyframes: kf, property: "opacity", normalizedTime, defaultValue: opacity });
		const resolvedScale = getKeyframedValue({ elementKeyframes: kf, property: "scale", normalizedTime, defaultValue: transform.scale });
		const resolvedPosX = getKeyframedValue({ elementKeyframes: kf, property: "positionX", normalizedTime, defaultValue: transform.position.x });
		const resolvedPosY = getKeyframedValue({ elementKeyframes: kf, property: "positionY", normalizedTime, defaultValue: transform.position.y });
		const resolvedRotation = getKeyframedValue({ elementKeyframes: kf, property: "rotation", normalizedTime, defaultValue: transform.rotate });
		const size = 200 * resolvedScale;
		const x = renderer.width / 2 + resolvedPosX - size / 2;
		const y = renderer.height / 2 + resolvedPosY - size / 2;

		// Apply fade in/out opacity ramp
		const fadeIn = this.params.fadeIn ?? 0;
		const fadeOut = this.params.fadeOut ?? 0;
		if (fadeIn > 0 && elapsed < fadeIn) {
			resolvedOpacity *= elapsed / fadeIn;
		}
		if (fadeOut > 0 && elapsed > this.params.duration - fadeOut) {
			resolvedOpacity *= (this.params.duration - elapsed) / fadeOut;
		}

		renderer.context.save();
		renderer.context.globalAlpha = resolvedOpacity;

		if (this.params.blendMode && this.params.blendMode !== "normal") {
			renderer.context.globalCompositeOperation = this.params.blendMode as GlobalCompositeOperation;
		}

		// Apply element animations (in/out/loop)
		const animResult = computeAnimationTransforms(
			this.params.animationIn,
			this.params.animationOut,
			this.params.animationLoop,
			{ elapsed, elementDuration: this.params.duration, canvasWidth: renderer.width, canvasHeight: renderer.height },
		);
		applyAnimationToContext(renderer.context, animResult, x + size / 2, y + size / 2);

		if (resolvedRotation !== 0) {
			const centerX = x + size / 2;
			const centerY = y + size / 2;
			renderer.context.translate(centerX, centerY);
			renderer.context.rotate((resolvedRotation * Math.PI) / 180);
			renderer.context.translate(-centerX, -centerY);
		}

		renderer.context.drawImage(this.image, x, y, size, size);
		renderer.context.restore();
	}

	/**
	 * Render this sticker to a standalone OffscreenCanvas as a transparent PNG.
	 * Used by the export pipeline to composite stickers as image overlays in FFmpeg,
	 * giving pixel-perfect preview-export parity.
	 */
	async renderToImage({
		canvasWidth,
		canvasHeight,
		sampleTime,
	}: {
		canvasWidth: number;
		canvasHeight: number;
		/** Timeline seconds used to sample keyframes / fades (default: element midpoint). */
		sampleTime?: number;
	}): Promise<{ blob: Blob } | null> {
		// Fetch the SVG as a blob URL to guarantee no CORS canvas taint.
		// The normal Image load (used for preview) can taint the canvas,
		// which causes OffscreenCanvas.convertToBlob() to throw.
		const image = await this.fetchAsBlobImage();
		if (!image) {
			console.warn(`[StickerNode.renderToImage] Failed to fetch sticker image: ${this.params.iconName}`);
			return null;
		}

		const offscreen = new OffscreenCanvas(canvasWidth, canvasHeight);
		const ctx = offscreen.getContext("2d");
		if (!ctx) return null;

		const timelineT = sampleTime ?? this.params.timeOffset + this.params.duration / 2;
		const elapsed = timelineT - this.params.timeOffset;
		const normalizedTime = this.params.duration > 0 ? elapsed / this.params.duration : 0;
		const kf = this.params.keyframes;
		const { transform, opacity } = this.params;

		let resolvedOpacity = getKeyframedValue({
			elementKeyframes: kf,
			property: "opacity",
			normalizedTime,
			defaultValue: opacity,
		});
		const resolvedScale = getKeyframedValue({
			elementKeyframes: kf,
			property: "scale",
			normalizedTime,
			defaultValue: transform.scale,
		});
		const resolvedPosX = getKeyframedValue({
			elementKeyframes: kf,
			property: "positionX",
			normalizedTime,
			defaultValue: transform.position.x,
		});
		const resolvedPosY = getKeyframedValue({
			elementKeyframes: kf,
			property: "positionY",
			normalizedTime,
			defaultValue: transform.position.y,
		});
		const resolvedRotation = getKeyframedValue({
			elementKeyframes: kf,
			property: "rotation",
			normalizedTime,
			defaultValue: transform.rotate,
		});

		const size = 200 * resolvedScale;
		const x = canvasWidth / 2 + resolvedPosX - size / 2;
		const y = canvasHeight / 2 + resolvedPosY - size / 2;

		ctx.clearRect(0, 0, canvasWidth, canvasHeight);

		const fadeIn = this.params.fadeIn ?? 0;
		const fadeOut = this.params.fadeOut ?? 0;
		if (fadeIn > 0 && elapsed < fadeIn) {
			resolvedOpacity *= elapsed / fadeIn;
		}
		if (fadeOut > 0 && elapsed > this.params.duration - fadeOut) {
			resolvedOpacity *= (this.params.duration - elapsed) / fadeOut;
		}
		ctx.globalAlpha = resolvedOpacity;

		if (resolvedRotation !== 0) {
			const centerX = x + size / 2;
			const centerY = y + size / 2;
			ctx.translate(centerX, centerY);
			ctx.rotate((resolvedRotation * Math.PI) / 180);
			ctx.translate(-centerX, -centerY);
		}

		ctx.drawImage(image, x, y, size, size);

		const blob = await offscreen.convertToBlob({ type: "image/png" });
		return { blob };
	}

	/**
	 * Fetch the sticker SVG via fetch() and load it as a blob URL image.
	 * This avoids CORS canvas tainting that happens when drawing a
	 * cross-origin Image directly — the canvas becomes tainted and
	 * convertToBlob() / toDataURL() will throw a SecurityError.
	 */
	private async fetchAsBlobImage(): Promise<HTMLImageElement | null> {
		try {
			const response = await fetch(this.iconUrl);
			if (!response.ok) {
				console.error(`[StickerNode] Failed to fetch sticker SVG: ${response.status} ${response.statusText}`);
				return null;
			}
			const svgBlob = await response.blob();
			const blobUrl = URL.createObjectURL(svgBlob);

			return await new Promise<HTMLImageElement>((resolve, reject) => {
				const img = new Image();
				img.onload = () => {
					URL.revokeObjectURL(blobUrl);
					resolve(img);
				};
				img.onerror = () => {
					URL.revokeObjectURL(blobUrl);
					reject(new Error(`Failed to load sticker blob image: ${this.params.iconName}`));
				};
				img.src = blobUrl;
			});
		} catch (err) {
			console.error(`[StickerNode] fetchAsBlobImage failed for ${this.params.iconName}:`, err);
			return null;
		}
	}
}
