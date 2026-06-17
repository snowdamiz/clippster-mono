import { describe, it, expect } from "vitest";
import {
	computeSceneInputFingerprint,
	fingerprintTimelineElement,
} from "./scene-input-fingerprint";
import type { TextElement, TimelineTrack, VideoElement } from "../types/timeline";
import type { MediaAsset } from "../types/assets";
import type { Transition } from "../types/transitions";
import type { TBackground, TCanvasSize } from "../types/project";

const canvasSize: TCanvasSize = { width: 1920, height: 1080 };
const background: TBackground = { type: "color", color: "#000000" };
const mediaAssets: MediaAsset[] = [];

const baseParams = {
	mediaAssets,
	transitions: [] as Transition[],
	canvasSize,
	background,
	duration: 10,
};

function makeVideoTrack(video: VideoElement): TimelineTrack {
	return {
		id: "track-v1",
		type: "video",
		name: "Main",
		isMain: true,
		muted: false,
		hidden: false,
		locked: false,
		elements: [video],
	};
}

describe("computeSceneInputFingerprint", () => {
	it("changes when only video transform changes", () => {
		const videoA: VideoElement = {
			id: "el-1",
			type: "video",
			name: "Clip",
			duration: 5,
			startTime: 0,
			trimStart: 0,
			trimEnd: 0,
			mediaId: "media-1",
			transform: { position: { x: 0, y: 0 }, scale: 1, rotate: 0 },
			opacity: 1,
		};
		const videoB: VideoElement = {
			...videoA,
			transform: { position: { x: 120, y: -40 }, scale: 1, rotate: 0 },
		};

		const fpA = computeSceneInputFingerprint({
			...baseParams,
			tracks: [makeVideoTrack(videoA)],
		});
		const fpB = computeSceneInputFingerprint({
			...baseParams,
			tracks: [makeVideoTrack(videoB)],
		});

		expect(fpA).not.toBe(fpB);
	});

	it("is stable for identical video payloads", () => {
		const v: VideoElement = {
			id: "el-1",
			type: "video",
			name: "Clip",
			duration: 5,
			startTime: 0,
			trimStart: 0,
			trimEnd: 0,
			mediaId: "media-1",
			transform: { position: { x: 5, y: 5 }, scale: 1, rotate: 15 },
			opacity: 1,
			crop: { top: 0, right: 0, bottom: 0, left: 0 },
		};
		const fp1 = computeSceneInputFingerprint({
			...baseParams,
			tracks: [makeVideoTrack(v)],
		});
		const fp2 = computeSceneInputFingerprint({
			...baseParams,
			tracks: [makeVideoTrack({ ...v })],
		});
		expect(fp1).toBe(fp2);
	});
});

describe("fingerprintTimelineElement", () => {
	it("includes transform for video elements", () => {
		const v: VideoElement = {
			id: "e",
			type: "video",
			name: "n",
			duration: 1,
			startTime: 0,
			trimStart: 0,
			trimEnd: 0,
			mediaId: "m",
			transform: { position: { x: 1, y: 2 }, scale: 0.5, rotate: 3 },
			opacity: 0.9,
		};
		const fp = fingerprintTimelineElement(v) as { transform: typeof v.transform };
		expect(fp.transform.position.x).toBe(1);
		expect(fp.transform.scale).toBe(0.5);
	});

	it("includes text background styling used by preview and export", () => {
		const text: TextElement = {
			id: "t",
			type: "text",
			name: "Text",
			content: "Hello",
			duration: 1,
			startTime: 0,
			trimStart: 0,
			trimEnd: 0,
			fontSize: 48,
			fontFamily: "Inter",
			color: "#ffffff",
			backgroundColor: "#3882f6",
			textAlign: "center",
			fontWeight: "500",
			fontStyle: "normal",
			textDecoration: "none",
			letterSpacing: 0,
			lineHeight: 1.2,
			textCase: "none",
			bubbleStyle: "rounded",
			bubbleColor: "#3882f6",
			bubbleOpacity: 1,
			transform: { position: { x: 0, y: 0 }, scale: 1, rotate: 0 },
			opacity: 1,
		};

		const fp = fingerprintTimelineElement(text) as {
			backgroundColor: string;
			bubbleColor: string;
			bubbleOpacity: number;
		};
		expect(fp.backgroundColor).toBe("#3882f6");
		expect(fp.bubbleColor).toBe("#3882f6");
		expect(fp.bubbleOpacity).toBe(1);
	});
});
