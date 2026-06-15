import {
	Input,
	ALL_FORMATS,
	BlobSource,
	CanvasSink,
	type WrappedCanvas,
} from "mediabunny";
import { getPreviewDecodeSinkSize } from "../lib/preview-decode-settings";

interface VideoSinkData {
	sink: CanvasSink;
	iterator: AsyncGenerator<WrappedCanvas, void, unknown> | null;
	currentFrame: WrappedCanvas | null;
	currentFrameStartTime: number;
	prefetchedFrames: WrappedCanvas[];
	lastTime: number;
	prefetching: boolean;
	prefetchPromise: Promise<void> | null;
}

const SEEK_PREROLL_SEC = 0.5;
const PREFETCH_QUEUE_SIZE = 3;
/** Hold the last decoded frame briefly past its display window when the stream is exhausted (EOF). */
const EOF_HOLD_SEC = 0.5;

export class VideoCache {
	private sinks = new Map<string, VideoSinkData>();
	private initPromises = new Map<string, Promise<void>>();
	/** Serialize per-sink decode so overlapping scrub/playback renders cannot corrupt iterators. */
	private sinkLocks = new Map<string, Promise<void>>();

	async getFrameAt({
		sinkKey,
		file,
		time,
	}: {
		sinkKey: string;
		file: File;
		time: number;
	}): Promise<WrappedCanvas | null> {
		await this.ensureSink({ sinkKey, file });

		const sinkData = this.sinks.get(sinkKey);
		if (!sinkData) return null;

		return this.withSinkLock(sinkKey, () => this.getFrameAtLocked({ sinkData, time }));
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
			time >= sinkData.lastTime &&
			time < sinkData.lastTime + 2.0
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
		if (time < frame.timestamp) return false;
		const frameEnd = frame.timestamp + frame.duration;
		return time <= frameEnd + EOF_HOLD_SEC;
	}

	/** True when a cached frame is still the correct picture for `time` (not a stale scrub artifact). */
	private isFrameReuseableForTime({
		frame,
		frameStartTime,
		time,
	}: {
		frame: WrappedCanvas;
		frameStartTime: number;
		time: number;
	}): boolean {
		return (
			this.isFrameValid({ frame, frameStartTime, time }) ||
			this.isExhaustedStreamHold({ frame, time })
		);
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
				this.isFrameReuseableForTime({
					frame: previousFrame,
					frameStartTime: previousFrameTimestamp,
					time,
				})
			) {
				sinkData.currentFrame = previousFrame;
				sinkData.currentFrameStartTime = previousFrameTimestamp;
				return previousFrame;
			}

			// Startup streams can legitimately have their first decodable frame after 0. In that
			// case preserve the previous behavior as a narrow fallback so the beginning of a clip
			// does not render black while the decoder catches up.
			if (seekStart === 0 && sinkData.currentFrame) {
				const currentFrame: WrappedCanvas = sinkData.currentFrame;
				sinkData.currentFrameStartTime = Math.min(time, currentFrame.timestamp);
				return currentFrame;
			}
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

		const initPromise = this.initializeSink({ sinkKey, file });
		this.initPromises.set(sinkKey, initPromise);

		try {
			await initPromise;
		} finally {
			this.initPromises.delete(sinkKey);
		}
	}
	private async initializeSink({
		sinkKey,
		file,
	}: {
		sinkKey: string;
		file: File;
	}): Promise<void> {
		try {
			const input = new Input({
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
				poolSize: 3,
				fit: "contain",
				width,
				height,
			});

			this.sinks.set(sinkKey, {
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
			console.error(`Failed to initialize video sink for ${sinkKey}:`, error);
			throw error;
		}
	}

	clearVideo({ sinkKey }: { sinkKey: string }): void {
		const sinkData = this.sinks.get(sinkKey);
		if (sinkData) {
			if (sinkData.iterator) {
				void sinkData.iterator.return();
			}

			this.sinks.delete(sinkKey);
		}

		this.initPromises.delete(sinkKey);
	}

	clearAll(): void {
		for (const [sinkKey] of this.sinks) {
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
		};
	}
}

export const videoCache = new VideoCache();
