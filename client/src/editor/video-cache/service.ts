import {
	Input,
	ALL_FORMATS,
	BlobSource,
	CanvasSink,
	type WrappedCanvas,
} from "mediabunny";
import { getPreviewDecodeSinkSize } from "../lib/preview-decode-settings";
import { previewDiag } from "../lib/preview-stall-diagnostics";

/** Decodes slower than this indicate a stall a viewer can see at 30 fps. */
const SLOW_DECODE_WARN_MS = 40;

interface VideoSinkData {
	input: Input;
	sink: CanvasSink;
	iterator: AsyncGenerator<WrappedCanvas, void, unknown> | null;
	currentFrame: WrappedCanvas | null;
	currentFrameStartTime: number;
	prefetchedFrames: WrappedCanvas[];
	lastTime: number;
	prefetching: boolean;
	prefetchPromise: Promise<void> | null;
}

export type StablePreviewFrame = {
	canvas: (HTMLCanvasElement | OffscreenCanvas) & { width: number; height: number };
	timestamp: number;
	duration: number;
	requestedTime: number;
};

type PreviewDecodeRequest = {
	file: File;
	time: number;
	generation: number;
	resourceVersion: number;
};

type PreviewRequestState = {
	active: boolean;
	pending: PreviewDecodeRequest | null;
};

const SEEK_PREROLL_SEC = 0.5;
const PREFETCH_QUEUE_SIZE = 3;
/**
 * Sequential decoding is efficient only while preview rendering is close to the
 * playback clock. Keep this generous — too tight forces constant seeks and the
 * decoder never keeps up.
 */
const MAX_SEQUENTIAL_CATCH_UP_SEC = 2.0;
/**
 * `currentFrame`, the queued frames, and one frame being produced can all be
 * retained simultaneously. Mediabunny reuses pooled canvas pixels round-robin,
 * so the pool must be larger than that retained set.
 */
const CANVAS_POOL_SIZE = PREFETCH_QUEUE_SIZE + 2;
/** One-frame grace at EOF avoids a black flash without masking decoder lag as frozen video. */
const EOF_HOLD_SEC = 1 / 30;
const MAX_ACTIVE_SINKS = 6;
const MAX_PREVIEW_FRAMES_PER_SINK = 3;
/**
 * Must leave headroom for a long cold-start prewarm (upcoming segment cut)
 * alongside the per-frame decode requests of clips that are already playing —
 * with only 2 slots a boundary prewarm could starve live decodes or vice versa.
 */
const MAX_CONCURRENT_PREVIEW_DECODES = 3;

/**
 * Cap used only when deciding whether a *stable preview cache* entry is a
 * legitimate match for a clock time. Must NOT be applied to live decoder
 * isFrameValid — capping that to a couple of display frames forces seeks
 * every few frames and stalls playback.
 */
const STABLE_CACHE_MAX_FRAME_HOLD_SEC = 0.5;

export function shouldDecodeSequentially({
	lastTime,
	targetTime,
}: {
	lastTime: number;
	targetTime: number;
}): boolean {
	const advance = targetTime - lastTime;
	return advance >= 0 && advance <= MAX_SEQUENTIAL_CATCH_UP_SEC;
}

export function canHoldExhaustedFrame({
	frameTimestamp,
	frameDuration,
	targetTime,
}: {
	frameTimestamp: number;
	frameDuration: number;
	targetTime: number;
}): boolean {
	if (targetTime < frameTimestamp) return false;
	return targetTime <= frameTimestamp + frameDuration + EOF_HOLD_SEC;
}

/** True when the decoded media timestamp actually covers the timeline sample. */
export function frameCoversPreviewTime({
	frameTimestamp,
	frameDuration,
	time,
	fps,
}: {
	frameTimestamp: number;
	frameDuration: number;
	time: number;
	fps: number;
}): boolean {
	const frameSec = 1 / Math.max(1, fps);
	const duration =
		Number.isFinite(frameDuration) && frameDuration > 0
			? Math.min(frameDuration, STABLE_CACHE_MAX_FRAME_HOLD_SEC)
			: frameSec;
	const grace = 0.5 * frameSec;
	return time >= frameTimestamp - grace && time < frameTimestamp + duration + grace;
}

