import { Command } from "../base-command";
import { EditorCore } from "../../../core";
import type { TranscriptWord } from "../../../core/managers/transcript-manager";

/**
 * Reorders transcript words (used for paragraph drag-and-drop).
 * Also handles timeline video segment reordering.
 * Supports undo/redo.
 */
export class ReorderTranscriptWordsCommand extends Command {
	private previousWords: TranscriptWord[] | null = null;

	constructor(
		private sourceOffset: number,
		private sourceCount: number,
		private targetOffset: number,
	) {
		super();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		
		// Save current transcript state
		this.previousWords = editor.transcript.getWords();

		// Reorder words
		const newWords = [...this.previousWords];
		const movedWords = newWords.splice(this.sourceOffset, this.sourceCount);
		newWords.splice(this.targetOffset, 0, ...movedWords);

		// Recalculate timestamps
		let currentStart = 0;
		for (const word of newWords) {
			const duration = word.end - word.start;
			word.start = currentStart;
			word.end = currentStart + duration;
			currentStart = word.end;
		}

		editor.transcript.setWords(newWords);

		// Reorder video segments on timeline
		this.reorderVideoSegments();
	}

	undo(): void {
		const editor = EditorCore.getInstance();
		
		// Restore transcript state
		if (this.previousWords) {
			editor.transcript.setWords(this.previousWords);
			
			// Restore video segment order
			this.reorderVideoSegments();
		}
	}

	private reorderVideoSegments(): void {
		const editor = EditorCore.getInstance();
		const tracks = editor.timeline.getTracks();
		
		for (const track of tracks) {
			if (track.type !== "video") continue;
			const elements = [...track.elements].sort((a, b) => a.startTime - b.startTime);
			let currentStart = 0;
			for (const el of elements) {
				if (el.startTime !== currentStart) {
					editor.timeline.updateElementStartTime({
						elements: [{ trackId: track.id, elementId: el.id }],
						startTime: currentStart,
					});
				}
				currentStart += el.duration;
			}
		}
	}
}
