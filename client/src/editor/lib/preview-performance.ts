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
	renderCadenceMs?: number;
	buildSceneMs?: number;
	renderToCanvasMs?: number;
	dropped?: boolean;
	coalescedFrames?: number;
};

export type PreviewPerfResourceSnapshot = {
	t: number;
	domNodes?: number;
	resourceCount?: number;
};

export type PreviewPerfCounters = {
	waveformPaints: number;
	sceneCacheHits: number;
	droppedFrames: number;
	coalescedFrames: number;
	domResourceSnapshot: PreviewPerfResourceSnapshot | null;
};

export type PreviewPerfRollingStats = {
	count: number;
	avgTotalMs: number;
	p50TotalMs: number;
	p95TotalMs: number;
	avgRenderCadenceMs: number;
	p50RenderCadenceMs: number;
	p95RenderCadenceMs: number;
	droppedFrames: number;
	coalescedFrames: number;
	waveformPaints: number;
	sceneCacheHits: number;
	domResourceSnapshot: PreviewPerfResourceSnapshot | null;
	last: PreviewFrameSample | null;
};

const ROLLING = 120;
const samples: PreviewFrameSample[] = [];
let frameStart: number | null = null;
let previousFrameStart: number | null = null;
let buildSceneMs = 0;
let renderToCanvasMs = 0;
const counters: PreviewPerfCounters = {
	waveformPaints: 0,
	sceneCacheHits: 0,
	droppedFrames: 0,
	coalescedFrames: 0,
	domResourceSnapshot: null,
};
const hasLocalStorage =
	typeof localStorage !== "undefined" &&
	typeof localStorage.getItem === "function" &&
	typeof localStorage.setItem === "function" &&
	typeof localStorage.removeItem === "function";
let enabledFlag = hasLocalStorage && localStorage.getItem("clippster_preview_perf") === "1";

export function setPreviewPerfEnabled(on: boolean): void {
	enabledFlag = on;
	if (hasLocalStorage) {
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
	const now = performance.now();
	previousFrameStart = frameStart;
	frameStart = now;
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

export function previewPerfMarkWaveformPaint(count = 1): void {
	if (!isPreviewPerfEnabled()) return;
	counters.waveformPaints += normalizedCount(count);
}

export function previewPerfMarkSceneCacheHit(count = 1): void {
	if (!isPreviewPerfEnabled()) return;
	counters.sceneCacheHits += normalizedCount(count);
}

export function previewPerfSnapshotDomResources(
	snapshot: { domNodes?: number; resourceCount?: number } = {},
): PreviewPerfResourceSnapshot | null {
	if (!isPreviewPerfEnabled()) return null;
	const domNodes =
		snapshot.domNodes ??
		(typeof document !== "undefined" ? document.getElementsByTagName("*").length : undefined);
	const resourceCount =
		snapshot.resourceCount ??
		(typeof performance !== "undefined" && typeof performance.getEntriesByType === "function"
			? performance.getEntriesByType("resource").length
			: undefined);
	counters.domResourceSnapshot = {
		t: performance.now(),
		domNodes,
		resourceCount,
	};
	return counters.domResourceSnapshot;
}

export function previewPerfEndFrame(opts?: {
	dropped?: boolean;
	coalesced?: boolean | number;
}): void {
	if (!isPreviewPerfEnabled()) return;
	const now = performance.now();
	const coalescedFrames =
		typeof opts?.coalesced === "number"
			? normalizedCount(opts.coalesced)
			: opts?.coalesced
				? 1
				: 0;
	const s: PreviewFrameSample = {
		t: now,
		totalMs: frameStart === null ? 0 : now - frameStart,
		renderCadenceMs:
			frameStart === null || previousFrameStart === null ? undefined : frameStart - previousFrameStart,
		buildSceneMs,
		renderToCanvasMs,
		dropped: opts?.dropped,
		coalescedFrames: coalescedFrames || undefined,
	};
	if (opts?.dropped) counters.droppedFrames++;
	counters.coalescedFrames += coalescedFrames;
	samples.push(s);
	if (samples.length > ROLLING) samples.shift();

	if (samples.length % 30 === 0) {
		const last = samples.slice(-30);
		const avg = last.reduce((a, b) => a + b.totalMs, 0) / last.length;
		const p95 = percentile(
			last.map((x) => x.totalMs).sort((a, b) => a - b),
			0.95,
		);
		const cadence = last
			.map((x) => x.renderCadenceMs)
			.filter((value): value is number => value !== undefined);
		const cadenceAvg = average(cadence);
		// eslint-disable-next-line no-console
		console.debug(
			`[PreviewPerf] last30 avg=${avg.toFixed(2)}ms p95=${p95.toFixed(2)}ms cadence=${cadenceAvg.toFixed(2)}ms dropped=${counters.droppedFrames} coalesced=${counters.coalescedFrames} buildScene=${buildSceneMs.toFixed(2)}ms render=${renderToCanvasMs.toFixed(2)}ms`,
		);
	}
}

function normalizedCount(count: number): number {
	return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

function average(values: number[]): number {
	return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(sorted: number[], p: number): number {
	if (sorted.length === 0) return 0;
	const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
	return sorted[idx] ?? 0;
}

export function getPreviewPerfRollingStats(): PreviewPerfRollingStats {
	if (samples.length === 0) {
		return {
			count: 0,
			avgTotalMs: 0,
			p50TotalMs: 0,
			p95TotalMs: 0,
			avgRenderCadenceMs: 0,
			p50RenderCadenceMs: 0,
			p95RenderCadenceMs: 0,
			...counters,
			last: null,
		};
	}
	const totals = samples.map((s) => s.totalMs).sort((a, b) => a - b);
	const cadences = samples
		.map((sample) => sample.renderCadenceMs)
		.filter((value): value is number => value !== undefined)
		.sort((a, b) => a - b);
	return {
		count: samples.length,
		avgTotalMs: average(totals),
		p50TotalMs: percentile(totals, 0.5),
		p95TotalMs: percentile(totals, 0.95),
		avgRenderCadenceMs: average(cadences),
		p50RenderCadenceMs: percentile(cadences, 0.5),
		p95RenderCadenceMs: percentile(cadences, 0.95),
		...counters,
		last: samples[samples.length - 1] ?? null,
	};
}

export function resetPreviewPerfStats(): void {
	samples.length = 0;
	frameStart = null;
	previousFrameStart = null;
	buildSceneMs = 0;
	renderToCanvasMs = 0;
	counters.waveformPaints = 0;
	counters.sceneCacheHits = 0;
	counters.droppedFrames = 0;
	counters.coalescedFrames = 0;
	counters.domResourceSnapshot = null;
}

/** Expose for DevTools: `window.__clippsterPreviewPerfStats()` */
export function exposePreviewPerfGlobal(): void {
	if (typeof window === "undefined") return;
	(window as unknown as { __clippsterPreviewPerfStats?: typeof getPreviewPerfRollingStats }).__clippsterPreviewPerfStats =
		getPreviewPerfRollingStats;
	(window as unknown as { __clippsterSetPreviewPerf?: typeof setPreviewPerfEnabled }).__clippsterSetPreviewPerf =
		setPreviewPerfEnabled;
}
