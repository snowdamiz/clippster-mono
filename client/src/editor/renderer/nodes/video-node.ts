import type { CanvasRenderer } from "../canvas-renderer";
import { BaseNode } from "./base-node";
import { videoCache, type StablePreviewFrame } from "../../video-cache/service";
import type { Transform, FlipState, ColorAdjustments, CropRect, ColorCurves, ColorWheels, BlendMode, MaskShape, MediaFitMode } from "../../types/timeline";
import type { VideoEffect } from "../../types/effects";
import type { ElementKeyframes } from "../../types/keyframes";
import { evaluateKeyframeTrack, getKeyframedValue } from "../../types/keyframes";
import { buildFilterString, hasPostDrawEffects, applyCanvasEffects, applyAdvancedColorAdjustments, applyColorCurves, applyColorWheels } from "../effects/canvas-effects";
import { applyChromakey } from "../effects/canvas-chromakey";
import type { ChromakeySettings } from "../../types/chromakey";
import type { ElementAnimation } from "../../types/animations";
import type { ManualSourceFramingPayload } from "@/types";
import { computeAnimationTransforms, applyAnimationToContext } from "../effects/canvas-animations";
import { hasMasks, setupMaskClip } from "./mask-compositor";
import { drawCanvas169SourceFraming } from "../canvas-169-framing-draw";
import { getElementSourceOutPoint } from "../../lib/timeline/trim-source-utils";

const VIDEO_EPSILON = 1 / 1000;
/**
 * Lead time to kick off an upcoming cold decoder. Realtime composition never
 * waits on that decode — it must finish before the playhead arrives.
 */
const SEGMENT_PREWARM_LEAD_SEC = 2.5;

export function canReuseLastDecodedFrame({
	frameTimestamp,
	frameDuration,
	requestedTime,
	fps,
}: {
	frameTimestamp: number;
	frameDuration: number;
	requestedTime: number;
	fps: number;
}): boolean {
	if (requestedTime < frameTimestamp) return false;
	const frameSec = 1 / Math.max(1, fps);
	// Cap hold to two display frames. Trusting a large decoder-reported duration
	// freezes the first frame of every segment while audio keeps playing.
	const hold = Math.min(
		Number.isFinite(frameDuration) && frameDuration > 0 ? frameDuration : frameSec,
		2 * frameSec,
	);
	return requestedTime <= frameTimestamp + hold;
}

export interface VideoNodeParams {
	url: string;
	file: File;
	mediaId: string;
	elementId: string;
	decodeKey?: string;
	/** Start this decoder before the timeline reaches a non-continuous cut. */
	prewarmBeforeStart?: boolean;
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
	/** Main-track Use 16:9 framing when canvas aspect is not 16:9. */
	canvasSourceFraming?: ManualSourceFramingPayload | null;
	mediaFit?: MediaFitMode;
}

type RenderableVideoFrame =
	| import("mediabunny").WrappedCanvas
	| StablePreviewFrame;

export class VideoNode extends BaseNode<VideoNodeParams> {
	private prefetchedFrame: RenderableVideoFrame | null = null;
	private prefetchedFrameTime: number | null = null;
	private lastGoodFrame: RenderableVideoFrame | null = null;
	private transitionExtension: { before: number; after: number } = { before: 0, after: 0 };
	private chromakeyCanvas?: HTMLCanvasElement;
	private chromakeyCtx?: CanvasRenderingContext2D | null;

	private getDecodeKey() {
		return this.params.decodeKey ?? this.params.elementId;
	}

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
			const sampleSpeed = Math.max(0.1, Math.min(10, evaluateKeyframeTrack(speedTrack, normalizedTime, this.params.speed ?? 1)));
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
		// Derive source out-point from visible timeline duration. Persisted `trimEnd` is tail
		// trim (unused source after the clip) and must not be used as an absolute decode cap.
		const trimEnd = getElementSourceOutPoint({
			trimStart: this.params.trimStart,
			duration: this.params.duration,
			speed: this.params.speed,
		});

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

		// Incoming transition pre-roll starts at the clip's source in-point and
		// advances continuously through the overlap. Without this offset, clips
		// trimmed at source time 0 clamp to their first frame for the entire
		// pre-junction half of the transition.
		const sourceElapsed = Math.max(0, elapsed + this.transitionExtension.before);
		const sourceOffset = this.getIntegratedSourceOffset(sourceElapsed);

