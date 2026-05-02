/**
 * Reserved for off-main-thread preview work (future: texture upload, hashing).
 * Vite: `new URL('./preview-frame-worker.ts', import.meta.url)` with `{ type: 'module' }`.
 */
/// <reference lib="webworker" />

export type PreviewWorkerInbound =
	| { type: "ping" }
	| { type: "hashScene"; payload: string };

export type PreviewWorkerOutbound =
	| { type: "pong"; t: number }
	| { type: "hashSceneResult"; hash: number };

self.addEventListener("message", (ev: MessageEvent<PreviewWorkerInbound>) => {
	const d = ev.data;
	if (d.type === "ping") {
		self.postMessage({ type: "pong", t: performance.now() } satisfies PreviewWorkerOutbound);
		return;
	}
	if (d.type === "hashScene") {
		let h = 0;
		for (let i = 0; i < d.payload.length; i++) {
			h = (Math.imul(31, h) + d.payload.charCodeAt(i)) | 0;
		}
		self.postMessage({ type: "hashSceneResult", hash: h } satisfies PreviewWorkerOutbound);
	}
});
