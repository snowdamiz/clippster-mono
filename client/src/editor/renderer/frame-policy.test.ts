import { describe, expect, it } from "vitest";
import { getRenderFrame } from "./frame-policy";

describe("getRenderFrame", () => {
	it("uses the same frame-index timestamp contract as export", () => {
		expect(getRenderFrame({ time: 1.049, fps: 30, duration: 10 })).toEqual({
			frameIndex: 31,
			time: 31 / 30,
		});
	});

	it("never samples beyond the final exportable frame", () => {
		expect(getRenderFrame({ time: 10, fps: 30, duration: 10 })).toEqual({
			frameIndex: 299,
			time: 299 / 30,
		});
	});
});
