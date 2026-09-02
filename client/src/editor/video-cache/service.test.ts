import { afterEach, describe, expect, it, vi } from "vitest";
import {
	VideoCache,
	canHoldExhaustedFrame,
	canUseNearestForwardFrame,
	shouldDecodeSequentially,
	type StablePreviewFrame,
} from "./service";

describe("video cache catch-up policy", () => {
	it("continues sequential decoding for ordinary adjacent preview frames", () => {
		expect(shouldDecodeSequentially({ lastTime: 10, targetTime: 10.04 })).toBe(true);
		expect(shouldDecodeSequentially({ lastTime: 10, targetTime: 10.25 })).toBe(true);
		expect(shouldDecodeSequentially({ lastTime: 10, targetTime: 11.5 })).toBe(true);
	});

	it("seeks instead of decoding every frame after the renderer falls behind", () => {
		expect(shouldDecodeSequentially({ lastTime: 10, targetTime: 12.01 })).toBe(false);
		expect(shouldDecodeSequentially({ lastTime: 10, targetTime: 15 })).toBe(false);
	});

	it("seeks when playback moves backward", () => {
		expect(shouldDecodeSequentially({ lastTime: 10, targetTime: 9.9 })).toBe(false);
	});

	it("holds an exhausted frame for one frame, not half a second", () => {
		expect(canHoldExhaustedFrame({
			frameTimestamp: 10,
			frameDuration: 1 / 30,
			targetTime: 10 + 2 / 30,
		})).toBe(true);
		expect(canHoldExhaustedFrame({
			frameTimestamp: 10,
			frameDuration: 1 / 30,
			targetTime: 10.1,
		})).toBe(false);
	});

	it("allows a nearby post-seek frame but not a far keyframe smear", () => {
		expect(canUseNearestForwardFrame({
			frameTimestamp: 10 + 1 / 30,
			targetTime: 10,
		})).toBe(true);
		expect(canUseNearestForwardFrame({
			frameTimestamp: 10 + 2 / 30,
			targetTime: 10,
		})).toBe(true);
		expect(canUseNearestForwardFrame({
			frameTimestamp: 10.1,
			targetTime: 10,
		})).toBe(false);
		expect(canUseNearestForwardFrame({
			frameTimestamp: 9.99,
			targetTime: 10,
		})).toBe(false);
	});
});

