import { describe, expect, it } from "vitest";
import type { VideoElement, VideoTrack } from "../../types/timeline";
import { collapseMainVideoTrackGaps } from "./main-track-layout";

function makeMainTrack(
	elements: Array<{ id: string; startTime: number; duration: number }>,
): VideoTrack {
	return {
		id: "main",
		type: "video",
		name: "Main",
		isMain: true,
		muted: false,
		hidden: false,
		elements: elements.map(
			(el): VideoElement => ({
				id: el.id,
				type: "video",
				name: el.id,
				startTime: el.startTime,
				duration: el.duration,
				trimStart: 0,
				trimEnd: 0,
				mediaId: "media-1",
				transform: { position: { x: 0, y: 0 }, scale: 1, rotate: 0 },
				opacity: 1,
			}),
		),
	};
}

function deleteFromMainTrack({
	track,
	deleteIds,
	collapseGaps,
	fps = 30,
}: {
	track: VideoTrack;
	deleteIds: string[];
	collapseGaps: boolean;
	fps?: number;
}): VideoTrack {
	const filtered: VideoTrack = {
		...track,
		elements: track.elements.filter((element) => !deleteIds.includes(element.id)),
	};
	return collapseGaps
		? (collapseMainVideoTrackGaps(filtered, fps) as VideoTrack)
		: filtered;
}

describe("main-track delete ripple", () => {
	it("deleting one middle segment preserves neighbors when gaps collapse once", () => {
		const track = makeMainTrack([
			{ id: "s1", startTime: 0, duration: 10 },
			{ id: "s2", startTime: 10, duration: 10 },
			{ id: "s3", startTime: 20, duration: 10 },
			{ id: "s4", startTime: 30, duration: 10 },
		]);

		const result = deleteFromMainTrack({ track, deleteIds: ["s3"], collapseGaps: true });

		expect(result.elements.map((el) => el.id)).toEqual(["s1", "s2", "s4"]);
		expect(result.elements.map((el) => el.startTime)).toEqual([0, 10, 20]);
	});

	it("does not collapse when main-track magnet is off", () => {
		const track = makeMainTrack([
			{ id: "s1", startTime: 0, duration: 10 },
			{ id: "s2", startTime: 10, duration: 10 },
			{ id: "s3", startTime: 20, duration: 10 },
			{ id: "s4", startTime: 30, duration: 10 },
		]);

		const result = deleteFromMainTrack({ track, deleteIds: ["s3"], collapseGaps: false });

		expect(result.elements.map((el) => el.id)).toEqual(["s1", "s2", "s4"]);
		expect(result.elements.map((el) => el.startTime)).toEqual([0, 10, 30]);
	});

	it("simulated double ripple overlaps the left neighbor before repacking", () => {
		const track = makeMainTrack([
			{ id: "s1", startTime: 0, duration: 10 },
			{ id: "s2", startTime: 10, duration: 10 },
			{ id: "s3", startTime: 20, duration: 10 },
			{ id: "s4", startTime: 30, duration: 10 },
		]);

		const once = deleteFromMainTrack({ track, deleteIds: ["s3"], collapseGaps: true });
		const gapStart = 20;
		const gapDuration = 10;
		const shifted = {
			...once,
			elements: once.elements.map((el) =>
				el.startTime >= gapStart
					? { ...el, startTime: Math.max(0, el.startTime - gapDuration) }
					: el,
			),
		};

		const s2 = shifted.elements.find((el) => el.id === "s2");
		const s4 = shifted.elements.find((el) => el.id === "s4");
		expect(s2?.startTime).toBe(10);
		expect(s4?.startTime).toBe(10);
		expect(s2?.startTime).toBe(s4?.startTime);
	});
});
