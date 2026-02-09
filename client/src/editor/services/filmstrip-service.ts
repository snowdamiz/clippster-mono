import {
	Input,
	ALL_FORMATS,
	BlobSource,
	CanvasSink,
} from "mediabunny";

const THUMBNAIL_HEIGHT = 54;
const DEFAULT_ASPECT_RATIO = 16 / 9;
const MAX_CACHE_ENTRIES = 600;
const MAX_CONCURRENT_EXTRACTIONS = 3;

interface CachedThumbnail {
	bitmap: ImageBitmap;
	lastAccessed: number;
}

interface SinkEntry {
	sink: CanvasSink;
	aspectRatio: number;
}

interface ExtractionTask {
	controller: AbortController;
	promise: Promise<void>;
}

export class FilmstripService {
	private sinks = new Map<string, SinkEntry>();
	private sinkInitPromises = new Map<string, Promise<SinkEntry | null>>();
	private cache = new Map<string, CachedThumbnail>();
	private activeTasks = new Map<string, ExtractionTask>();
	private extractionQueue: Array<{
		taskKey: string;
		mediaId: string;
		file: File;
		timestamps: number[];
		onFrame: (timestamp: number, bitmap: ImageBitmap) => void;
		onDone: () => void;
		signal: AbortSignal;
	}> = [];
	private activeCount = 0;

	private getCacheKey({
		mediaId,
		timestamp,
	}: {
		mediaId: string;
		timestamp: number;
	}): string {
		// Round timestamp to nearest 10ms to allow cache hits for close timestamps
		const roundedTs = Math.round(timestamp * 100) / 100;
		return `${mediaId}:${roundedTs}`;
	}

	private getCachedBitmap({
		mediaId,
		timestamp,
	}: {
		mediaId: string;
		timestamp: number;
	}): ImageBitmap | null {
		const key = this.getCacheKey({ mediaId, timestamp });
		const entry = this.cache.get(key);
		if (entry) {
			entry.lastAccessed = Date.now();
			return entry.bitmap;
		}
		return null;
	}

	private setCachedBitmap({
		mediaId,
		timestamp,
		bitmap,
	}: {
		mediaId: string;
		timestamp: number;
		bitmap: ImageBitmap;
	}): void {
		const key = this.getCacheKey({ mediaId, timestamp });
		this.cache.set(key, { bitmap, lastAccessed: Date.now() });
		this.evictIfNeeded();
	}

	private evictIfNeeded(): void {
		if (this.cache.size <= MAX_CACHE_ENTRIES) return;

		// Evict oldest 20% of entries
		const entries = Array.from(this.cache.entries());
		entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
		const toEvict = Math.floor(entries.length * 0.2);
		for (let i = 0; i < toEvict; i++) {
			const [key, entry] = entries[i];
			entry.bitmap.close();
			this.cache.delete(key);
		}
	}

	private async ensureSink({
		mediaId,
		file,
	}: {
		mediaId: string;
		file: File;
	}): Promise<SinkEntry | null> {
		const existing = this.sinks.get(mediaId);
		if (existing) return existing;

		// Deduplicate concurrent init calls
		const pending = this.sinkInitPromises.get(mediaId);
		if (pending) return pending;

		const initPromise = this.initSink({ mediaId, file });
		this.sinkInitPromises.set(mediaId, initPromise);

		try {
			const result = await initPromise;
			return result;
		} finally {
			this.sinkInitPromises.delete(mediaId);
		}
	}

	private async initSink({
		mediaId,
		file,
	}: {
		mediaId: string;
		file: File;
	}): Promise<SinkEntry | null> {
		try {
			const input = new Input({
				source: new BlobSource(file),
				formats: ALL_FORMATS,
			});

			const videoTrack = await input.getPrimaryVideoTrack();
			if (!videoTrack) return null;

			const canDecode = await videoTrack.canDecode();
			if (!canDecode) return null;

			const aspectRatio =
				videoTrack.displayWidth / videoTrack.displayHeight || DEFAULT_ASPECT_RATIO;
			const thumbWidth = Math.round(THUMBNAIL_HEIGHT * aspectRatio);

			const sink = new CanvasSink(videoTrack, {
				width: thumbWidth,
				height: THUMBNAIL_HEIGHT,
				fit: "cover",
			});

			const entry: SinkEntry = { sink, aspectRatio };
			this.sinks.set(mediaId, entry);
			return entry;
		} catch (error) {
			console.warn(`[FilmstripService] Failed to init sink for ${mediaId}:`, error);
			return null;
		}
	}

	/**
	 * Cancel any in-flight extraction for a given task key.
	 */
	cancelExtraction({ taskKey }: { taskKey: string }): void {
		const task = this.activeTasks.get(taskKey);
		if (task) {
			task.controller.abort();
			this.activeTasks.delete(taskKey);
		}
		// Also remove from queue if pending
		this.extractionQueue = this.extractionQueue.filter(
			(q) => q.taskKey !== taskKey,
		);
	}