export class VideoCache {
	private sinks = new Map<string, VideoSinkData>();
	private initPromises = new Map<string, Promise<void>>();
	private resourceVersions = new Map<string, number>();
	/** Serialize per-sink decode so overlapping scrub/playback renders cannot corrupt iterators. */
	private sinkLocks = new Map<string, Promise<void>>();
	private sinkLastUsedAt = new Map<string, number>();
	private previewFrames = new Map<string, StablePreviewFrame[]>();
	private previewRequests = new Map<string, PreviewRequestState>();
	private previewGeneration = 0;
	private activePreviewDecodes = 0;
	private previewDecodeQueue: Array<() => void> = [];

	async getFrameAt({
		sinkKey,
		file,
		time,
	}: {
		sinkKey: string;
		file: File;
		time: number;
	}): Promise<WrappedCanvas | null> {
		const startedAt = performance.now();
		const hadSink = this.sinks.has(sinkKey);
		await this.ensureSink({ sinkKey, file });
		const initMs = performance.now() - startedAt;
		this.touchSink(sinkKey);

		const sinkData = this.sinks.get(sinkKey);
		if (!sinkData) return null;

		const frame = await this.withSinkLock(sinkKey, () =>
			this.getFrameAtLocked({ sinkData, time }),
		);
		const totalMs = performance.now() - startedAt;
		if (totalMs > SLOW_DECODE_WARN_MS) {
			previewDiag("slow getFrameAt", {
				sinkKey,
				time: Number(time.toFixed(3)),
				hadSink,
				initMs: Math.round(initMs),
				totalMs: Math.round(totalMs),
				lastTime: Number(sinkData.lastTime.toFixed(3)),
				activeDecodes: this.activePreviewDecodes,
				queuedDecodes: this.previewDecodeQueue.length,
			});
		}
		return frame;
	}

	requestPreviewFrame({
		sinkKey,
		file,
		time,
	}: {
		sinkKey: string;
		file: File;
		time: number;
	}): void {
		const request: PreviewDecodeRequest = {
			file,
			time,
			generation: this.previewGeneration,
			resourceVersion: this.resourceVersions.get(sinkKey) ?? 0,
		};
		const state = this.previewRequests.get(sinkKey) ?? {
			active: false,
			pending: null,
		};
		this.previewRequests.set(sinkKey, state);
		if (state.active) {
			// Keep only the newest target for this decoder. Allowing every missed
			// playback frame to queue made the incoming clip decode stale work for
			// up to a second after the transition had already finished.
			state.pending = request;
			return;
		}
		this.startPreviewRequest(sinkKey, state, request);
	}

	async preparePreviewFrame({
		sinkKey,
		file,
		time,
	}: {
		sinkKey: string;
		file: File;
		time: number;
	}): Promise<boolean> {
		const generation = this.previewGeneration;
		const resourceVersion = this.resourceVersions.get(sinkKey) ?? 0;
		const frame = await this.withPreviewDecodeSlot(() =>
			this.getFrameAt({ sinkKey, file, time }),
		);
		if (
			!frame ||
			generation !== this.previewGeneration ||
			resourceVersion !== (this.resourceVersions.get(sinkKey) ?? 0)
		) {
			return false;
		}
		return this.storeStablePreviewFrame({ sinkKey, frame, requestedTime: time });
	}

	private startPreviewRequest(
		sinkKey: string,
		state: PreviewRequestState,
		request: PreviewDecodeRequest,
	): void {
		state.active = true;
		void this.withPreviewDecodeSlot(async () => {
			if (request.generation !== this.previewGeneration) return null;
			return this.getFrameAt({
				sinkKey,
				file: request.file,
				time: request.time,
			});
		})
			.then((frame) => {
				if (
					!frame ||
					request.generation !== this.previewGeneration ||
					request.resourceVersion !==
						(this.resourceVersions.get(sinkKey) ?? 0)
				) {
					// A discarded result here means prewarmed work was thrown away
					// (seek/clear raced the decode) — the boundary will cold-stall.
					previewDiag("preview frame discarded", {
						sinkKey,
						time: Number(request.time.toFixed(3)),
						decoded: !!frame,
						staleGeneration: request.generation !== this.previewGeneration,
						staleResource:
							request.resourceVersion !== (this.resourceVersions.get(sinkKey) ?? 0),
					});
					return;
				}
				this.storeStablePreviewFrame({
					sinkKey,
					frame,
					requestedTime: request.time,
				});
			})
			.catch(() => {
				// Exact preview/export paths still surface decoder failures.
			})
			.finally(() => {
				state.active = false;
				if (this.previewRequests.get(sinkKey) !== state) return;
				const pending = state.pending;
				state.pending = null;
				if (pending && pending.generation === this.previewGeneration) {
					this.startPreviewRequest(sinkKey, state, pending);
				} else {
					this.previewRequests.delete(sinkKey);
				}
			});
	}

