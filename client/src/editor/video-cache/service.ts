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
	nextFrame: WrappedCanvas | null;
	lastTime: number;
	prefetching: boolean;
	prefetchPromise: Promise<void> | null;
}

export class VideoCache {
	private sinks = new Map<string, VideoSinkData>();
	private initPromises = new Map<string, Promise<void>>();
	private debugFrameCount = 0;
	private debugLogInterval = 30; // log every N frames

	async getFrameAt({
		sinkKey,
		file,
		time,
	}: {
		sinkKey: string;
		file: File;
		time: number;
	}): Promise<WrappedCanvas | null> {
		const t0 = performance.now();
		await this.ensureSink({ sinkKey, file });

		const sinkData = this.sinks.get(sinkKey);
		if (!sinkData) return null;

		let path = 'none';

		if (sinkData.nextFrame && sinkData.nextFrame.timestamp <= time) {
			sinkData.currentFrame = sinkData.nextFrame;
			sinkData.currentFrameStartTime = sinkData.nextFrame.timestamp;
			sinkData.nextFrame = null;
			this.startPrefetch({ sinkData });
		}

		if (
			sinkData.currentFrame &&
			this.isFrameValid({
				frame: sinkData.currentFrame,
				frameStartTime: sinkData.currentFrameStartTime,
				time,
			})
		) {
			if (!sinkData.nextFrame && !sinkData.prefetching) {
				this.startPrefetch({ sinkData });
			}
			path = 'cache-hit';
			const elapsed = performance.now() - t0;
			this.debugFrameCount++;
			if (this.debugFrameCount % this.debugLogInterval === 0) {
				console.log(`[VideoCache] ${sinkKey.slice(0,8)} t=${time.toFixed(3)} path=${path} took=${elapsed.toFixed(1)}ms`);
			}
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
				if (!sinkData.nextFrame && !sinkData.prefetching) {
					this.startPrefetch({ sinkData });
				}
				path = 'iterate';
				const elapsed = performance.now() - t0;
				this.debugFrameCount++;
				if (elapsed > 10 || this.debugFrameCount % this.debugLogInterval === 0) {
					console.log(`[VideoCache] ${sinkKey.slice(0,8)} t=${time.toFixed(3)} path=${path} took=${elapsed.toFixed(1)}ms`);
				}
				return frame;
			}
		}

		const frame = await this.seekToTime({ sinkData, time });
		if (frame && !sinkData.nextFrame && !sinkData.prefetching) {
			this.startPrefetch({ sinkData });
		}
		path = frame ? 'seek' : 'miss';
		const elapsed = performance.now() - t0;
		this.debugFrameCount++;
		console.log(`[VideoCache] ${sinkKey.slice(0,8)} t=${time.toFixed(3)} path=${path} took=${elapsed.toFixed(1)}ms`);
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
					sinkData.nextFrame &&
					sinkData.nextFrame.timestamp <= targetTime + 0.05 // Tolerance
				) {
					sinkData.currentFrame = sinkData.nextFrame;
					sinkData.currentFrameStartTime = sinkData.nextFrame.timestamp;
					sinkData.nextFrame = null;
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

			sinkData.nextFrame = null;
			sinkData.iterator = sinkData.sink.canvases(time);
			sinkData.lastTime = time;

			// Fetch current frame
			const { value: frame } = await sinkData.iterator.next();

			if (frame) {
				sinkData.currentFrame = frame;
				// Some media starts with its first decodable frame after the requested
				// time (for example at ~0.5s). Hold that frame from the seek target so
				// playback can reuse it instead of re-seeking on every tick until the
				// decoder catches up.
				sinkData.currentFrameStartTime = Math.min(time, frame.timestamp);

				// Aggressively fetch next frame immediately to fill buffer
				// This matches the mediaplayer example which fetches 2 frames on start
				try {
					const { value: next } = await sinkData.iterator.next();
					if (next) {
						sinkData.nextFrame = next;
					}
				} catch (e) {
					console.warn("Failed to pre-fetch next frame on seek:", e);
				}

				return frame;
			}
		} catch (error) {
			console.warn("Failed to seek video:", error);
		}

		return null;
	}

	private startPrefetch({ sinkData }: { sinkData: VideoSinkData }): void {
		if (sinkData.prefetching || !sinkData.iterator || sinkData.nextFrame) {
			return;
		}

		sinkData.prefetching = true;
		sinkData.prefetchPromise = this.prefetchNextFrame({ sinkData });
	}

	private async prefetchNextFrame({
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
			const { value: frame, done } = await sinkData.iterator.next();

			if (done || !frame) {
				sinkData.prefetching = false;
				sinkData.prefetchPromise = null;
				return;
			}

			sinkData.nextFrame = frame;
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
				nextFrame: null,
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
