import { describe, expect, it } from "vitest";
import { BaseNode } from "./base-node";
import { TransitionNode } from "./transition-node";
import { VideoNode } from "./video-node";

function sourceTime(node: VideoNode, time: number): number {
	return (node as unknown as { getSourceTime: (time: number) => number }).getSourceTime(time);
}

describe("transition playback mapping", () => {
	it("does not shift the incoming clip source time after adding pre-roll", () => {
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

		expect(sourceTime(node, 9.75)).toBeCloseTo(4.75, 5);
		expect(sourceTime(node, 10)).toBeCloseTo(5, 5);
		expect(sourceTime(node, 10.25)).toBeCloseTo(5.25, 5);
	});

	it("keeps widened outgoing and incoming decode clocks monotonic", () => {
		const node = new TransitionNode({
			type: "crossfade",
			duration: 0.5,
			junctionTime: 10,
			sampleSpread: 1.75,
		});
		node.outgoingNode = new BaseNode({ timeOffset: 8, duration: 2 });
		node.incomingNode = new BaseNode({ timeOffset: 10, duration: 2 });
		const decodeTimes = (node as unknown as {
			getTransitionLayerDecodeTimes: (time: number) => {
				outgoingTime: number;
				incomingTime: number;
			};
		}).getTransitionLayerDecodeTimes.bind(node);

		const samples = [9.75, 10, 10.249].map(decodeTimes);
		expect(samples[1].outgoingTime).toBeGreaterThan(samples[0].outgoingTime);
		expect(samples[2].outgoingTime).toBeGreaterThan(samples[1].outgoingTime);
		expect(samples.map((sample) => sample.incomingTime)).toEqual([9.75, 10, 10.249]);
	});
});
