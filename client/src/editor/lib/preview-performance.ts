/**
 * Dev / diagnostics: lightweight preview frame timing and rolling stats.
 * Enable with localStorage `clippster_preview_perf=1` or `window.__CLIPPSTER_PREVIEW_PERF__ = true`.
 */

export type PreviewPerfCategory =
	| "buildScene"
	| "renderToCanvas"
	| "renderTree"
	| "videoDecode"
	| "canvasEffects"
	| "other";

export type PreviewFrameSample = {
	t: number;
	totalMs: number;
	buildSceneMs?: number;
	renderToCanvasMs?: number;
	dropped?: boolean;
};

const ROLLING = 120;
const samples: PreviewFrameSample[] = [];
let frameStart = 0;
let buildSceneMs = 0;
let renderToCanvasMs = 0;
let enabledFlag =
	typeof localStorage !== "undefined" && localStorage.getItem("clippster_preview_perf") === "1";

export function setPreviewPerfEnabled(on: boolean): void {
	enabledFlag = on;
	if (typeof localStorage !== "undefined") {
		if (on) localStorage.setItem("clippster_preview_perf", "1");
		else localStorage.removeItem("clippster_preview_perf");
	}
}

export function isPreviewPerfEnabled(): boolean {
	if (typeof window !== "undefined" && (window as unknown as { __CLIPPSTER_PREVIEW_PERF__?: boolean }).__CLIPPSTER_PREVIEW_PERF__) {
		return true;
	}
	return enabledFlag;
}

export function previewPerfBeginFrame(): void {
	if (!isPreviewPerfEnabled()) return;
	frameStart = performance.now();
	buildSceneMs = 0;
	renderToCanvasMs = 0;
}

export function previewPerfMarkBuildScene(ms: number): void {
	if (!isPreviewPerfEnabled()) return;
	buildSceneMs = ms;
}

export function previewPerfMarkRenderToCanvas(ms: number): void {
	if (!isPreviewPerfEnabled()) return;
	renderToCanvasMs = ms;
}

export function previewPerfEndFrame(opts?: { dropped?: boolean }): void {
	if (!isPreviewPerfEnabled()) return;
	const totalMs = performance.now() - frameStart;
	const s: PreviewFrameSample = {
		t: performance.now(),
		totalMs,
		buildSceneMs,
		renderToCanvasMs,
		dropped: opts?.dropped,
	};
	samples.push(s);
	if (samples.length > ROLLING) samples.shift();

	if (samples.length % 30 === 0) {
		const last = samples.slice(-30);
		const avg = last.reduce((a, b) => a + b.totalMs, 0) / last.length;
		const p95 = percentile(
			last.map((x) => x.totalMs).sort((a, b) => a - b),
			0.95,
		);
		// eslint-disable-next-line no-console
		console.debug(
			`[PreviewPerf] last30 avg=${avg.toFixed(2)}ms p95=${p95.toFixed(2)}ms buildScene=${buildSceneMs.toFixed(2)}ms render=${renderToCanvasMs.toFixed(2)}ms`,
		);
	}
}

function percentile(sorted: number[], p: number): number {
	if (sorted.length === 0) return 0;
	const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
	return sorted[idx] ?? 0;
}

export function getPreviewPerfRollingStats(): {
	count: number;
	avgTotalMs: number;
	p95TotalMs: number;
	last: PreviewFrameSample | null;
} {
	if (samples.length === 0) {
		return { count: 0, avgTotalMs: 0, p95TotalMs: 0, last: null };
	}
	const totals = samples.map((s) => s.totalMs).sort((a, b) => a - b);
	const sum = samples.reduce((a, s) => a + s.totalMs, 0);
	return {
		count: samples.length,
		avgTotalMs: sum / samples.length,
		p95TotalMs: percentile(totals, 0.95),
		last: samples[samples.length - 1] ?? null,
	};
}

/** Expose for DevTools: `window.__clippsterPreviewPerfStats()` */
export function exposePreviewPerfGlobal(): void {
	if (typeof window === "undefined") return;
	(window as unknown as { __clippsterPreviewPerfStats?: typeof getPreviewPerfRollingStats }).__clippsterPreviewPerfStats =
		getPreviewPerfRollingStats;
	(window as unknown as { __clippsterSetPreviewPerf?: typeof setPreviewPerfEnabled }).__clippsterSetPreviewPerf =
		setPreviewPerfEnabled;
}
