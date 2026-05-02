import type { CanvasRenderer } from "../canvas-renderer";
import { BaseNode } from "./base-node";
import { videoCache } from "../../video-cache/service";
import type { Transform, FlipState, ColorAdjustments, CropRect, ColorCurves, ColorWheels, BlendMode, MaskShape } from "../../types/timeline";
import type { VideoEffect } from "../../types/effects";
import type { ElementKeyframes } from "../../types/keyframes";
import { evaluateKeyframeTrack, getKeyframedValue } from "../../types/keyframes";
import { buildFilterString, hasPostDrawEffects, applyCanvasEffects, applyAdvancedColorAdjustments, applyColorCurves, applyColorWheels } from "../effects/canvas-effects";
import { applyChromakey } from "../effects/canvas-chromakey";
import type { ChromakeySettings } from "../../types/chromakey";
import type { ElementAnimation } from "../../types/animations";
import { computeAnimationTransforms, applyAnimationToContext } from "../effects/canvas-animations";
import { hasMasks, setupMaskClip } from "./mask-compositor";

const VIDEO_EPSILON = 1 / 1000;

export interface VideoNodeParams {
	url: string;
	file: File;
	mediaId: string;
	elementId: string;
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
	speed?: number;
	reversed?: boolean;
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

export class VideoNode extends BaseNode<VideoNodeParams> {
	private prefetchedFrame: import("mediabunny").WrappedCanvas | null = null;
	private transitionExtension: { before: number; after: number } = { before: 0, after: 0 };
	private chromakeyCanvas?: HTMLCanvasElement;
	private chromakeyCtx?: CanvasRenderingContext2D | null;

	setTransitionExtension(extension: { before?: number; after?: number }) {
		this.transitionExtension = {
			before: Math.max(this.transitionExtension.before, extension.before ?? 0),
			after: Math.max(this.transitionExtension.after, extension.after ?? 0),
		};
	}

	private isInRange(time: number) {
		const elapsed = time - this.params.timeOffset;
		return (
			elapsed >= -(this.transitionExtension.before + VIDEO_EPSILON) &&
			elapsed < this.params.duration + this.transitionExtension.after
		);
	}

	private getClampedElapsed(time: number) {
		const elapsed = time - this.params.timeOffset;
		return Math.max(0, Math.min(this.params.duration, elapsed));
	}

	private getIntegratedSourceOffset(elapsed: number) {
		const speedTrack = this.params.keyframes?.tracks?.speed;
		const fallbackSpeed = Math.max(0.1, Math.min(10, this.params.speed ?? 1));

		if (!speedTrack || speedTrack.keyframes.length === 0 || elapsed <= 0) {
			return elapsed * fallbackSpeed;
		}

		const stepCount = Math.max(1, Math.min(200, Math.ceil(elapsed * 24)));
		const dt = elapsed / stepCount;
		let sourceOffset = 0;

		for (let i = 0; i < stepCount; i++) {
			const sampleElapsed = (i + 0.5) * dt;
			const normalizedTime = this.params.duration > 0 ? sampleElapsed / this.params.duration : 0;
			const sampleSpeed = Math.max(0.1, Math.min(10, evaluateKeyframeTrack(speedTrack, normalizedTime)));
			sourceOffset += sampleSpeed * dt;
		}

		return sourceOffset;
	}

	private getSourceTime(time: number) {
		// During a transition, allow elapsed to peek slightly before 0 (incoming pre-roll) or
		// past duration (outgoing post-roll). If we clamp to [0, duration] here, a split clip
		// pair renders the *exact same* source frame on both sides of the cut and pixel-blend
		// transitions (crossfade / wipe / dissolve / circle / diamond / clock wipe) look invisible.
		const rawElapsed = time - this.params.timeOffset;
		const minElapsed = -this.transitionExtension.before;
		const maxElapsed = this.params.duration + this.transitionExtension.after;
		const elapsed = Math.max(minElapsed, Math.min(maxElapsed, rawElapsed));
		const computedTrimEnd =
			this.params.trimStart + this.params.duration * (this.params.speed ?? 1);
		// `trimEnd` is often persisted as `0` when unset (e.g. bridge imports). `??` does not
		// treat `0` as missing, which would clamp every decode request to media time 0.
		const trimEnd =
			this.params.trimEnd != null && this.params.trimEnd > this.params.trimStart
				? this.params.trimEnd
				: computedTrimEnd;

		// Extend the source-time clamp window by the transition extension so the decoded frame
		// actually advances through the source during the transition instead of freezing at the
		// trim boundary.
		const speed = Math.max(0.1, Math.min(10, this.params.speed ?? 1));
		const beforeSource = this.transitionExtension.before * speed;
		const afterSource = this.transitionExtension.after * speed;

		if (this.params.reversed) {
			const sourceOffset = this.getIntegratedSourceOffset(elapsed);
			return Math.max(
				Math.max(0, this.params.trimStart - afterSource),
				Math.min(trimEnd + beforeSource, trimEnd - sourceOffset),
			);
		}

		const sourceElapsed = Math.max(0, elapsed + this.transitionExtension.before);
		const sourceOffset = this.getIntegratedSourceOffset(sourceElapsed);

		return Math.max(
			Math.max(0, this.params.trimStart),
			Math.min(trimEnd + beforeSource + afterSource, this.params.trimStart + sourceOffset),
		);
	}

	async prefetch({ renderer: _renderer, time }: { renderer: CanvasRenderer; time: number }) {
		if (!this.isInRange(time)) return;

		const videoTime = this.getSourceTime(time);
		this.prefetchedFrame = await videoCache.getFrameAt({
			sinkKey: this.params.elementId,
			file: this.params.file,
			time: videoTime,
		});
	}

