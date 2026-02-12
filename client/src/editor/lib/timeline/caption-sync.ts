import type {
	TimelineTrack,
	CaptionElement,
	CaptionLine,
	CaptionWord,
} from "../../types/timeline";

/**
 * Shift all caption word/line absolute times that fall at or after `afterTime`
 * by `delta` seconds. This keeps captions in sync when time is inserted into
 * (positive delta) or removed from (negative delta) the timeline.
 *
 * Words that straddle `afterTime` (start < afterTime <= end) are split
 * conceptually: their `start` stays but `end` shifts. In practice we shift
 * the whole word if its midpoint is >= afterTime, to avoid partial-word
 * artifacts.
 *
 * Returns a new tracks array (immutable).
 */
export function shiftCaptionTimesAfter({
	tracks,
	afterTime,
	delta,
}: {
	tracks: TimelineTrack[];
	afterTime: number;
	delta: number;
}): TimelineTrack[] {
	if (delta === 0) return tracks;

	return tracks.map((track) => {
		if (track.type !== "caption") return track;

		const newElements = track.elements.map((el) => {
			const caption = el as CaptionElement;

			// If the entire caption ends before the shift point, skip
			const captionEnd = caption.startTime + caption.duration;
			if (captionEnd <= afterTime) return el;

			// If the entire caption starts at or after the shift point,
			// shift the whole element and all its word/line times
			if (caption.startTime >= afterTime) {
				return shiftEntireCaptionElement(caption, delta);
			}

			// Caption straddles the shift point — shift only the lines/words
			// that are at or after afterTime
			return shiftPartialCaptionElement(caption, afterTime, delta);
		});

		return { ...track, elements: newElements } as typeof track;
	});
}

function shiftEntireCaptionElement(
	caption: CaptionElement,
	delta: number,
): CaptionElement {
	const newLines: CaptionLine[] = caption.lines.map((line) => ({
		...line,
		startTime: line.startTime + delta,
		endTime: line.endTime + delta,
		words: line.words.map((w) => ({
			...w,
			start: w.start + delta,
			end: w.end + delta,
		})),
	}));

	return {
		...caption,
		startTime: caption.startTime + delta,
		lines: newLines,
		// duration stays the same — the element just moved
	};
}

function shiftPartialCaptionElement(
	caption: CaptionElement,
	afterTime: number,
	delta: number,
): CaptionElement {
	const newLines: CaptionLine[] = caption.lines.map((line) => {
		// Line entirely before the shift point — keep as-is
		if (line.endTime <= afterTime) return line;

		// Line entirely at or after the shift point — shift everything
		if (line.startTime >= afterTime) {
			return {
				...line,
				startTime: line.startTime + delta,
				endTime: line.endTime + delta,
				words: line.words.map((w) => ({
					...w,
					start: w.start + delta,
					end: w.end + delta,
				})),
			};
		}

		// Line straddles the shift point — shift individual words
		const newWords: CaptionWord[] = line.words.map((w) => {
			const midpoint = (w.start + w.end) / 2;
			if (midpoint >= afterTime) {
				return { ...w, start: w.start + delta, end: w.end + delta };
			}
			return w;
		});

		return {
			...line,
			words: newWords,
			startTime: line.startTime,
			endTime: Math.max(line.endTime, line.endTime + delta),
		};
	});

	// Recalculate element duration to cover all shifted lines
	const lastLine = newLines[newLines.length - 1];
	const newEnd = lastLine ? lastLine.endTime : caption.startTime + caption.duration;
	const newDuration = newEnd - caption.startTime;

	return {
		...caption,
		lines: newLines,
		duration: Math.max(caption.duration, newDuration),
	};
}
