import { describe, expect, it } from "vitest";
import { captionLineFromWords, splitCaptionWordsAtCursor } from "./caption-line-split";
import type { CaptionWord } from "../types/timeline";

const words: CaptionWord[] = [
	{ word: "people—the", start: 1.0, end: 1.5 },
	{ word: "operators", start: 1.5, end: 2.0 },
	{ word: "behind", start: 2.0, end: 2.4 },
	{ word: "every", start: 2.4, end: 2.8 },
];

const text = "people—the operators behind every";

describe("splitCaptionWordsAtCursor", () => {
	it("splits at a word boundary", () => {
		const cursor = "people—the ".length;
		const split = splitCaptionWordsAtCursor(text, words, cursor);
		expect(split).toEqual({
			before: [words[0]],
			after: words.slice(1),
		});
	});

	it("puts a mid-word cursor on the second line", () => {
		const cursor = text.indexOf("operators") + 3;
		const split = splitCaptionWordsAtCursor(text, words, cursor);
		expect(split?.before.map((w) => w.word)).toEqual(["people—the"]);
		expect(split?.after.map((w) => w.word)).toEqual(["operators", "behind", "every"]);
	});

	it("returns null when cursor is at the edges", () => {
		expect(splitCaptionWordsAtCursor(text, words, 0)).toBeNull();
		expect(splitCaptionWordsAtCursor(text, words, text.length)).toBeNull();
	});
});

describe("captionLineFromWords", () => {
	it("builds line text and timing from words", () => {
		const line = captionLineFromWords(words.slice(0, 2));
		expect(line.text).toBe("people—the operators");
		expect(line.startTime).toBe(1.0);
		expect(line.endTime).toBe(2.0);
	});
});
