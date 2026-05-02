/**
 * Optional worker for lightweight off-main-thread tasks (ping / scene string hash).
 * Falls back to main-thread hash if Worker is unavailable.
 */

import type { PreviewWorkerInbound, PreviewWorkerOutbound } from "../workers/preview-frame-worker";

let worker: Worker | null = null;

function getWorker(): Worker | null {
	if (typeof Worker === "undefined") return null;
	if (worker) return worker;
	try {
		worker = new Worker(new URL("../workers/preview-frame-worker.ts", import.meta.url), {
			type: "module",
		});
		return worker;
	} catch {
		return null;
	}
}

export function pingPreviewWorker(): Promise<number | null> {
	const w = getWorker();
	if (!w) return Promise.resolve(null);
	return new Promise((resolve) => {
		const onMsg = (ev: MessageEvent<PreviewWorkerOutbound>) => {
			if (ev.data?.type === "pong") {
				w.removeEventListener("message", onMsg);
				resolve(ev.data.t);
			}
		};
		w.addEventListener("message", onMsg);
		w.postMessage({ type: "ping" } satisfies PreviewWorkerInbound);
		setTimeout(() => {
			w.removeEventListener("message", onMsg);
			resolve(null);
		}, 2000);
	});
}

export function hashSceneStringInWorker(payload: string): Promise<number | null> {
	const w = getWorker();
	if (!w) return Promise.resolve(null);
	return new Promise((resolve) => {
		const onMsg = (ev: MessageEvent<PreviewWorkerOutbound>) => {
			if (ev.data?.type === "hashSceneResult") {
				w.removeEventListener("message", onMsg);
				resolve(ev.data.hash);
			}
		};
		w.addEventListener("message", onMsg);
		w.postMessage({ type: "hashScene", payload } satisfies PreviewWorkerInbound);
		setTimeout(() => {
			w.removeEventListener("message", onMsg);
			resolve(null);
		}, 2000);
	});
}
