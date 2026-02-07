import type { CanvasRenderer } from "../canvas-renderer";
import { BaseNode } from "./base-node";
import { videoCache } from "../../video-cache/service";
import type { Transform, FlipState, ColorAdjustments } from "../../types/timeline";
import type { VideoEffect } from "../../types/effects";
import type { ElementKeyframes } from "../../types/keyframes";
import { getKeyframedValue } from "../../types/keyframes";
import { buildFilterString, hasPostDrawEffects, applyCanvasEffects } from "../effects/canvas-effects";

const VIDEO_EPSILON = 1 / 1000;

export interface VideoNodeParams {
	url: string;
	file: File;
	mediaId: string;
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
	colorAdjustments?: ColorAdjustments;
	speed?: number;
	keyframes?: ElementKeyframes;
	effects?: VideoEffect[];
}

export class VideoNode extends BaseNode<VideoNodeParams> {
	private isInRange(time: number) {
		const elapsed = time - this.params.timeOffset;
		return elapsed >= -VIDEO_EPSILON && elapsed < this.params.duration;
	}

	private getSourceTime(time: number) {
		const speed = this.params.speed ?? 1;
		const elapsed = time - this.params.timeOffset;
		return this.params.trimStart + elapsed * speed;
	}

	async render({ renderer, time }: { renderer: CanvasRenderer; time: number }) {
		await super.render({ renderer, time });

		if (!this.isInRange(time)) {
			return;
		}

		const videoTime = this.getSourceTime(time);

		const frame = await videoCache.getFrameAt({
			mediaId: this.params.mediaId,
			file: this.params.file,
			time: videoTime,
		});

		if (frame) {
			renderer.context.save();

			// Resolve keyframed values
			const elapsed = time - this.params.timeOffset;
			const normalizedTime = this.params.duration > 0 ? elapsed / this.params.duration : 0;
			const kf = this.params.keyframes;

			const resolvedOpacity = getKeyframedValue({ elementKeyframes: kf, property: "opacity", normalizedTime, defaultValue: this.params.opacity ?? 1 });
			renderer.context.globalAlpha = resolvedOpacity;

			// Apply transform (scale, position, rotation) with keyframe overrides
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
				if (ca.brightness !== 0) filterParts.push(`brightness(${1 + ca.brightness / 100})`);
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
					frame.canvas,
					this.params.x,
					this.params.y,
					this.params.width,
					this.params.height,
				);
			} else {
				const mediaW = frame.canvas.width || renderer.width;
				const mediaH = frame.canvas.height || renderer.height;
				const coverScale = Math.max(
					renderer.width / mediaW,
					renderer.height / mediaH,
				);
				const drawW = mediaW * coverScale;
				const drawH = mediaH * coverScale;
				const drawX = (renderer.width - drawW) / 2;
				const drawY = (renderer.height - drawH) / 2;

				renderer.context.drawImage(
					frame.canvas,
					drawX,
					drawY,
					drawW,
					drawH,
				);
			}

			// Reset filter
			renderer.context.filter = "none";

			// Apply post-draw effects (pixelate, sharpen, vignette, colorShift, glitch, wave, zoomPulse, flash)
			if (fx && fx.length > 0 && hasPostDrawEffects(fx)) {
				renderer.context.restore();
				applyCanvasEffects(renderer.context, renderer.width, renderer.height, fx, time, this.params.timeOffset);
			} else {
				renderer.context.restore();
			}
		}
	}
}
