import { describe, expect, it } from "vitest";
import { getSceneFrameTime, packEncodedFrameBatch } from "./scene-frame-export";
import { getSceneTracksForExport } from "./scene-export-tracks";
import { getRenderFrame } from "./frame-policy";
import type { TimelineTrack } from "../types/timeline";

describe("getSceneTracksForExport", () => {
	it("drops audio-only elements and empty audio tracks", () => {
		const tracks = [
			{
				id: "v1",
				type: "video",
				isMain: true,
				elements: [
					{ id: "e1", type: "video", startTime: 0, duration: 5, mediaId: "m1" } as any,
				],
			},
			{
				id: "a1",
				type: "audio",
				elements: [{ id: "ae", type: "audio", startTime: 0, duration: 5, mediaId: "m2" } as any],
			},
		] as unknown as TimelineTrack[];

		const out = getSceneTracksForExport(tracks);
		expect(out.find((t) => t.id === "v1")?.elements.length).toBe(1);
		expect(out.find((t) => t.id === "a1")).toBeUndefined();
	});

	it("samples the same quantized timeline frame as preview", () => {
		const exportTime = getSceneFrameTime({
			frameIndex: 10,
			fps: 30,
			exportDuration: 5,
			timeOffset: 2.017,
			sceneDuration: 10,
		});
		const previewFrame = getRenderFrame({
			time: 2.017 + 10 / 30,
			fps: 30,
			duration: 10,
		});

		expect(exportTime).toBe(previewFrame.time);
	});

	it("packs encoded frames without JSON byte expansion", () => {
		const payload = packEncodedFrameBatch([
			new Uint8Array([1, 2, 3]),
			new Uint8Array([9, 8]),
		]);
		expect(Array.from(payload)).toEqual([
			3, 0, 0, 0, 1, 2, 3,
			2, 0, 0, 0, 9, 8,
		]);
	});
});
