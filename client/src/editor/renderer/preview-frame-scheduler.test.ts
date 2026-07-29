import { describe, expect, it, vi } from "vitest";
import type { RootNode } from "./nodes/root-node";
import {
	PreviewFrameScheduler,
	type PreviewFrameRequest,
} from "./preview-frame-scheduler";

const tree = {} as RootNode;

function request(
	frameIndex: number,
	mode: PreviewFrameRequest["mode"] = "playback",
): PreviewFrameRequest {
	return { frameIndex, time: frameIndex / 30, tree, mode };
}

async function flushTasks() {
	await Promise.resolve();
	await Promise.resolve();
}

describe("PreviewFrameScheduler", () => {
	it("coalesces late playback to the newest frame and rejects stale presentation", async () => {
		let releaseFirst!: () => void;
		const first = new Promise<void>((resolve) => {
			releaseFirst = resolve;
		});
		const rendered: number[] = [];
		const presented: number[] = [];
		const render = vi.fn(async (frame: PreviewFrameRequest) => {
			rendered.push(frame.frameIndex);
			if (frame.frameIndex === 1) await first;
		});
		const scheduler = new PreviewFrameScheduler({
			render,
			onPresented: (frame) => presented.push(frame.frameIndex),
		});

		scheduler.request(request(1));
		scheduler.request(request(2));
		scheduler.request(request(4));
		releaseFirst();
		await flushTasks();

		expect(rendered).toEqual([1, 4]);
		expect(presented).toEqual([4]);
	});

	it("lets an exact seek supersede playback work", async () => {
		let releasePlayback!: () => void;
		const playback = new Promise<void>((resolve) => {
			releasePlayback = resolve;
		});
		const presented: number[] = [];
		const scheduler = new PreviewFrameScheduler({
			render: async (frame) => {
				if (frame.frameIndex === 1) await playback;
			},
			onPresented: (frame) => presented.push(frame.frameIndex),
		});

		scheduler.request(request(1));
		scheduler.request(request(20, "exact"));
		releasePlayback();
		await flushTasks();

		expect(presented).toEqual([20]);
	});

	it("does not present work after disposal", async () => {
		let release!: () => void;
		const work = new Promise<void>((resolve) => {
			release = resolve;
		});
		const presented = vi.fn();
		const scheduler = new PreviewFrameScheduler({
			render: async () => work,
			onPresented: presented,
		});

		scheduler.request(request(1));
		scheduler.dispose();
		release();
		await flushTasks();

		expect(presented).not.toHaveBeenCalled();
	});

	it("keeps the last presented canvas when realtime composition is not ready", async () => {
		const presented = vi.fn();
		const onError = vi.fn();
		const error = new Error("frame not ready");
		const scheduler = new PreviewFrameScheduler({
			render: async () => {
				throw error;
			},
			onPresented: presented,
			onError,
		});

		scheduler.request(request(5));
		await flushTasks();

		expect(presented).not.toHaveBeenCalled();
		expect(onError).toHaveBeenCalledWith(error);
	});
});
