import type { CanvasRenderer } from "../canvas-renderer";
import { BaseNode } from "./base-node";
import type { Transform, FlipState, ColorAdjustments, CropRect, ColorCurves, ColorWheels, BlendMode, MaskShape } from "../../types/timeline";
import type { VideoEffect } from "../../types/effects";
import type { ElementKeyframes } from "../../types/keyframes";
import { getKeyframedValue } from "../../types/keyframes";
import { buildFilterString, hasPostDrawEffects, applyCanvasEffects, applyAdvancedColorAdjustments, applyColorCurves, applyColorWheels } from "../effects/canvas-effects";
import { applyChromakey } from "../effects/canvas-chromakey";
import type { ChromakeySettings } from "../../types/chromakey";
import type { ElementAnimation } from "../../types/animations";
import { computeAnimationTransforms, applyAnimationToContext } from "../effects/canvas-animations";
import { hasMasks, setupMaskClip } from "./mask-compositor";

const IMAGE_EPSILON = 1 / 1000;

export interface ImageNodeParams {
	url: string;
	duration: number;
	timeOffset: number;
	trimStart: number;
	trimEnd: number;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	opacity?: number;
	transform?: Transform;
	flip?: FlipState;
	crop?: CropRect;
	colorAdjustments?: ColorAdjustments;
	fadeIn?: number;
	fadeOut?: number;
	keyframes?: ElementKeyframes;
	effects?: VideoEffect[];
	chromakey?: ChromakeySettings;
	animationIn?: ElementAnimation;
	animationOut?: ElementAnimation;
	animationLoop?: ElementAnimation;
	colorCurves?: ColorCurves;
	colorWheels?: ColorWheels;
	blendMode?: BlendMode;
	masks?: MaskShape[];
}

export class ImageNode extends BaseNode<ImageNodeParams> {
	private image?: HTMLImageElement;
	private readyPromise: Promise<void>;
	private transitionExtension: { before: number; after: number } = { before: 0, after: 0 };

	constructor(params: ImageNodeParams) {
		super(params);
		this.readyPromise = this.load();
	}

	setTransitionExtension(extension: { before?: number; after?: number }) {
		this.transitionExtension = {
			before: Math.max(this.transitionExtension.before, extension.before ?? 0),
			after: Math.max(this.transitionExtension.after, extension.after ?? 0),
		};
	}

	private async load() {
		const image = new Image();
		this.image = image;

		await new Promise<void>((resolve, reject) => {
			image.onload = () => resolve();
			image.onerror = () => reject(new Error("Image load failed"));
			image.src = this.params.url;
		});
	}

	private getClampedElapsed(time: number) {
		const elapsed = time - this.params.timeOffset;
		return Math.max(0, Math.min(this.params.duration, elapsed));
	}

