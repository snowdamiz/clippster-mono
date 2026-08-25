import { filmstripCacheGet, filmstripCachePut } from "./filmstrip-cache";

const LOW_END_DEVICE = typeof navigator !== "undefined" && (navigator.hardwareConcurrency ?? 8) <= 4;
const THUMBNAIL_HEIGHT = LOW_END_DEVICE ? 36 : 54;
const DEFAULT_ASPECT_RATIO = 16 / 9;
/** Max decoded samples per clip for timeline filmstrip (zoomed-in width / thumb width, capped). */
const MAX_FILMSTRIP_FRAMES = 120;
const MAX_CACHE_ENTRIES = LOW_END_DEVICE ? 300 : 600;
const WORKER_COUNT = typeof navigator !== "undefined" && (navigator.hardwareConcurrency ?? 8) <= 2 ? 1 : 2;

interface CachedThumbnail {
	bitmap: ImageBitmap;
	lastAccessed: number;
}

// ── Worker pool ───────────────────────────────────────────────────────────────

interface WorkerJob {
	jobId: string;
	taskKey: string;
	mediaId: string;
	onFrame: (timestamp: number, bitmap: ImageBitmap) => void;
	onDone: () => void;
	signal: AbortSignal;
}

class FilmstripWorkerPool {
	private workers: Worker[] = [];
	/** Map jobId → which worker index handles it */
	private jobWorker = new Map<string, number>();
	/** Pending callbacks keyed by jobId */
	private pending = new Map<string, WorkerJob>();
	private nextWorker = 0;

	constructor() {
		for (let i = 0; i < WORKER_COUNT; i++) {
			const w = new Worker(new URL("./filmstrip-worker.ts", import.meta.url), { type: "module" });
			w.onmessage = this.handleMessage.bind(this, i);
			this.workers.push(w);
		}
	}

	private handleMessage(_workerIdx: number, event: MessageEvent) {
		const msg = event.data;
		const job = this.pending.get(msg.jobId);
		if (!job) return;

		if (msg.type === "frame") {
			if (!job.signal.aborted) {
				job.onFrame(msg.timestamp, msg.bitmap as ImageBitmap);
			} else {
				// Discard — close bitmap to free GPU memory
				(msg.bitmap as ImageBitmap).close();
			}
		} else if (msg.type === "done" || msg.type === "error") {
			this.pending.delete(msg.jobId);
			this.jobWorker.delete(msg.jobId);
			if (!job.signal.aborted) {
				job.onDone();
			}
		}
	}

	dispatch(job: WorkerJob, file: File, timestamps: number[], thumbHeight: number, aspectRatio: number) {
		const workerIdx = this.nextWorker % this.workers.length;
		this.nextWorker++;
		this.pending.set(job.jobId, job);
		this.jobWorker.set(job.jobId, workerIdx);

		this.workers[workerIdx].postMessage({
			type: "extract",
			jobId: job.jobId,
			mediaId: job.mediaId,
			file,
			timestamps,
			thumbHeight,
			aspectRatio,
		});
	}

	cancel(jobId: string) {
		const workerIdx = this.jobWorker.get(jobId);
		if (workerIdx !== undefined) {
			this.workers[workerIdx].postMessage({ type: "cancel", jobId });
		}
		this.pending.delete(jobId);
		this.jobWorker.delete(jobId);
	}

	cancelByTaskKey(taskKey: string) {
		for (const [jobId, job] of this.pending) {
			if (job.taskKey === taskKey) {
				this.cancel(jobId);
			}
		}
	}
}

// ── FilmstripService ──────────────────────────────────────────────────────────

export class FilmstripService {
	private workerPool = new FilmstripWorkerPool();
	/** In-memory bitmap cache (fast path; also serves zoom de-dup) */
	private cache = new Map<string, CachedThumbnail>();
	/** Aspect ratios by mediaId, learned from worker responses */
	private aspectRatios = new Map<string, number>();

	private getCacheKey({
		mediaId,
		timestamp,
	}: {
		mediaId: string;
		timestamp: number;
	}): string {
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

		const entries = Array.from(this.cache.entries());
		entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
		const toEvict = Math.floor(entries.length * 0.2);
		for (let i = 0; i < toEvict; i++) {
			const [key, entry] = entries[i];
			entry.bitmap.close();
			this.cache.delete(key);
		}
	}

	cancelExtraction({ taskKey }: { taskKey: string }): void {
		this.workerPool.cancelByTaskKey(taskKey);
	}

