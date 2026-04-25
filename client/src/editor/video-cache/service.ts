import {
	Input,
	ALL_FORMATS,
	BlobSource,
	CanvasSink,
	type WrappedCanvas,
} from "mediabunny";

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

export class VideoCache {
	private sinks = new Map<string, VideoSinkData>();
	private initPromises = new Map<string, Promise<void>>();

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

				// Check if the nextFrame (which might have just arrived) is what we need
				if (
					sinkData.prefetchedFrames.length > 0 &&
					sinkData.prefetchedFrames[0].timestamp <= targetTime + 0.05
				) {
					const prefetchedFrame = sinkData.prefetchedFrames.shift()!;
					sinkData.currentFrame = prefetchedFrame;
					sinkData.currentFrameStartTime = prefetchedFrame.timestamp;
				} else {
					const { value: frame, done } = await sinkData.iterator.next();

					if (done || !frame) break;

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

				if (!done && frame) {
					sinkData.prefetchedFrames.push(frame);
				}
			}

			sinkData.prefetching = false;
			sinkData.prefetchPromise = null;
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

			const sink = new CanvasSink(videoTrack, {
				poolSize: 3,
				fit: "contain",
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