	private isInRange(time: number) {
		const elapsed = time - this.params.timeOffset;
		return (
			elapsed >= -(this.transitionExtension.before + IMAGE_EPSILON) &&
			elapsed < this.params.duration + this.transitionExtension.after
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

		renderer.context.save();

		// Apply blend mode (composite operation)
		if (this.params.blendMode && this.params.blendMode !== "normal") {
			renderer.context.globalCompositeOperation = this.params.blendMode as GlobalCompositeOperation;
		}

		// Resolve keyframed values
		const elapsed = this.getClampedElapsed(time);
		const effectiveTime = this.params.timeOffset + elapsed;
		const normalizedTime = this.params.duration > 0 ? elapsed / this.params.duration : 0;
		const kf = this.params.keyframes;

		let resolvedOpacity = getKeyframedValue({ elementKeyframes: kf, property: "opacity", normalizedTime, defaultValue: this.params.opacity ?? 1 });

		// Apply fade in/out opacity ramp
		const fadeIn = this.params.fadeIn ?? 0;
		const fadeOut = this.params.fadeOut ?? 0;
		if (fadeIn > 0 && elapsed < fadeIn) {
			resolvedOpacity *= elapsed / fadeIn;
		}
		if (fadeOut > 0 && elapsed > this.params.duration - fadeOut) {
			resolvedOpacity *= (this.params.duration - elapsed) / fadeOut;
		}

		renderer.context.globalAlpha = resolvedOpacity;

		// Apply element animations (in/out/loop)
		const animResult = computeAnimationTransforms(
			this.params.animationIn,
			this.params.animationOut,
			this.params.animationLoop,
			{ elapsed, elementDuration: this.params.duration, canvasWidth: renderer.width, canvasHeight: renderer.height },
		);
		applyAnimationToContext(renderer.context, animResult, renderer.width / 2, renderer.height / 2);

		// Apply shape masks (clip path) before drawing
		if (hasMasks(this.params.masks)) {
			setupMaskClip(renderer.context, this.params.masks!, renderer.width, renderer.height);
		}

		// Apply transform (scale, position, rotation)
		const transform = this.params.transform;
		if (transform) {
			const centerX = renderer.width / 2 + transform.position.x;
			const centerY = renderer.height / 2 + transform.position.y;
			renderer.context.translate(centerX, centerY);
			if (transform.rotate !== 0) {
				renderer.context.rotate((transform.rotate * Math.PI) / 180);
			}
			if (transform.scale !== 1) {
				renderer.context.scale(transform.scale, transform.scale);
			}
			renderer.context.translate(-renderer.width / 2, -renderer.height / 2);
		}

		// Apply flip
		const flip = this.params.flip;
		if (flip?.horizontal || flip?.vertical) {
			renderer.context.translate(renderer.width / 2, renderer.height / 2);
			renderer.context.scale(
				flip.horizontal ? -1 : 1,
				flip.vertical ? -1 : 1,
			);
			renderer.context.translate(-renderer.width / 2, -renderer.height / 2);
		}

		// Apply color adjustments via CSS filter on canvas context
		const ca = this.params.colorAdjustments;
		const filterParts: string[] = [];
		if (ca) {
			const exposureOffset = ca.exposure ? ca.exposure / 100 : 0;
			const brightnessVal = 1 + (ca.brightness ?? 0) / 100 + exposureOffset * 0.5;
			if (brightnessVal !== 1) filterParts.push(`brightness(${brightnessVal})`);
			if (ca.contrast !== 0) filterParts.push(`contrast(${1 + ca.contrast / 100})`);
			if (ca.saturation !== 0) filterParts.push(`saturate(${1 + ca.saturation / 100})`);
			if (ca.temperature !== 0) {
				filterParts.push(`hue-rotate(${ca.temperature * 0.3}deg)`);
			}
		}

		// Add filter-based effects (blur, grayscale, sepia, negative)
		const fx = this.params.effects;
		if (fx && fx.length > 0) {
			const effectFilter = buildFilterString(fx);
			if (effectFilter) filterParts.push(effectFilter);
		}

		if (filterParts.length > 0) {
			renderer.context.filter = filterParts.join(" ");
		}

		if (
			this.params.x !== undefined &&
			this.params.y !== undefined &&
			this.params.width !== undefined &&
			this.params.height !== undefined
		) {
			renderer.context.drawImage(
				this.image,
				this.params.x,
				this.params.y,
				this.params.width,
				this.params.height,
			);
		} else {
			const mediaW = this.image.naturalWidth || renderer.width;
			const mediaH = this.image.naturalHeight || renderer.height;

			// Apply crop: extract sub-rectangle from source image
			const crop = this.params.crop;
			const hasCrop = crop && (crop.top > 0 || crop.right > 0 || crop.bottom > 0 || crop.left > 0);

			if (hasCrop) {
				const sx = crop.left * mediaW;
				const sy = crop.top * mediaH;
				const sw = mediaW * (1 - crop.left - crop.right);
				const sh = mediaH * (1 - crop.top - crop.bottom);

				const containScale = Math.min(renderer.width / sw, renderer.height / sh);
				const drawW = sw * containScale;
				const drawH = sh * containScale;
				const drawX = (renderer.width - drawW) / 2;
				const drawY = (renderer.height - drawH) / 2;

				renderer.context.drawImage(
					this.image,
					sx, sy, sw, sh,
					drawX, drawY, drawW, drawH,
				);
			} else {
				const containScale = Math.min(
					renderer.width / mediaW,
					renderer.height / mediaH,
				);
				const drawW = mediaW * containScale;
				const drawH = mediaH * containScale;
				const drawX = (renderer.width - drawW) / 2;
				const drawY = (renderer.height - drawH) / 2;

				renderer.context.drawImage(this.image, drawX, drawY, drawW, drawH);
			}
		}

		renderer.context.filter = "none";

		// Apply post-draw effects (pixelate, sharpen, vignette, colorShift, glitch, wave, zoomPulse, flash)
		if (fx && fx.length > 0 && hasPostDrawEffects(fx)) {
			renderer.context.restore();
			applyCanvasEffects(renderer.context, renderer.width, renderer.height, fx, effectiveTime, this.params.timeOffset);
		} else {
			renderer.context.restore();
		}

		// Apply advanced color adjustments that require post-draw compositing
		if (ca) {
			applyAdvancedColorAdjustments(renderer.context, renderer.width, renderer.height, ca);
		}

		// Apply chromakey (green screen removal)
		if (this.params.chromakey?.enabled) {
			applyChromakey(renderer.context, renderer.width, renderer.height, this.params.chromakey);
		}

		// Apply color grading: curves then wheels
		if (this.params.colorCurves) {
			applyColorCurves(renderer.context, renderer.width, renderer.height, this.params.colorCurves);
		}
		if (this.params.colorWheels) {
			applyColorWheels(renderer.context, renderer.width, renderer.height, this.params.colorWheels);
		}
	}
}
