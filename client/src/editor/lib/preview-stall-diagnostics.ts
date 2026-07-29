import { isPreviewPerfEnabled } from "./preview-performance";

/**
 * Targeted playback-stall tracing. Unlike the rolling [PreviewPerf] stats these
 * logs fire only on anomalies (slow decodes, cache invalidation, discarded
 * prewarm results), so a single reproduction run pinpoints which stage caused
 * a frozen frame at a clip boundary.
 *
 * Enabled in dev builds automatically, or via
 * `localStorage.setItem('clippster_preview_perf', '1')` in production builds.
 */
export function isPreviewDiagEnabled(): boolean {
	return import.meta.env.DEV || isPreviewPerfEnabled();
}

export function previewDiag(tag: string, data: Record<string, unknown>): void {
	if (!isPreviewDiagEnabled()) return;
	// eslint-disable-next-line no-console
	console.warn(`[PreviewDiag] ${tag}`, {
		t: Math.round(performance.now()),
		...data,
	});
}