		return Math.max(
			Math.max(0, this.params.trimStart),
			Math.min(trimEnd + beforeSource + afterSource, this.params.trimStart + sourceOffset),
		);
	}

	private requestRealtimeFrames(sinkKey: string, times: number[]) {
		for (const time of times) {
			videoCache.requestPreviewFrame({
				sinkKey,
				file: this.params.file,
				time,
			});
		}
	}

	/**
	 * Block until the first realtime frames for this clip are in the stable
	 * preview cache. Used only before play / while paused — never from the
	 * realtime composition path (that path must stay non-blocking).
	 */
	async prepareRealtimeEntry({
		renderer,
		time,
	}: {
		renderer: CanvasRenderer;
		time: number;
	}): Promise<void> {
		const fps = Math.max(1, renderer.fps);
		const sinkKey = this.getDecodeKey();
		const targets: number[] = [];

		if (this.isInRange(time)) {
			targets.push(this.getSourceTime(time));
			const next = time + 1 / fps;
			if (this.isInRange(next)) targets.push(this.getSourceTime(next));
		} else if (
			this.params.prewarmBeforeStart &&
			time < this.params.timeOffset &&
			time >= this.params.timeOffset - SEGMENT_PREWARM_LEAD_SEC
		) {
			targets.push(this.getSourceTime(this.params.timeOffset));
			targets.push(this.getSourceTime(this.params.timeOffset + 1 / fps));
		}

		for (const videoTime of targets) {
			if (
				videoCache.peekPreviewFrame({
					sinkKey,
					time: videoTime,
					fps,
				})
			) {
				continue;
			}
			await videoCache.preparePreviewFrame({
				sinkKey,
				file: this.params.file,
				time: videoTime,
			});
		}
	}

	async prefetch({ renderer, time }: { renderer: CanvasRenderer; time: number }) {
		const isRealtime = renderer.framePolicy === "realtime";
		const fps = Math.max(1, renderer.fps);
		const sinkKey = this.getDecodeKey();

		if (
			(isRealtime || renderer.prewarmUpcoming) &&
			this.params.prewarmBeforeStart &&
			time < this.params.timeOffset &&
			time >= this.params.timeOffset - SEGMENT_PREWARM_LEAD_SEC
		) {
			const startTimes = [
				this.getSourceTime(this.params.timeOffset),
				this.getSourceTime(this.params.timeOffset + 1 / fps),
			];
			if (isRealtime) {
				if (
					!videoCache.peekPreviewFrame({
						sinkKey,
						time: startTimes[0]!,
						fps,
					})
				) {
					this.requestRealtimeFrames(sinkKey, startTimes);
				}
				return;
			}
			// While paused/scrubbing, fully prepare the stable cache so pressing
			// play at a cut does not start cold.
			void this.prepareRealtimeEntry({ renderer, time });
		}
		if (!this.isInRange(time)) return;

		const videoTime = this.getSourceTime(time);
		if (isRealtime) {
			// Live playback: one sequential getFrameAt on this sink. Do NOT also
			// fire requestPreviewFrame for the same sink — that races the sink
			// lock / decode slots and stalls the decoder after a few seconds.
			this.prefetchedFrame = await videoCache.getFrameAt({
				sinkKey,
				file: this.params.file,
				time: videoTime,
			});
			this.prefetchedFrameTime = this.prefetchedFrame ? videoTime : null;
			return;
		}

		this.prefetchedFrame = await videoCache.getFrameAt({
			sinkKey,
			file: this.params.file,
			time: videoTime,
		});
		this.prefetchedFrameTime = videoTime;
	}

	async prewarm({ renderer, time }: { renderer: CanvasRenderer; time: number }) {
		if (!this.isInRange(time)) return;
		if (renderer.framePolicy !== "realtime") {
			await this.prefetch({ renderer, time });
			return;
		}
		const videoTime = this.getSourceTime(time);
		await videoCache.preparePreviewFrame({
			sinkKey: this.getDecodeKey(),
			file: this.params.file,
			time: videoTime,
		});
	}

	async render({ renderer, time }: { renderer: CanvasRenderer; time: number }) {
		await super.render({ renderer, time });

		if (!this.isInRange(time)) {
			return;
		}

		const videoTime = this.getSourceTime(time);
		const prefetched =
			this.prefetchedFrameTime !== null &&
			Math.abs(this.prefetchedFrameTime - videoTime) < 0.05
				? this.prefetchedFrame
				: null;
		this.prefetchedFrame = null;
		this.prefetchedFrameTime = null;
		let frame: RenderableVideoFrame | null =
			prefetched ??
			(await videoCache.getFrameAt({
				sinkKey: this.getDecodeKey(),
				file: this.params.file,
				time: videoTime,
			}));
		if (
			!frame &&
			this.lastGoodFrame &&
			canReuseLastDecodedFrame({
				frameTimestamp: this.lastGoodFrame.timestamp,
				frameDuration: this.lastGoodFrame.duration,
				requestedTime: videoTime,
				fps: renderer.fps,
			})
		) {
			frame = this.lastGoodFrame;
		}
		if (frame) {
			this.lastGoodFrame = frame;
		}

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
			if (!Number.isFinite(resolvedOpacity)) resolvedOpacity = 1;

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
				const resolvedScale = getKeyframedValue({ elementKeyframes: kf, property: "scale", normalizedTime, defaultValue: transform.scale ?? 1 });
				const resolvedPosX = getKeyframedValue({ elementKeyframes: kf, property: "positionX", normalizedTime, defaultValue: transform.position.x });
				const resolvedPosY = getKeyframedValue({ elementKeyframes: kf, property: "positionY", normalizedTime, defaultValue: transform.position.y });
				const resolvedRotation = getKeyframedValue({ elementKeyframes: kf, property: "rotation", normalizedTime, defaultValue: transform.rotate });
				const centerX = renderer.width / 2 + resolvedPosX;
				const centerY = renderer.height / 2 + resolvedPosY;
				renderer.context.translate(centerX, centerY);
				if (resolvedRotation !== 0) {
					renderer.context.rotate((resolvedRotation * Math.PI) / 180);
				}
				const safeScale = Number.isFinite(resolvedScale) ? resolvedScale : 1;
				if (safeScale !== 1) {
					renderer.context.scale(safeScale, safeScale);
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
				} else if (this.params.canvasSourceFraming?.mode === "use16x9") {
					drawCanvas169SourceFraming(
						renderer.context,
						drawSource,
						mediaW,
						mediaH,
						renderer.width,
						renderer.height,
						this.params.canvasSourceFraming,
						undefined,
					);
				} else {
					const fit = this.params.mediaFit ?? "contain";
					const fitScale =
						fit === "cover"
							? Math.max(renderer.width / mediaW, renderer.height / mediaH)
							: Math.min(renderer.width / mediaW, renderer.height / mediaH);
					const drawW = mediaW * fitScale;
					const drawH = mediaH * fitScale;
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