	private async withPreviewDecodeSlot<T>(task: () => Promise<T>): Promise<T> {
		if (this.activePreviewDecodes >= MAX_CONCURRENT_PREVIEW_DECODES) {
			await new Promise<void>((resolve) => {
				this.previewDecodeQueue.push(resolve);
			});
		}
		this.activePreviewDecodes += 1;
		try {
			return await task();
		} finally {
			this.activePreviewDecodes -= 1;
			this.previewDecodeQueue.shift()?.();
		}
	}

	peekPreviewFrame({
		sinkKey,
		time,
		fps,
	}: {
		sinkKey: string;
		time: number;
		fps: number;
	}): StablePreviewFrame | null {
		const frames = this.previewFrames.get(sinkKey);
		if (!frames?.length) return null;
		let best: StablePreviewFrame | null = null;
		let bestDistance = Number.POSITIVE_INFINITY;
		for (const frame of frames) {
			// Match on the decoded media timestamp, never on the request label.
			// Labelling a cold first-frame by a later requestedTime was painting
			// identical pixels for every clock tick at segment starts.
			if (
				!frameCoversPreviewTime({
					frameTimestamp: frame.timestamp,
					frameDuration: frame.duration,
					time,
					fps,
				})
			) {
				continue;
			}
			const distance = Math.abs(time - frame.timestamp);
			if (distance < bestDistance) {
				best = frame;
				bestDistance = distance;
			}
		}
		if (best) this.touchSink(sinkKey);
		return best;
	}

	cancelPreviewRequests(): void {
		const droppedFrames = [...this.previewFrames.values()].reduce(
			(total, frames) => total + frames.length,
			0,
		);
		if (droppedFrames > 0 || this.previewRequests.size > 0) {
			previewDiag("cancelPreviewRequests", {
				droppedStableFrames: droppedFrames,
				droppedRequests: this.previewRequests.size,
			});
		}
		this.previewGeneration += 1;
		this.previewFrames.clear();
		this.previewRequests.clear();
	}

	private storeStablePreviewFrame({
		sinkKey,
		frame,
		requestedTime,
	}: {
		sinkKey: string;
		frame: WrappedCanvas;
		requestedTime: number;
	}): boolean {
		// Refuse to cache a frame under a clock time it does not actually cover.
		// Cold starts often return the first decodable frame for several request
		// times; storing those as "ready" freezes that first frame on screen.
		if (
			!frameCoversPreviewTime({
				frameTimestamp: frame.timestamp,
				frameDuration: frame.duration,
				time: requestedTime,
				fps: 30,
			})
		) {
			previewDiag("rejected mislabeled preview frame", {
				sinkKey,
				requestedTime: Number(requestedTime.toFixed(3)),
				frameTimestamp: Number(frame.timestamp.toFixed(3)),
				frameDuration: Number(frame.duration.toFixed(3)),
			});
			return false;
		}

		const width = Math.max(1, frame.canvas.width);
		const height = Math.max(1, frame.canvas.height);
		let canvas: HTMLCanvasElement | OffscreenCanvas;
		try {
			canvas = new OffscreenCanvas(width, height);
		} catch {
			canvas = document.createElement("canvas");
			canvas.width = width;
			canvas.height = height;
		}
		const context = canvas.getContext("2d");
		if (!context) return false;
		context.drawImage(frame.canvas, 0, 0, width, height);

		const frames = this.previewFrames.get(sinkKey) ?? [];
		const duplicate = frames.findIndex(
			(item) => Math.abs(item.timestamp - frame.timestamp) < 1 / 1000,
		);
		const stable = {
			canvas,
			timestamp: frame.timestamp,
			duration: frame.duration,
			requestedTime,
		} satisfies StablePreviewFrame;
		if (duplicate >= 0) frames.splice(duplicate, 1, stable);
		else frames.push(stable);
		frames.sort((a, b) => a.timestamp - b.timestamp);
		while (frames.length > MAX_PREVIEW_FRAMES_PER_SINK) frames.shift();
		this.previewFrames.set(sinkKey, frames);
		this.touchSink(sinkKey);
		return true;
	}

	private touchSink(sinkKey: string): void {
		this.sinkLastUsedAt.set(sinkKey, performance.now());
		this.evictInactiveSinks(sinkKey);
	}