describe("bounded preview frames", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("copies pooled decoder canvases and retains at most three frames per sink", () => {
		class FakeCanvas {
			width: number;
			height: number;
			drawImage = vi.fn();

			constructor(width: number, height: number) {
				this.width = width;
				this.height = height;
			}

			getContext() {
				return { drawImage: this.drawImage };
			}
		}
		vi.stubGlobal("OffscreenCanvas", FakeCanvas);
		const cache = new VideoCache();
		const internals = cache as unknown as {
			storeStablePreviewFrame(args: {
				sinkKey: string;
				frame: {
					canvas: FakeCanvas;
					timestamp: number;
					duration: number;
				};
				requestedTime: number;
			}): boolean;
			previewFrames: Map<string, StablePreviewFrame[]>;
		};
		const pooledSource = new FakeCanvas(640, 360);

		for (let i = 0; i < 5; i++) {
			internals.storeStablePreviewFrame({
				sinkKey: "clip",
				frame: {
					canvas: pooledSource,
					timestamp: i / 30,
					duration: 1 / 30,
				},
				requestedTime: i / 30,
			});
		}

		const frames = internals.previewFrames.get("clip") ?? [];
		expect(frames).toHaveLength(3);
		expect(frames.every((frame) => (frame.canvas as unknown) !== pooledSource)).toBe(true);
		expect(cache.getStats().previewFrames).toBe(3);
	});

	it("rejects caching a first frame under a later requested time", () => {
		class FakeCanvas {
			width: number;
			height: number;
			drawImage = vi.fn();

			constructor(width: number, height: number) {
				this.width = width;
				this.height = height;
			}

			getContext() {
				return { drawImage: this.drawImage };
			}
		}
		vi.stubGlobal("OffscreenCanvas", FakeCanvas);
		const cache = new VideoCache();
		const internals = cache as unknown as {
			storeStablePreviewFrame(args: {
				sinkKey: string;
				frame: {
					canvas: FakeCanvas;
					timestamp: number;
					duration: number;
				};
				requestedTime: number;
			}): boolean;
			previewFrames: Map<string, StablePreviewFrame[]>;
		};

		const stored = internals.storeStablePreviewFrame({
			sinkKey: "clip",
			frame: {
				canvas: new FakeCanvas(64, 64),
				timestamp: 0,
				duration: 1 / 30,
			},
			// Cold start returned frame 0 for a request at 200ms — must not cache.
			requestedTime: 0.2,
		});

		expect(stored).toBe(false);
		expect(internals.previewFrames.get("clip") ?? []).toHaveLength(0);
	});

	it("peeks by media timestamp coverage, not request labels", () => {
		class FakeCanvas {
			width: number;
			height: number;
			drawImage = vi.fn();

			constructor(width: number, height: number) {
				this.width = width;
				this.height = height;
			}

			getContext() {
				return { drawImage: this.drawImage };
			}
		}
		vi.stubGlobal("OffscreenCanvas", FakeCanvas);
		const cache = new VideoCache();
		const internals = cache as unknown as {
			storeStablePreviewFrame(args: {
				sinkKey: string;
				frame: {
					canvas: FakeCanvas;
					timestamp: number;
					duration: number;
				};
				requestedTime: number;
			}): boolean;
		};

		internals.storeStablePreviewFrame({
			sinkKey: "clip",
			frame: {
				canvas: new FakeCanvas(64, 64),
				timestamp: 0,
				duration: 1 / 30,
			},
			requestedTime: 0,
		});

		expect(cache.peekPreviewFrame({ sinkKey: "clip", time: 0, fps: 30 })).not.toBeNull();
		expect(cache.peekPreviewFrame({ sinkKey: "clip", time: 0.2, fps: 30 })).toBeNull();
	});

	it("limits preview decoding to three concurrent jobs", async () => {
		const cache = new VideoCache();
		const internals = cache as unknown as {
			withPreviewDecodeSlot<T>(task: () => Promise<T>): Promise<T>;
		};
		const releases: Array<() => void> = [];
		let active = 0;
		let peak = 0;
		const job = () =>
			internals.withPreviewDecodeSlot(
				() =>
					new Promise<void>((resolve) => {
						active += 1;
						peak = Math.max(peak, active);
						releases.push(() => {
							active -= 1;
							resolve();
						});
					}),
			);

		const jobs = [job(), job(), job(), job()];
		await Promise.resolve();
		expect(active).toBe(3);
		releases.shift()?.();
		await Promise.resolve();
		await Promise.resolve();
		expect(peak).toBe(3);
		while (releases.length) releases.shift()?.();
		await Promise.all(jobs);
	});

	it("coalesces each sink to one active and one newest pending request", () => {
		const cache = new VideoCache();
		const internals = cache as unknown as {
			startPreviewRequest(
				sinkKey: string,
				state: { active: boolean; pending: { time: number } | null },
				request: { time: number },
			): void;
			previewRequests: Map<
				string,
				{ active: boolean; pending: { time: number } | null }
			>;
		};
		vi.spyOn(internals, "startPreviewRequest").mockImplementation(
			(_sinkKey, state) => {
				state.active = true;
			},
		);
		const file = new File(["video"], "clip.mp4");

		cache.requestPreviewFrame({ sinkKey: "clip", file, time: 1 });
		cache.requestPreviewFrame({ sinkKey: "clip", file, time: 1.1 });
		cache.requestPreviewFrame({ sinkKey: "clip", file, time: 2 });

		expect(internals.previewRequests.get("clip")).toMatchObject({
			active: true,
			pending: { time: 2 },
		});
		expect(cache.getStats().pendingPreviewRequests).toBe(2);
	});

	it("never substitutes a future prepared frame", () => {
		const cache = new VideoCache();
		const internals = cache as unknown as {
			previewFrames: Map<string, StablePreviewFrame[]>;
		};
		const canvas = {} as StablePreviewFrame["canvas"];
		internals.previewFrames.set("clip", [
			{ canvas, timestamp: 1, duration: 1 / 30, requestedTime: 1 },
			{
				canvas,
				timestamp: 1 + 1 / 30,
				duration: 1 / 30,
				requestedTime: 1 + 1 / 30,
			},
		]);

		expect(
			cache.peekPreviewFrame({ sinkKey: "clip", time: 1.01, fps: 30 })
				?.requestedTime,
		).toBe(1);
	});

	it("evicts the least-recently-used inactive sink above the global cap", () => {
		const cache = new VideoCache();
		const dispose = vi.fn();
		const internals = cache as unknown as {
			sinks: Map<string, unknown>;
			touchSink(sinkKey: string): void;
		};
		for (let i = 0; i < 7; i++) {
			internals.sinks.set(`sink-${i}`, {
				input: { dispose },
				iterator: null,
				currentFrame: null,
			});
			internals.touchSink(`sink-${i}`);
		}

		expect(cache.getStats().totalSinks).toBe(6);
		expect(internals.sinks.has("sink-0")).toBe(false);
		expect(dispose).toHaveBeenCalledOnce();
	});

	it("does not evict sinks while an export session is active", () => {
		const cache = new VideoCache();
		const dispose = vi.fn();
		const internals = cache as unknown as {
			sinks: Map<string, unknown>;
			touchSink(sinkKey: string): void;
		};
		cache.beginExportSession();
		for (let i = 0; i < 7; i++) {
			internals.sinks.set(`export-sink-${i}`, {
				input: { dispose },
				iterator: null,
				currentFrame: null,
			});
			internals.touchSink(`export-sink-${i}`);
		}

		expect(cache.getStats().totalSinks).toBe(7);
		expect(dispose).not.toHaveBeenCalled();
		cache.endExportSession();
	});
});
