import { describe, expect, it } from "vitest";
import { getExportBoundarySlackSec } from "./export-boundary";

describe("getExportBoundarySlackSec", () => {
	it("returns one frame for exact-export", () => {
		expect(getExportBoundarySlackSec(30, "exact-export")).toBeCloseTo(1 / 30);
	});

	it("returns zero for preview and realtime policies", () => {
		expect(getExportBoundarySlackSec(30, "exact-preview")).toBe(0);
		expect(getExportBoundarySlackSec(30, "realtime")).toBe(0);
	});
});
