import { describe, expect, it } from "vitest";
import type { ManualFramingConfig } from "@/types";
import {
	getConfiguredFramingConfigs,
	isManualFramingConfigConfigured,
	pairExportVariants,
} from "./export-framing";

function config(
	overrides: Partial<ManualFramingConfig> = {},
): ManualFramingConfig {
	return {
		mode: "manual",
		regions: [],
		targetAspectRatio: "9:16",
		...overrides,
	};
}

describe("export framing", () => {
	it("accepts source-frame-only configurations", () => {
		expect(
			isManualFramingConfigConfigured(
				config({ sourceFrameMode: "use16x9" }),
			),
		).toBe(true);
		expect(isManualFramingConfigConfigured(config())).toBe(false);
	});

	it("rejects a selected ratio without framing", () => {
		expect(() => getConfiguredFramingConfigs(["9:16"], {})).toThrow(
			"Missing manual framing configuration for 9:16",
		);
	});

	it("pairs generated files with ratios in export order", () => {
		expect(
			pairExportVariants(
				["9:16", "1:1", "4:5"],
				["portrait.mp4", "square.mp4"],
			),
		).toEqual([
			{ ratio: "9:16", path: "portrait.mp4" },
			{ ratio: "1:1", path: "square.mp4" },
		]);
	});
});
