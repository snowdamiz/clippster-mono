import { describe, expect, it } from "vitest";
import type { TimelineTrack, VideoElement } from "../../types/timeline";
import { canUseFastVideoExport } from "../../renderer/export-routing";

function simpleTrack(): TimelineTrack {
	const element = {
		id: "video",
		type: "video",
		name: "Video",
		mediaId: "media",
		startTime: 0,
		duration: 5,
		trimStart: 0,
		trimEnd: 0,
		opacity: 1,
		speed: 1,
		reversed: false,
		fadeIn: 0,
		fadeOut: 0,
		hidden: false,
		muted: false,
		transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
	} as VideoElement;
	return {
		id: "main",
		type: "video",
		name: "Main",
		isMain: true,
		hidden: false,
		muted: false,
		locked: false,
		elements: [element],
	} as TimelineTrack;
}

const black = { type: "color" as const, color: "#000000" };

describe("canUseFastVideoExport", () => {
	it("keeps only a single untouched main clip on the fast path", () => {
		expect(canUseFastVideoExport({
			tracks: [simpleTrack()],
			sceneTransitions: [],
			canvasSourceFraming: null,
			background: black,
		})).toBe(true);
	});

	it("uses the shared scene renderer for transitions and visual edits", () => {
		const track = simpleTrack();
		expect(canUseFastVideoExport({
			tracks: [track],
			sceneTransitions: [{
				id: "transition",
				type: "crossfade",
				duration: 0.5,
				targetElementId: "video",
				trackId: track.id,
			}],
			canvasSourceFraming: null,
			background: black,
		})).toBe(false);

		(track.elements[0] as VideoElement).opacity = 0.8;
		expect(canUseFastVideoExport({
			tracks: [track],
			sceneTransitions: [],
			canvasSourceFraming: null,
			background: black,
		})).toBe(false);
	});

	it("uses the shared scene renderer for overlays or non-black backgrounds", () => {
		const overlayTrack = {
			id: "text",
			type: "text",
			hidden: false,
			elements: [{ id: "text", type: "text", hidden: false }],
		} as unknown as TimelineTrack;
		expect(canUseFastVideoExport({
			tracks: [simpleTrack(), overlayTrack],
			sceneTransitions: [],
			canvasSourceFraming: null,
			background: black,
		})).toBe(false);
		expect(canUseFastVideoExport({
			tracks: [simpleTrack()],
			sceneTransitions: [],
			canvasSourceFraming: null,
			background: { type: "color", color: "#ffffff" },
		})).toBe(false);
	});
});
