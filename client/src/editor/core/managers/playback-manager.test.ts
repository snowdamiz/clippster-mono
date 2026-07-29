import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EditorCore } from "../../core";
import { PlaybackManager } from "./playback-manager";

describe("PlaybackManager readiness barrier", () => {
	beforeEach(() => {
		vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
		vi.stubGlobal("cancelAnimationFrame", vi.fn());
		vi.stubGlobal("window", { dispatchEvent: vi.fn() });
		vi.stubGlobal(
			"CustomEvent",
			class {
				constructor(
					public type: string,
					public init?: { detail?: unknown },
				) {}
			},
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	function createManager() {
		return new PlaybackManager({
			timeline: { getTotalDuration: () => 10 },
		} as unknown as EditorCore);
	}

	it("does not start the media clock until preview frames are ready", async () => {
		const manager = createManager();
		let release!: () => void;
		manager.onBeforePlay(
			() =>
				new Promise<void>((resolve) => {
					release = resolve;
				}),
		);

		const playing = manager.play();
		expect(manager.getIsPlaying()).toBe(false);
		release();
		await playing;

		expect(manager.getIsPlaying()).toBe(true);
	});

	it("cancels pending playback preparation when paused", async () => {
		const manager = createManager();
		let release!: () => void;
		manager.onBeforePlay(
			() =>
				new Promise<void>((resolve) => {
					release = resolve;
				}),
		);

		const playing = manager.play();
		manager.pause();
		release();
		await playing;

		expect(manager.getIsPlaying()).toBe(false);
	});
});
