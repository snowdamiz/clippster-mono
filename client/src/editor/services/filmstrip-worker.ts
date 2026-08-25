/**
 * Web Worker script for filmstrip thumbnail extraction.
 * Runs mediabunny decode off the main thread, posts ImageBitmap transferables
 * back so the main thread only handles display — never decoding.
 *
 * Message protocol:
 *   IN  → { type: "extract", jobId, mediaId, file, timestamps, thumbHeight, aspectRatio }
 *   IN  → { type: "cancel", jobId }
 *   OUT → { type: "frame", jobId, mediaId, timestamp, bitmap } (transferable)
 *   OUT → { type: "done", jobId }
 *   OUT → { type: "error", jobId, message }
 */

/// <reference lib="webworker" />

import {
	Input,
	ALL_FORMATS,
	BlobSource,
	CanvasSink,
} from "mediabunny";

const DEFAULT_ASPECT_RATIO = 16 / 9;

interface SinkEntry {
	sink: CanvasSink;
	aspectRatio: number;
}

const sinks = new Map<string, SinkEntry>();
const sinkInitPromises = new Map<string, Promise<SinkEntry | null>>();
const abortControllers = new Map<string, AbortController>();

async function ensureSink(mediaId: string, file: File, thumbHeight: number, aspectRatio: number): Promise<SinkEntry | null> {
	const existing = sinks.get(mediaId);
	if (existing) return existing;

	const pending = sinkInitPromises.get(mediaId);
	if (pending) return pending;

	const initPromise = (async (): Promise<SinkEntry | null> => {
		try {
			const input = new Input({
				source: new BlobSource(file),
				formats: ALL_FORMATS,
			});

			const videoTrack = await input.getPrimaryVideoTrack();
			if (!videoTrack) return null;

			const canDecode = await videoTrack.canDecode();
			if (!canDecode) return null;

			const ar = videoTrack.displayWidth && videoTrack.displayHeight
				? videoTrack.displayWidth / videoTrack.displayHeight
				: aspectRatio;

			const thumbWidth = Math.round(thumbHeight * ar);

			const sink = new CanvasSink(videoTrack, {
				width: thumbWidth,
				height: thumbHeight,
				fit: "cover",
			});

			const entry: SinkEntry = { sink, aspectRatio: ar };
			sinks.set(mediaId, entry);
			return entry;
		} catch {
			return null;
		} finally {
			sinkInitPromises.delete(mediaId);
		}
	})();

	sinkInitPromises.set(mediaId, initPromise);
	return initPromise;
}

async function handleExtract(msg: {
	jobId: string;
	mediaId: string;
	file: File;
	timestamps: number[];
	thumbHeight: number;
	aspectRatio: number;
}) {
	const { jobId, mediaId, file, timestamps, thumbHeight, aspectRatio } = msg;

	const controller = new AbortController();
	abortControllers.set(jobId, controller);

	try {
		const sinkEntry = await ensureSink(mediaId, file, thumbHeight, aspectRatio);
		if (!sinkEntry || controller.signal.aborted) {
			self.postMessage({ type: "done", jobId });
			return;
		}

		const { sink } = sinkEntry;

		for await (const result of sink.canvasesAtTimestamps(timestamps)) {
			if (controller.signal.aborted) break;
			if (!result) continue;

			try {
				// createImageBitmap is available in Workers
				const bitmap = await createImageBitmap(result.canvas as HTMLCanvasElement);
				// Transfer the bitmap to the main thread without copying
				(self as DedicatedWorkerGlobalScope).postMessage(
					{ type: "frame", jobId, mediaId, timestamp: result.timestamp, bitmap },
					[bitmap],
				);
			} catch {
				// Skip frames that fail to decode
			}
		}
	} catch (err) {
		if (!controller.signal.aborted) {
			self.postMessage({ type: "error", jobId, message: String(err) });
		}
	} finally {
		abortControllers.delete(jobId);
		self.postMessage({ type: "done", jobId });
	}
}

self.onmessage = (event: MessageEvent) => {
	const msg = event.data;
	if (msg.type === "extract") {
		handleExtract(msg);
	} else if (msg.type === "cancel") {
		const ctrl = abortControllers.get(msg.jobId);
		if (ctrl) {
			ctrl.abort();
			abortControllers.delete(msg.jobId);
		}
	}
};