	private evictInactiveSinks(excludeSinkKey: string): void {
		if (this.sinks.size <= MAX_ACTIVE_SINKS) return;
		const candidate = [...this.sinks.keys()]
			.filter(
				(key) =>
					key !== excludeSinkKey &&
					!this.sinkLocks.has(key) &&
					!this.initPromises.has(key),
			)
			.sort(
				(a, b) =>
					(this.sinkLastUsedAt.get(a) ?? 0) -
					(this.sinkLastUsedAt.get(b) ?? 0),
			)[0];
		if (candidate) this.clearVideo({ sinkKey: candidate });
	}

	private async withSinkLock<T>(
		sinkKey: string,
		fn: () => Promise<T>,
	): Promise<T> {
		const previous = this.sinkLocks.get(sinkKey) ?? Promise.resolve();
		let release!: () => void;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const next = previous.then(() => gate);
		this.sinkLocks.set(sinkKey, next);
		await previous;
		try {
			return await fn();
		} finally {
			release();
			if (this.sinkLocks.get(sinkKey) === next) {
				this.sinkLocks.delete(sinkKey);
			}
		}
	}

	private async getFrameAtLocked({
		sinkData,
		time,
	}: {
		sinkData: VideoSinkData;
		time: number;
	}): Promise<WrappedCanvas | null> {
		while (
			sinkData.prefetchedFrames.length > 0 &&
			sinkData.prefetchedFrames[0].timestamp <= time
		) {
			const nextFrame = sinkData.prefetchedFrames.shift()!;
			sinkData.currentFrame = nextFrame;
			sinkData.currentFrameStartTime = nextFrame.timestamp;
		}

		if (
			sinkData.currentFrame &&
			this.isFrameValid({
				frame: sinkData.currentFrame,
				frameStartTime: sinkData.currentFrameStartTime,
				time,
			})
		) {
			this.startPrefetch({ sinkData });
			return sinkData.currentFrame;
		}

		// Decoder exhausted at EOF — hold the last frame only while `time` is still near it.
		// Do NOT reuse arbitrary cached frames when `time` has jumped forward after a scrub.
		const exhaustedFrame = sinkData.currentFrame;
		if (
			exhaustedFrame &&
			!sinkData.iterator &&
			this.isExhaustedStreamHold({ frame: exhaustedFrame, time })
		) {
			return exhaustedFrame;
		}

		if (
			sinkData.iterator &&
			sinkData.currentFrame &&
			shouldDecodeSequentially({
				lastTime: sinkData.lastTime,
				targetTime: time,
			})
		) {
			const frame = await this.iterateToTime({ sinkData, targetTime: time });
			if (frame) {
				this.startPrefetch({ sinkData });
				return frame;
			}
		}

		const frame = await this.seekToTime({ sinkData, time });
		if (frame) {
			this.startPrefetch({ sinkData });
		}
		return frame;
	}

	private isFrameValid({
		frame,
		frameStartTime,
		time,
	}: {
		frame: WrappedCanvas;
		frameStartTime: number;
		time: number;
	}): boolean {
		return time >= frameStartTime && time < frame.timestamp + frame.duration;
	}

	/** True when the decoder has no more frames and `time` is still at/near the last one. */
	private isExhaustedStreamHold({
		frame,
		time,
	}: {
		frame: WrappedCanvas;
		time: number;
	}): boolean {
		return canHoldExhaustedFrame({
			frameTimestamp: frame.timestamp,
			frameDuration: frame.duration,
			targetTime: time,
		});
	}

