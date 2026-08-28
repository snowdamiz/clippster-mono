import { describe, expect, it } from "vitest";
import { mimeForImageStill } from "./image-export-format";

describe("mimeForImageStill", () => {
	it("maps still formats to browser mime types", () => {
		expect(mimeForImageStill("png")).toBe("image/png");
		expect(mimeForImageStill("jpg")).toBe("image/jpeg");
		expect(mimeForImageStill("webp")).toBe("image/webp");
	});
});