	/**
	 * Request filmstrip frames. Checks in-memory cache, then IndexedDB, then
	 * dispatches to the worker pool for any truly uncached timestamps.
	 * Returns an AbortController to cancel the request.
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
		this.cancelExtraction({ taskKey });

		const controller = new AbortController();
		const jobId = `${taskKey}:${Date.now()}`;

		const uncachedTimestamps: number[] = [];

		// ── 1. In-memory fast path ────────────────────────────────────────────
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

		// ── 2. IndexedDB cache check + worker dispatch ────────────────────────
		const ar = this.aspectRatios.get(mediaId) ?? DEFAULT_ASPECT_RATIO;
		let pending = uncachedTimestamps.length;
		let workerNeeded = false;
		const workerTimestamps: number[] = [];

		// Track how many IDB lookups are in-flight; dispatch worker when done
		let idbResolved = 0;

		const checkIdbDone = () => {
			idbResolved++;
			if (idbResolved < uncachedTimestamps.length) return;

			if (controller.signal.aborted) {
				if (pending === 0) onDone();
				return;
			}

			if (workerTimestamps.length === 0) {
				// All served from IDB — we're done
				onDone();
				return;
			}

			// Dispatch remaining timestamps to worker
			workerNeeded = true;
			this.workerPool.dispatch(
				{
					jobId,
					taskKey,
					mediaId,
					signal: controller.signal,
					onFrame: (timestamp, bitmap) => {
						// Store in in-memory cache
						this.setCachedBitmap({ mediaId, timestamp, bitmap });
						// Store aspect ratio learned from worker
						if (!this.aspectRatios.has(mediaId)) {
							this.aspectRatios.set(mediaId, ar);
						}
						onFrame(timestamp, bitmap);

						// Write to IndexedDB in background (non-blocking)
						const key = this.getCacheKey({ mediaId, timestamp });
						this.bitmapToBlob(bitmap).then((blob) => {
							if (blob) filmstripCachePut(key, blob);
						});
					},
					onDone: () => {
						onDone();
					},
				},
				file,
				workerTimestamps,
				THUMBNAIL_HEIGHT,
				ar,
			);
		};

		// Fire IDB lookups in parallel
		for (const ts of uncachedTimestamps) {
			const key = this.getCacheKey({ mediaId, timestamp: ts });
			filmstripCacheGet(key).then((blob) => {
				if (controller.signal.aborted) {
					checkIdbDone();
					return;
				}
				if (blob) {
					// Convert Blob → ImageBitmap and serve
					createImageBitmap(blob).then((bitmap) => {
						this.setCachedBitmap({ mediaId, timestamp: ts, bitmap });
						onFrame(ts, bitmap);
						checkIdbDone();
					}).catch(() => {
						workerTimestamps.push(ts);
						checkIdbDone();
					});
				} else {
					workerTimestamps.push(ts);
					checkIdbDone();
				}
			}).catch(() => {
				workerTimestamps.push(ts);
				checkIdbDone();
			});
		}

		void workerNeeded; // referenced in dispatch branch
		void pending;

		return controller;
	}

	/** Convert an ImageBitmap to a JPEG Blob for IndexedDB storage. */
	private bitmapToBlob(bitmap: ImageBitmap): Promise<Blob | null> {
		return new Promise((resolve) => {
			const canvas = document.createElement("canvas");
			canvas.width = bitmap.width;
			canvas.height = bitmap.height;
			const ctx = canvas.getContext("2d");
			if (!ctx) { resolve(null); return; }
			ctx.drawImage(bitmap, 0, 0);
			canvas.toBlob((b) => resolve(b), "image/jpeg", 0.7);
		});
	}

	getAspectRatio({ mediaId }: { mediaId: string }): number {
		return this.aspectRatios.get(mediaId) ?? DEFAULT_ASPECT_RATIO;
	}

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
		const cappedFrames = Math.min(numFrames, MAX_FILMSTRIP_FRAMES);
		const sourceDuration = duration * speed;
		const timestamps: number[] = [];

		for (let i = 0; i < cappedFrames; i++) {
			const t = trimStart + ((i + 0.5) / cappedFrames) * sourceDuration;
			timestamps.push(Math.max(0, t));
		}

		return timestamps;
	}

	clearMedia({ mediaId }: { mediaId: string }): void {
		this.workerPool.cancelByTaskKey(mediaId);

		for (const [key, entry] of this.cache) {
			if (key.startsWith(mediaId + ":")) {
				entry.bitmap.close();
				this.cache.delete(key);
			}
		}

		this.aspectRatios.delete(mediaId);
	}

	clearAll(): void {
		for (const [, entry] of this.cache) {
			entry.bitmap.close();
		}
		this.cache.clear();
		this.aspectRatios.clear();
	}

	getStats(): {
		cachedThumbnails: number;
		knownMediaIds: number;
	} {
		return {
			cachedThumbnails: this.cache.size,
			knownMediaIds: this.aspectRatios.size,
		};
	}
}

export const filmstripService = new FilmstripService();