	private async iterateToTime({
		sinkData,
		targetTime,
	}: {
		sinkData: VideoSinkData;
		targetTime: number;
	}): Promise<WrappedCanvas | null> {
		if (!sinkData.iterator) return null;

		try {
			while (true) {
				// Wait for any pending prefetch to finish before touching iterator
				if (sinkData.prefetching && sinkData.prefetchPromise) {
					await sinkData.prefetchPromise;
				}

				if (!sinkData.iterator) break;

				// Check if the nextFrame (which might have just arrived) is what we need
				if (
					sinkData.prefetchedFrames.length > 0 &&
					sinkData.prefetchedFrames[0].timestamp <= targetTime + 0.05
				) {
					const prefetchedFrame = sinkData.prefetchedFrames.shift()!;
					sinkData.currentFrame = prefetchedFrame;
					sinkData.currentFrameStartTime = prefetchedFrame.timestamp;
				} else {
					const iterator = sinkData.iterator;
					if (!iterator) break;
					const { value: frame, done } = await iterator.next();

					if (done || !frame) {
						sinkData.iterator = null;
						break;
					}

					sinkData.currentFrame = frame;
					sinkData.currentFrameStartTime = frame.timestamp;
				}

				const frame = sinkData.currentFrame;
				if (!frame) break;

				sinkData.lastTime = frame.timestamp;

				if (this.isFrameValid({
					frame,
					frameStartTime: sinkData.currentFrameStartTime,
					time: targetTime,
				})) {
					return frame;
				}

				if (frame.timestamp > targetTime + 1.0) break;
			}
		} catch (error) {
			console.warn("Iterator failed, will restart:", error);
			sinkData.iterator = null;
		}

		return null;
	}
	private async seekToTime({
		sinkData,
		time,
	}: {
		sinkData: VideoSinkData;
		time: number;
	}): Promise<WrappedCanvas | null> {
		try {
			const previousFrame: WrappedCanvas | null = sinkData.currentFrame;
			const previousFrameTimestamp = previousFrame?.timestamp ?? null;
			if (sinkData.prefetching && sinkData.prefetchPromise) {
				await sinkData.prefetchPromise;
			}

			if (sinkData.iterator) {
				await sinkData.iterator.return();
				sinkData.iterator = null;
			}

			sinkData.prefetchedFrames = [];
			// Decode from a small preroll window before the requested time. Seeking exactly
			// to `time` can make the first decodable frame land *after* the target (GOP/keyframe
			// boundaries), and the old code would smear that future frame backward to `time`.
			// Around a split clip transition, that collapses outgoing/incoming sides onto the
			// same decoded frame, making composited transitions look like no-op.
			const seekStart = Math.max(0, time - SEEK_PREROLL_SEC);
			sinkData.iterator = sinkData.sink.canvases(seekStart);
			sinkData.lastTime = seekStart;
			sinkData.currentFrame = null;
			sinkData.currentFrameStartTime = 0;

			const frame = await this.iterateToTime({ sinkData, targetTime: time });
			if (frame) {
				return frame;
			}

			const exhaustedFrame: WrappedCanvas | null = sinkData.currentFrame;
			if (
				exhaustedFrame &&
				!sinkData.iterator &&
				this.isExhaustedStreamHold({ frame: exhaustedFrame, time })
			) {
				return exhaustedFrame;
			}

			if (
				previousFrame &&
				previousFrameTimestamp != null &&
				this.isFrameValid({
					frame: previousFrame,
					frameStartTime: previousFrameTimestamp,
					time,
				})
			) {
				sinkData.currentFrame = previousFrame;
				sinkData.currentFrameStartTime = previousFrameTimestamp;
				return previousFrame;
			}

			// Intentionally no "smear first frame backward to t=0" fallback.
			// That made isFrameValid keep returning the same first frame for later
			// clock times, freezing the start of every segment while audio ran.
		} catch (error) {
			console.warn("Failed to seek video:", error);
		}

		return null;
	}

	private startPrefetch({ sinkData }: { sinkData: VideoSinkData }): void {
		if (
			sinkData.prefetching ||
			!sinkData.iterator ||
			sinkData.prefetchedFrames.length >= PREFETCH_QUEUE_SIZE
		) {
			return;
		}

		sinkData.prefetching = true;
		sinkData.prefetchPromise = this.prefetchNextFrames({ sinkData });
	}

	private queuePrefetchTopUp({ sinkData }: { sinkData: VideoSinkData }): void {
		queueMicrotask(() => {
			if (
				sinkData.prefetching ||
				!sinkData.iterator ||
				sinkData.prefetchedFrames.length >= PREFETCH_QUEUE_SIZE
			) {
				return;
			}

			this.startPrefetch({ sinkData });
		});
	}

