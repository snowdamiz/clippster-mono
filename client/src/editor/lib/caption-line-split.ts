import type { CaptionElement, CaptionLine, CaptionWord } from "../types/timeline";
import { cloneTransform } from "./timeline/element-utils";

export function syncCaptionLineText(line: CaptionLine, newText: string): CaptionLine {
	const tokens = newText.split(/\s+/).filter(Boolean);
	const updatedWords = line.words.map((w, wi) => ({
		...w,
		word: tokens[wi] ?? "",
	}));
	const lastWord = line.words[line.words.length - 1];
	for (let wi = line.words.length; wi < tokens.length; wi++) {
		updatedWords.push({
			word: tokens[wi]!,
			start: lastWord?.end ?? line.startTime,
			end: lastWord?.end ?? line.endTime,
			confidence: 1,
		});
	}
	const filtered = updatedWords.filter((w) => w.word !== "");
	return {
		...line,
		text: newText,
		words: filtered.length > 0 ? filtered : line.words,
	};
}

export function captionLineFromWords(words: CaptionWord[]): CaptionLine {
	return {
		text: words.map((w) => w.word).join(" "),
		words,
		startTime: words[0]!.start,
		endTime: words[words.length - 1]!.end,
	};
}

/** Split caption words at a text cursor, keeping timed words intact. */
export function splitCaptionWordsAtCursor(
	text: string,
	words: CaptionWord[],
	cursor: number,
): { before: CaptionWord[]; after: CaptionWord[] } | null {
	if (words.length === 0) return null;

	const clampedCursor = Math.max(0, Math.min(cursor, text.length));
	if (clampedCursor === 0 || clampedCursor === text.length) return null;

	let searchFrom = 0;
	let splitAt = words.length;

	for (let i = 0; i < words.length; i++) {
		const word = words[i]!.word;
		const wordStart = text.indexOf(word, searchFrom);
		if (wordStart === -1) {
			const ratio = clampedCursor / Math.max(text.length, 1);
			splitAt = Math.min(words.length, Math.max(1, Math.round(ratio * words.length)));
			break;
		}

		const wordEnd = wordStart + word.length;
		if (clampedCursor <= wordStart) {
			splitAt = i;
			break;
		}
		if (clampedCursor < wordEnd) {
			splitAt = i;
			break;
		}

		searchFrom = wordEnd;
		splitAt = i + 1;
	}

	if (splitAt <= 0 || splitAt >= words.length) return null;

	return {
		before: words.slice(0, splitAt),
		after: words.slice(splitAt),
	};
}

export function captionStyleRaw(
	el: CaptionElement,
): Partial<Omit<CaptionElement, "type" | "id" | "lines">> {
	return {
		name: el.name,
		presetId: el.presetId,
		highlightStyle: el.highlightStyle,
		highlightColor: el.highlightColor,
		fontSize: el.fontSize,
		fontFamily: el.fontFamily,
		fontFilePath: el.fontFilePath,
		color: el.color,
		backgroundColor: el.backgroundColor,
		textAlign: el.textAlign,
		fontWeight: el.fontWeight,
		fontStyle: el.fontStyle,
		letterSpacing: el.letterSpacing,
		lineHeight: el.lineHeight,
		textCase: el.textCase,
		stroke: el.stroke ? { ...el.stroke } : undefined,
		shadow: el.shadow ? { ...el.shadow } : undefined,
		glow: el.glow ? { ...el.glow } : undefined,
		gradient: el.gradient ? { ...el.gradient, colors: [...el.gradient.colors] } : undefined,
		transform: cloneTransform(el.transform),
		opacity: el.opacity,
		maxWordsPerLine: el.maxWordsPerLine,
		animationIn: el.animationIn ? { ...el.animationIn } : undefined,
		animationOut: el.animationOut ? { ...el.animationOut } : undefined,
		animationLoop: el.animationLoop ? { ...el.animationLoop } : undefined,
	};
}
