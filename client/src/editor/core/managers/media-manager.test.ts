import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaAsset } from "../../types/assets";

const { hydrateMediaAsset } = vi.hoisted(() => ({
	hydrateMediaAsset: vi.fn(),
}));

vi.mock("../../storage/service", () => ({
	storageService: {
		hydrateMediaAsset,
	},
}));
vi.mock("../../video-cache/service", () => ({
	videoCache: { clearAll: vi.fn() },
}));
vi.mock("../../services/filmstrip-service", () => ({
	filmstripService: { clearAll: vi.fn(), clearMedia: vi.fn() },
}));
vi.mock("@/services/waveformService", () => ({
	waveformService: { loadAudio: vi.fn() },
}));
vi.mock("../../lib/timeline/heal-orphan-video-media", () => ({
	healOrphanVideoMediaReferences: vi.fn(),
}));

import { MediaManager } from "./media-manager";

describe("MediaManager lazy hydration", () => {
	beforeEach(() => hydrateMediaAsset.mockReset());

	it("deduplicates concurrent hydration for the same path-first asset", async () => {
		const placeholder = new File([], "clip.mp4", { type: "video/mp4" });
		const hydratedFile = new File(["video"], "clip.mp4", { type: "video/mp4" });
		const asset: MediaAsset = {
			id: "clip-1",
			name: "clip.mp4",
			type: "video",
			file: placeholder,
			filePath: "C:/media/clip.mp4",
			isHydrated: false,
		};
		hydrateMediaAsset.mockResolvedValue({
			...asset,
			file: hydratedFile,
			url: "blob:clip-1",
			isHydrated: true,
		});
		const editor = {
			timeline: { getTracks: () => [] },
		} as never;
		const manager = new MediaManager(editor);
		manager.setAssets({ assets: [asset] });

		const [first, second] = await Promise.all([
			manager.ensureAssetHydrated(asset.id),
			manager.ensureAssetHydrated(asset.id),
		]);

		expect(hydrateMediaAsset).toHaveBeenCalledTimes(1);
		expect(first?.file.size).toBeGreaterThan(0);
		expect(second).toBe(first);
		expect(manager.getAssets()[0]?.isHydrated).toBe(true);
	});

	it("replaceAssetRaster swaps the file and notifies listeners", () => {
		const original = new File(["old"], "layer.png", { type: "image/png" });
		const next = new File(["new"], "layer.png", { type: "image/png" });
		const asset: MediaAsset = {
			id: "img-1",
			name: "layer.png",
			type: "image",
			file: original,
			url: undefined,
			isHydrated: true,
		};
		const editor = {
			timeline: { getTracks: () => [] },
		} as never;
		const manager = new MediaManager(editor);
		manager.setAssets({ assets: [asset] });
		const listener = vi.fn();
		manager.subscribe(listener);

		manager.replaceAssetRaster({
			id: "img-1",
			file: next,
			url: "blob:new",
		});

		expect(manager.getAssets()[0]?.file).toBe(next);
		expect(manager.getAssets()[0]?.url).toBe("blob:new");
		expect(listener).toHaveBeenCalled();
	});
});
