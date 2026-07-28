import { afterEach, describe, expect, it, vi } from "vitest";
import { BaseNode } from "./base-node";
import { getTransitionOutgoingExtraTail, getTransitionSampleTimes, TransitionNode } from "./transition-node";
import { canReuseLastDecodedFrame, VideoNode } from "./video-node";
import { buildScene } from "../scene-builder";
import type { TimelineTrack, VideoElement } from "../../types/timeline";
import type { CanvasRenderer } from "../canvas-renderer";
import { videoCache } from "../../video-cache/service";

function sourceTime(node: VideoNode, time: number): number {
	return (node as unknown as { getSourceTime: (time: number) => number }).getSourceTime(time);
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("transition playback mapping", () => {
	it("advances incoming source time throughout transition pre-roll", () => {
		const node = new VideoNode({
			url: "",
			file: new File(["video"], "clip.mp4", { type: "video/mp4" }),
			mediaId: "media",
			elementId: "incoming",
			duration: 2,
			timeOffset: 10,
			trimStart: 5,
			trimEnd: 0,
			speed: 1,
		});
		node.setTransitionExtension({ before: 0.5, after: 0.5 });

		expect(sourceTime(node, 9.75)).toBeCloseTo(5.25, 5);
		expect(sourceTime(node, 10)).toBeCloseTo(5.5, 5);
		expect(sourceTime(node, 10.25)).toBeCloseTo(5.75, 5);
	});

	it("keeps incoming source mapping monotonic through and after the transition", () => {
		const node = new VideoNode({
			url: "",
			file: new File(["video"], "clip.mp4", { type: "video/mp4" }),
			mediaId: "media",
			elementId: "incoming",
			duration: 3,
			timeOffset: 10,
			trimStart: 5,
			trimEnd: 0,
			speed: 1,
		});
		node.setTransitionExtension({ before: 0.5 });
		const samples = [9.5, 9.75, 10, 10.25, 10.5, 11].map((time) =>
			sourceTime(node, time),
		);

		for (let i = 1; i < samples.length; i++) {
			expect(samples[i]).toBeGreaterThan(samples[i - 1]);
		}
	});

	it("decodes the current realtime sample so frames advance with the clock", async () => {
		const node = new VideoNode({
			url: "",
			file: new File(["video"], "missing-frame.mp4", { type: "video/mp4" }),
			mediaId: "missing-media",
			elementId: "missing-frame",
			duration: 2,
			timeOffset: 0,
			trimStart: 0,
			trimEnd: 0,
			speed: 1,
		});
		const renderer = {
			framePolicy: "realtime",
			fps: 30,
		} as CanvasRenderer;
		const getFrame = vi.spyOn(videoCache, "getFrameAt").mockResolvedValue({
			canvas: {} as HTMLCanvasElement,
			timestamp: 0,
			duration: 1 / 30,
		});
		const request = vi.spyOn(videoCache, "requestPreviewFrame").mockImplementation(() => {});

		await node.prefetch({ renderer, time: 0 });

		expect(getFrame).toHaveBeenCalledOnce();
		// Live playback must not also queue async work on the same sink.
		expect(request).not.toHaveBeenCalled();
	});

	it("prewarms a cold decoder before an ordinary segment cut", async () => {
		const node = new VideoNode({
			url: "",
			file: new File(["video"], "second.mp4", { type: "video/mp4" }),
			mediaId: "second-media",
			elementId: "second",
			decodeKey: "second-decoder",
			prewarmBeforeStart: true,
			duration: 2,
			timeOffset: 10,
			trimStart: 0,
			trimEnd: 0,
			speed: 1,
		});
		const peek = vi
			.spyOn(videoCache, "peekPreviewFrame")
			.mockReturnValue(null);
		const request = vi
			.spyOn(videoCache, "requestPreviewFrame")
			.mockImplementation(() => {});

		await node.prefetch({
			renderer: { framePolicy: "realtime", fps: 30 } as CanvasRenderer,
			time: 9.25,
		});

		expect(peek).toHaveBeenCalledOnce();
		expect(request).toHaveBeenCalledTimes(2);
	});

	it("keeps widened outgoing and incoming decode clocks monotonic", () => {
		const timing = {
			duration: 0.5,
			junctionTime: 10,
			sampleSpread: 1.75,
		};

		const samples = [9.75, 10, 10.249].map((time) =>
			getTransitionSampleTimes({ ...timing, time }),
		);
		expect(samples[1].outgoingTime).toBeGreaterThan(samples[0].outgoingTime);
		expect(samples[2].outgoingTime).toBeGreaterThan(samples[1].outgoingTime);
		expect(samples.map((sample) => sample.incomingTime)).toEqual([9.75, 10, 10.249]);
	});

	it("covers sampleSpread with the outgoing transition extension so source time keeps advancing", () => {
		const duration = 0.5;
		const sampleSpread = 1.75;
		const junctionTime = 10;
		const halfDuration = duration / 2;
		const slack = 1 / 30;
		const outgoingSampleTail = getTransitionOutgoingExtraTail({ duration, sampleSpread });
		const after = halfDuration + slack + outgoingSampleTail;

		const node = new VideoNode({
			url: "",
			file: new File(["video"], "clip.mp4", { type: "video/mp4" }),
			mediaId: "media",
			elementId: "outgoing",
			duration: 1,
			timeOffset: junctionTime - 1,
			trimStart: 0,
			trimEnd: 0,
			speed: 1,
		});
		node.setTransitionExtension({ after });

		const samples = [9.75, 10, 10.2, 10.249].map((time) => {
			const { outgoingTime } = getTransitionSampleTimes({
				time,
				duration,
				junctionTime,
				sampleSpread,
			});
			return sourceTime(node, outgoingTime);
		});

		for (let i = 1; i < samples.length; i++) {
			expect(samples[i]).toBeGreaterThan(samples[i - 1]);
		}
	});

	it("uses separate decode sinks for both sides of a same-source transition", () => {
		const base = {
			type: "video" as const,
			name: "clip",
			duration: 1,
			trimEnd: 0,
			mediaId: "media",
			opacity: 1,
			speed: 1,
			muted: false,
			hidden: false,
			reversed: false,
			transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
		};
		const outgoing: VideoElement = {
			...base,
			id: "outgoing",
			startTime: 0,
			trimStart: 0,
		};
		const incoming: VideoElement = {
			...base,
			id: "incoming",
			startTime: 1,
			trimStart: 1,
		};
		const track = {
			id: "track",
			type: "video",
			name: "Main",
			isMain: true,
			muted: false,
			hidden: false,
			locked: false,
			elements: [outgoing, incoming],
		} as TimelineTrack;
		const tree = buildScene({
			tracks: [track],
			mediaAssets: [{
				id: "media",
				name: "clip.mp4",
				type: "video",
				file: new File(["video"], "clip.mp4", { type: "video/mp4" }),
			}],
			duration: 2,
			canvasSize: { width: 1280, height: 720 },
			background: { type: "color", color: "#000" },
			transitions: [{
				id: "transition",
				type: "crossfade",
				duration: 0.5,
				targetElementId: incoming.id,
				trackId: track.id,
			}],
		});
		const transition = tree.children.find((child) => child instanceof TransitionNode) as TransitionNode;
		const outgoingKey = (transition.outgoingNode as VideoNode).params.decodeKey;
		const incomingKey = (transition.incomingNode as VideoNode).params.decodeKey;

		expect(outgoingKey).toBeTruthy();
		expect(incomingKey).toBeTruthy();
		expect(incomingKey).not.toBe(outgoingKey);
	});

	it("marks only non-continuous segment decoders for cut prewarming", () => {
		const makeElement = (
			id: string,
			mediaId: string,
			startTime: number,
			trimStart: number,
		): VideoElement => ({
			id,
			type: "video",
			name: id,
			mediaId,
			startTime,
			duration: 1,
			trimStart,
			trimEnd: 0,
			opacity: 1,
			speed: 1,
			muted: false,
			hidden: false,
			reversed: false,
			transform: {
				scale: 1,
				position: { x: 0, y: 0 },
				rotate: 0,
			},
		});
		const first = makeElement("first", "media-a", 0, 0);
		const continuous = makeElement("continuous", "media-a", 1, 1);
		const cold = makeElement("cold", "media-b", 2, 0);
		const tree = buildScene({
			tracks: [{
				id: "main",
				type: "video",
				name: "Main",
				isMain: true,
				hidden: false,
				muted: false,
				locked: false,
				elements: [first, continuous, cold],
			} as TimelineTrack],
			mediaAssets: [
				{
					id: "media-a",
					name: "a.mp4",
					type: "video",
					file: new File(["a"], "a.mp4"),
				},
				{
					id: "media-b",
					name: "b.mp4",
					type: "video",
					file: new File(["b"], "b.mp4"),
				},
			],
			duration: 3,
			canvasSize: { width: 1280, height: 720 },
			background: { type: "color", color: "#000" },
		});
		const nodes = tree.children.filter(
			(child): child is VideoNode => child instanceof VideoNode,
		);
		const byId = new Map(nodes.map((node) => [node.params.elementId, node]));

		expect(byId.get("first")?.params.prewarmBeforeStart).toBe(true);
		expect(byId.get("continuous")?.params.prewarmBeforeStart).toBe(false);
		expect(byId.get("cold")?.params.prewarmBeforeStart).toBe(true);
	});

	it("starts incoming prewarm without blocking the outgoing playback frame", async () => {
		let finishPrewarm!: () => void;
		const prewarm = new Promise<void>((resolve) => {
			finishPrewarm = resolve;
		});
		const incoming = new BaseNode();
		incoming.prefetch = vi.fn(() => prewarm);
		const outgoing = new BaseNode();
		outgoing.prefetch = vi.fn(async () => {});
		const node = new TransitionNode({
			type: "crossfade",
			duration: 1,
			junctionTime: 10,
		});
		node.outgoingNode = outgoing;
		node.incomingNode = incoming;

		await node.prefetch({ renderer: {} as never, time: 9.1 });
		expect(incoming.prefetch).toHaveBeenCalledOnce();

		let transitionReady = false;
		const firstTransitionFrame = node
			.prefetch({ renderer: {} as never, time: 9.6 })
			.then(() => {
				transitionReady = true;
			});
		await Promise.resolve();
		expect(transitionReady).toBe(false);

		finishPrewarm();
		await firstTransitionFrame;
		expect(transitionReady).toBe(true);
	});

	it("does not stretch a stale decoded frame across segment playback", () => {
		expect(canReuseLastDecodedFrame({
			frameTimestamp: 10,
			frameDuration: 1 / 30,
			requestedTime: 10.02,
			fps: 30,
		})).toBe(true);
		expect(canReuseLastDecodedFrame({
			frameTimestamp: 10,
			frameDuration: 1 / 30,
			requestedTime: 10.1,
			fps: 30,
		})).toBe(false);
		expect(canReuseLastDecodedFrame({
			frameTimestamp: 10,
			frameDuration: 1 / 30,
			requestedTime: 9.99,
			fps: 30,
		})).toBe(false);
		// Huge decoder-reported durations must not freeze the first frame.
		expect(canReuseLastDecodedFrame({
			frameTimestamp: 0,
			frameDuration: 5,
			requestedTime: 0.2,
			fps: 30,
		})).toBe(false);
	});
});