	async render({ renderer, time }: { renderer: CanvasRenderer; time: number }) {
		await super.render({ renderer, time });

		if (!this.isInRange(time)) {
			return;
		}

		const prefetched = this.prefetchedFrame;
		this.prefetchedFrame = null;
		const videoTime = this.getSourceTime(time);
		const frame = prefetched ?? (await videoCache.getFrameAt({
			sinkKey: this.params.elementId,
			file: this.params.file,
			time: videoTime,
		}));

		if (frame) {
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

			// Apply transform (scale, position, rotation) with keyframe overrides
			const transform = this.params.transform;
			if (transform) {
				const resolvedScale = getKeyframedValue({ elementKeyframes: kf, property: "scale", normalizedTime, defaultValue: transform.scale });
				const resolvedPosX = getKeyframedValue({ elementKeyframes: kf, property: "positionX", normalizedTime, defaultValue: transform.position.x });
				const resolvedPosY = getKeyframedValue({ elementKeyframes: kf, property: "positionY", normalizedTime, defaultValue: transform.position.y });
				const resolvedRotation = getKeyframedValue({ elementKeyframes: kf, property: "rotation", normalizedTime, defaultValue: transform.rotate });
				const centerX = renderer.width / 2 + resolvedPosX;
				const centerY = renderer.height / 2 + resolvedPosY;
				renderer.context.translate(centerX, centerY);
				if (resolvedRotation !== 0) {
					renderer.context.rotate((resolvedRotation * Math.PI) / 180);
				}
				if (resolvedScale !== 1) {
					renderer.context.scale(resolvedScale, resolvedScale);
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
			const processingSize = renderer.getEffectProcessingSize();
			const backingSize = renderer.getBackingSize();
			const filterParts: string[] = [];
			if (ca) {
				// Exposure maps to brightness with gamma curve
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

			const chromakeySource = this.getChromakeySourceCanvas(frame.canvas, this.params.chromakey);
			const drawSource = chromakeySource ?? frame.canvas;

			if (
				this.params.x !== undefined &&
				this.params.y !== undefined &&
				this.params.width !== undefined &&
				this.params.height !== undefined
			) {
				renderer.context.drawImage(
					drawSource,
					this.params.x,
					this.params.y,
					this.params.width,
					this.params.height,
				);
			} else {
				const mediaW = drawSource.width || renderer.width;
				const mediaH = drawSource.height || renderer.height;

				// Apply crop: extract sub-rectangle from source frame
				const crop = this.params.crop;
				const hasCrop = crop && (crop.top > 0 || crop.right > 0 || crop.bottom > 0 || crop.left > 0);

				if (hasCrop) {
					// Source rectangle (pixels within the decoded frame)
					const sx = crop.left * mediaW;
					const sy = crop.top * mediaH;
					const sw = mediaW * (1 - crop.left - crop.right);
					const sh = mediaH * (1 - crop.top - crop.bottom);

					// Contain-fit the cropped region into the canvas
					const containScale = Math.min(renderer.width / sw, renderer.height / sh);
					const drawW = sw * containScale;
					const drawH = sh * containScale;
					const drawX = (renderer.width - drawW) / 2;
					const drawY = (renderer.height - drawH) / 2;

					renderer.context.drawImage(
						drawSource,
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

					renderer.context.drawImage(
						drawSource,
						drawX,
						drawY,
						drawW,
						drawH,
					);
				}
			}

			// Reset filter
			renderer.context.filter = "none";

			// Apply post-draw effects (pixelate, sharpen, vignette, colorShift, glitch, wave, zoomPulse, flash)
			if (fx && fx.length > 0 && hasPostDrawEffects(fx)) {
				renderer.context.restore();
				applyCanvasEffects(renderer.context, backingSize.width, backingSize.height, fx, effectiveTime, this.params.timeOffset, { processingSize });
			} else {
				renderer.context.restore();
			}

			if (ca) {
				applyAdvancedColorAdjustments(renderer.context, backingSize.width, backingSize.height, ca, { processingSize });
			}

			if (this.params.colorCurves) {
				applyColorCurves(renderer.context, backingSize.width, backingSize.height, this.params.colorCurves, { processingSize });
			}
			if (this.params.colorWheels) {
				applyColorWheels(renderer.context, backingSize.width, backingSize.height, this.params.colorWheels, { processingSize });
			}
		}
	}

	private getChromakeySourceCanvas(
		source: CanvasImageSource & { width: number; height: number },
		chromakey?: ChromakeySettings,
	): HTMLCanvasElement | null {
		if (!chromakey?.enabled) return null;
		const width = source.width;
		const height = source.height;
		if (width <= 0 || height <= 0) return null;

		if (!this.chromakeyCanvas || this.chromakeyCanvas.width !== width || this.chromakeyCanvas.height !== height) {
			this.chromakeyCanvas = document.createElement("canvas");
			this.chromakeyCanvas.width = width;
			this.chromakeyCanvas.height = height;
			this.chromakeyCtx = this.chromakeyCanvas.getContext("2d", { willReadFrequently: true });
		}
		if (!this.chromakeyCanvas || !this.chromakeyCtx) return null;

		this.chromakeyCtx.clearRect(0, 0, width, height);
		this.chromakeyCtx.drawImage(source, 0, 0, width, height);
		applyChromakey(this.chromakeyCtx, width, height, chromakey);
		return this.chromakeyCanvas;
	}
}