	private async prefetchNextFrames({
		sinkData,
	}: {
		sinkData: VideoSinkData;
	}): Promise<void> {
		if (!sinkData.iterator) {
			sinkData.prefetching = false;
			sinkData.prefetchPromise = null;
			return;
		}

		try {
			if (
				sinkData.iterator &&
				sinkData.prefetchedFrames.length < PREFETCH_QUEUE_SIZE
			) {
				const { value: frame, done } = await sinkData.iterator.next();

				if (done) {
					sinkData.iterator = null;
				} else if (frame) {
					sinkData.prefetchedFrames.push(frame);
				}
			}

			sinkData.prefetching = false;
			sinkData.prefetchPromise = null;
			if (
				sinkData.iterator &&
				sinkData.prefetchedFrames.length < PREFETCH_QUEUE_SIZE
			) {
				this.queuePrefetchTopUp({ sinkData });
			}
		} catch (error) {
			console.warn("Prefetch failed:", error);
			sinkData.prefetching = false;
			sinkData.prefetchPromise = null;
			sinkData.iterator = null;
		}
	}
	private async ensureSink({
		sinkKey,
		file,
	}: {
		sinkKey: string;
		file: File;
	}): Promise<void> {
		if (this.sinks.has(sinkKey)) return;

		if (this.initPromises.has(sinkKey)) {
			await this.initPromises.get(sinkKey);
			return;
		}

		const version = this.resourceVersions.get(sinkKey) ?? 0;
		const initPromise = this.initializeSink({ sinkKey, file, version });
		this.initPromises.set(sinkKey, initPromise);

		try {
			await initPromise;
		} finally {
			if (this.initPromises.get(sinkKey) === initPromise) {
				this.initPromises.delete(sinkKey);
			}
		}
	}
	private async initializeSink({
		sinkKey,
		file,
		version,
	}: {
		sinkKey: string;
		file: File;
		version: number;
	}): Promise<void> {
		let input: Input | null = null;
		try {
			input = new Input({
				source: new BlobSource(file),
				formats: ALL_FORMATS,
			});

			const videoTrack = await input.getPrimaryVideoTrack();
			if (!videoTrack) {
				throw new Error("No video track found");
			}

			const canDecode = await videoTrack.canDecode();
			if (!canDecode) {
				throw new Error("Video codec not supported for decoding");
			}

			const { width, height } = getPreviewDecodeSinkSize();
			const sink = new CanvasSink(videoTrack, {
				poolSize: CANVAS_POOL_SIZE,
				fit: "contain",
				width,
				height,
			});

			if ((this.resourceVersions.get(sinkKey) ?? 0) !== version) {
				input.dispose();
				return;
			}
			this.sinks.set(sinkKey, {
				input,
				sink,
				iterator: null,
				currentFrame: null,
				currentFrameStartTime: 0,
				prefetchedFrames: [],
				lastTime: -1,
				prefetching: false,
				prefetchPromise: null,
			});
		} catch (error) {
			input?.dispose();
			console.error(`Failed to initialize video sink for ${sinkKey}:`, error);
			throw error;
		}
	}

	clearVideo({ sinkKey }: { sinkKey: string }): void {
		if (this.sinks.has(sinkKey)) {
			previewDiag("clearVideo (decoder destroyed)", { sinkKey });
		}
		this.resourceVersions.set(
			sinkKey,
			(this.resourceVersions.get(sinkKey) ?? 0) + 1,
		);
		const sinkData = this.sinks.get(sinkKey);
		if (sinkData) {
			if (sinkData.iterator) {
				void sinkData.iterator.return();
			}

			sinkData.input.dispose();
			this.sinks.delete(sinkKey);
		}

		this.initPromises.delete(sinkKey);
		this.sinkLastUsedAt.delete(sinkKey);
		this.previewFrames.delete(sinkKey);
		this.previewRequests.delete(sinkKey);
	}

	clearAll(): void {
		if (this.sinks.size > 0 || this.initPromises.size > 0) {
			previewDiag("clearAll (all decoders destroyed)", {
				sinks: this.sinks.size,
				initializing: this.initPromises.size,
			});
		}
		this.cancelPreviewRequests();
		const sinkKeys = new Set([
			...this.sinks.keys(),
			...this.initPromises.keys(),
		]);
		for (const sinkKey of sinkKeys) {
			this.clearVideo({ sinkKey });
		}
	}

	getStats() {
		return {
			totalSinks: this.sinks.size,
			activeSinks: Array.from(this.sinks.values()).filter((s) => s.iterator)
				.length,
			cachedFrames: Array.from(this.sinks.values()).filter(
				(s) => s.currentFrame,
			).length,
			previewFrames: [...this.previewFrames.values()].reduce(
				(total, frames) => total + frames.length,
				0,
			),
			pendingPreviewRequests: [...this.previewRequests.values()].reduce(
				(total, state) =>
					total + Number(state.active) + Number(state.pending !== null),
				0,
			),
		};
	}
}

export const videoCache = new VideoCache();