	/**
	 * Request filmstrip frames for an element. Returns immediately;
	 * frames are delivered via the onFrame callback as they decode.
	 */
	requestFilmstrip({
		taskKey,
		mediaId,
		file,
		timestamps,
		onFrame,
		onDone,
	}: {
		taskKey: string;
		mediaId: string;
		file: File;
		timestamps: number[];
		onFrame: (timestamp: number, bitmap: ImageBitmap) => void;
		onDone: () => void;
	}): AbortController {
		// Cancel any existing extraction for this task
		this.cancelExtraction({ taskKey });

		const controller = new AbortController();

		// Check cache first — deliver cached frames immediately
		const uncachedTimestamps: number[] = [];
		for (const ts of timestamps) {
			const cached = this.getCachedBitmap({ mediaId, timestamp: ts });
			if (cached) {
				onFrame(ts, cached);
			} else {
				uncachedTimestamps.push(ts);
			}
		}

		if (uncachedTimestamps.length === 0) {
			onDone();
			return controller;
		}

		// Queue the extraction
		this.extractionQueue.push({
			taskKey,
			mediaId,
			file,
			timestamps: uncachedTimestamps,
			onFrame,
			onDone,
			signal: controller.signal,
		});

		const task: ExtractionTask = {
			controller,
			promise: Promise.resolve(),
		};
		this.activeTasks.set(taskKey, task);

		this.processQueue();

		return controller;
	}

	private processQueue(): void {
		while (
			this.activeCount < MAX_CONCURRENT_EXTRACTIONS &&
			this.extractionQueue.length > 0
		) {
			const job = this.extractionQueue.shift()!;
			if (job.signal.aborted) {
				this.activeTasks.delete(job.taskKey);
				continue;
			}

			this.activeCount++;
			const promise = this.executeExtraction(job).finally(() => {
				this.activeCount--;
				this.activeTasks.delete(job.taskKey);
				this.processQueue();
			});

			const existingTask = this.activeTasks.get(job.taskKey);
			if (existingTask) {
				existingTask.promise = promise;
			}
		}
	}

	private async executeExtraction(job: {
		taskKey: string;
		mediaId: string;
		file: File;
		timestamps: number[];
		onFrame: (timestamp: number, bitmap: ImageBitmap) => void;
		onDone: () => void;
		signal: AbortSignal;
	}): Promise<void> {
		try {
			const sinkEntry = await this.ensureSink({
				mediaId: job.mediaId,
				file: job.file,
			});
			if (!sinkEntry || job.signal.aborted) {
				job.onDone();
				return;
			}

			const { sink } = sinkEntry;

			for await (const result of sink.canvasesAtTimestamps(job.timestamps)) {
				if (job.signal.aborted) break;
				if (!result) continue;

				try {
					// Convert canvas to ImageBitmap for efficient GPU-backed storage
					const bitmap = await createImageBitmap(result.canvas as HTMLCanvasElement);
					this.setCachedBitmap({
						mediaId: job.mediaId,
						timestamp: result.timestamp,
						bitmap,
					});
					job.onFrame(result.timestamp, bitmap);
				} catch (e) {
					// Frame decode failed, skip
					console.warn(`[FilmstripService] Frame decode failed at ${result.timestamp}:`, e);
				}
			}
		} catch (error) {
			if (!job.signal.aborted) {
				console.warn(`[FilmstripService] Extraction failed for ${job.mediaId}:`, error);
			}
		} finally {
			job.onDone();
		}
	}

	/**
	 * Get the aspect ratio for a media asset (from its CanvasSink).
	 * Returns default 16:9 if not yet initialized.
	 */
	getAspectRatio({ mediaId }: { mediaId: string }): number {
		const entry = this.sinks.get(mediaId);
		return entry?.aspectRatio ?? DEFAULT_ASPECT_RATIO;
	}

	/**
	 * Compute the timestamps needed for a filmstrip at the current zoom level.
	 */
	computeTimestamps({
		trimStart,
		duration,
		speed,
		elementWidthPx,
		aspectRatio,
	}: {
		trimStart: number;
		duration: number;
		speed: number;
		elementWidthPx: number;
		aspectRatio?: number;
	}): number[] {
		const ar = aspectRatio ?? DEFAULT_ASPECT_RATIO;
		const thumbWidth = THUMBNAIL_HEIGHT * ar;
		const numFrames = Math.max(1, Math.ceil(elementWidthPx / thumbWidth));
		// Cap at a reasonable max to avoid decoding hundreds of frames
		const cappedFrames = Math.min(numFrames, 60);
		const sourceDuration = duration * speed;
		const timestamps: number[] = [];

		for (let i = 0; i < cappedFrames; i++) {
			// Sample from center of each tile slot
			const t = trimStart + ((i + 0.5) / cappedFrames) * sourceDuration;
			timestamps.push(Math.max(0, t));
		}

		return timestamps;
	}

	/**
	 * Clear all cached data for a specific media asset.
	 */
	clearMedia({ mediaId }: { mediaId: string }): void {
		// Cancel active tasks for this media
		for (const [taskKey, task] of this.activeTasks) {
			if (taskKey.startsWith(mediaId)) {
				task.controller.abort();
				this.activeTasks.delete(taskKey);
			}
		}

		// Clear cache entries
		for (const [key, entry] of this.cache) {
			if (key.startsWith(mediaId + ":")) {
				entry.bitmap.close();
				this.cache.delete(key);
			}
		}

		// Remove sink
		this.sinks.delete(mediaId);
	}

	/**
	 * Clear everything.
	 */
	clearAll(): void {
		for (const [, task] of this.activeTasks) {
			task.controller.abort();
		}
		this.activeTasks.clear();
		this.extractionQueue = [];

		for (const [, entry] of this.cache) {
			entry.bitmap.close();
		}
		this.cache.clear();
		this.sinks.clear();
		this.sinkInitPromises.clear();
	}

	getStats(): {
		cachedThumbnails: number;
		activeSinks: number;
		activeExtractions: number;
		queuedExtractions: number;
	} {
		return {
			cachedThumbnails: this.cache.size,
			activeSinks: this.sinks.size,
			activeExtractions: this.activeCount,
			queuedExtractions: this.extractionQueue.length,
		};
	}
}

export const filmstripService = new FilmstripService();
