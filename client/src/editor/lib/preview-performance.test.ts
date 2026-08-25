import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	getPreviewPerfRollingStats,
	previewPerfBeginFrame,
	previewPerfEndFrame,
	previewPerfMarkBuildScene,
	previewPerfMarkCoalesced,
	previewPerfMarkDropped,
	previewPerfMarkRenderToCanvas,
	previewPerfMarkSceneCacheHit,
	previewPerfMarkWaveformPaint,
	previewPerfSnapshotDomResources,
	resetPreviewPerfStats,
	setPreviewPerfEnabled,
} from "./preview-performance";

describe("preview performance instrumentation", () => {
	beforeEach(() => {
		resetPreviewPerfStats();
		setPreviewPerfEnabled(true);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		setPreviewPerfEnabled(false);
		resetPreviewPerfStats();
	});

	it("reports frame duration percentiles and render cadence", () => {
		vi.spyOn(performance, "now")
			.mockReturnValueOnce(0)
			.mockReturnValueOnce(10)
			.mockReturnValueOnce(20)
			.mockReturnValueOnce(35)
			.mockReturnValueOnce(50)
			.mockReturnValueOnce(80);

		previewPerfBeginFrame();
		previewPerfMarkBuildScene(3);
		previewPerfMarkRenderToCanvas(5);
		previewPerfEndFrame();
		previewPerfBeginFrame();
		previewPerfEndFrame();
		previewPerfBeginFrame();
		previewPerfEndFrame();

		const stats = getPreviewPerfRollingStats();
		expect(stats.count).toBe(3);
		expect(stats.avgTotalMs).toBeCloseTo(55 / 3);
		expect(stats.p50TotalMs).toBe(15);
		expect(stats.p95TotalMs).toBe(30);
		expect(stats.avgRenderCadenceMs).toBe(25);
		expect(stats.p50RenderCadenceMs).toBe(20);
		expect(stats.p95RenderCadenceMs).toBe(30);
		expect(stats.last?.renderCadenceMs).toBe(30);
	});

	it("counts dropped and coalesced frames", () => {
		vi.spyOn(performance, "now")
			.mockReturnValueOnce(0)
			.mockReturnValueOnce(5)
			.mockReturnValueOnce(10)
			.mockReturnValueOnce(15);

		previewPerfBeginFrame();
		previewPerfEndFrame({ dropped: true, coalesced: true });
		previewPerfBeginFrame();
		previewPerfEndFrame({ coalesced: 3 });
		previewPerfMarkDropped(2);
		previewPerfMarkCoalesced(2);

		const stats = getPreviewPerfRollingStats();
		expect(stats.droppedFrames).toBe(3);
		expect(stats.coalescedFrames).toBe(6);
		expect(stats.last?.coalescedFrames).toBe(3);
	});

	it("collects optional counters and explicit DOM/resource snapshots", () => {
		vi.spyOn(performance, "now").mockReturnValue(123);

		previewPerfMarkWaveformPaint();
		previewPerfMarkWaveformPaint(2);
		previewPerfMarkSceneCacheHit(4);
		const snapshot = previewPerfSnapshotDomResources({
			domNodes: 250,
			resourceCount: 12,
		});

		expect(snapshot).toEqual({ t: 123, domNodes: 250, resourceCount: 12 });
		expect(getPreviewPerfRollingStats()).toMatchObject({
			waveformPaints: 3,
			sceneCacheHits: 4,
			domResourceSnapshot: snapshot,
		});
	});

	it("does not collect while disabled", () => {
		setPreviewPerfEnabled(false);
		previewPerfMarkWaveformPaint();
		previewPerfMarkSceneCacheHit();
		previewPerfBeginFrame();
		previewPerfEndFrame({ dropped: true, coalesced: true });

		expect(getPreviewPerfRollingStats()).toMatchObject({
			count: 0,
			waveformPaints: 0,
			sceneCacheHits: 0,
			droppedFrames: 0,
			coalescedFrames: 0,
		});
	});
});
