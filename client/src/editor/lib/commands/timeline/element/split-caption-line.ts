import { Command } from "../../../../lib/commands/base-command";
import type { CaptionElement, TimelineElement, TimelineTrack } from "../../../../types/timeline";
import { EditorCore } from "../../../../core";
import { buildCaptionElement } from "../../../timeline/element-utils";
import { generateUUID } from "../../../../utils/id";
import {
	captionLineFromWords,
	captionStyleRaw,
	splitCaptionWordsAtCursor,
	syncCaptionLineText,
} from "../../../caption-line-split";
import { cloneCaptionTracksForUndo } from "./update-caption-element";

export class SplitCaptionLineCommand extends Command {
	private savedState: TimelineTrack[] | null = null;
	private insertedElementId: string | null = null;

	constructor(
		private readonly trackId: string,
		private readonly elementId: string,
		private readonly lineIndex: number,
		private readonly cursor: number,
		private readonly lineText?: string,
	) {
		super();
	}

	getInsertedElementId(): string | null {
		return this.insertedElementId;
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		const tracks = editor.timeline.getTracks();
		const track = tracks.find((t) => t.id === this.trackId);
		const element = track?.elements.find(
			(el) => el.id === this.elementId && el.type === "caption",
		) as CaptionElement | undefined;
		const line = element?.lines[this.lineIndex];
		if (!element || !line) return;

		const effectiveLine =
			this.lineText !== undefined ? syncCaptionLineText(line, this.lineText) : line;
		const split = splitCaptionWordsAtCursor(
			effectiveLine.text,
			effectiveLine.words,
			this.cursor,
		);
		if (!split) return;

		const firstLine = captionLineFromWords(split.before);
		const secondLine = captionLineFromWords(split.after);
		this.savedState = cloneCaptionTracksForUndo(tracks);
		this.insertedElementId = generateUUID();

		const newLines = [...element.lines];
		newLines.splice(this.lineIndex, 1, firstLine);

		const newElement = {
			...buildCaptionElement({
				lines: [secondLine],
				startTime: secondLine.startTime,
				duration: Math.max(0.05, secondLine.endTime - secondLine.startTime),
				raw: captionStyleRaw(element),
			}),
			id: this.insertedElementId,
		} as TimelineElement;

		const updatedTracks = tracks.map((t) => {
			if (t.id !== this.trackId) return t;
			const elements = t.elements
				.map((el) => {
					if (el.id !== this.elementId || el.type !== "caption") return el;
					return {
						...el,
						lines: newLines,
						startTime: newLines[0]!.startTime,
						duration: Math.max(
							0.05,
							newLines[newLines.length - 1]!.endTime - newLines[0]!.startTime,
						),
					} as typeof el;
				})
				.concat(newElement)
				.sort((a, b) => a.startTime - b.startTime || a.id.localeCompare(b.id));
			return { ...t, elements } as typeof t;
		});

		editor.timeline.updateTracks(updatedTracks);
	}

	undo(): void {
		if (this.savedState) {
			const editor = EditorCore.getInstance();
			editor.timeline.updateTracks(this.savedState);
		}
	}
}
