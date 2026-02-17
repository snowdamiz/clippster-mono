import { Command } from "../base-command";
import { EditorCore } from "../../../core";
import { RippleDeleteTimeRangeCommand } from "../timeline/element/ripple-delete-time-range";
import type { TranscriptWord } from "../../../core/managers/transcript-manager";

/**
 * Deletes transcript words and ripple-deletes the corresponding time range from the timeline.
 * Atomically handles both transcript state and timeline state for proper undo/redo.
 */
export class DeleteTranscriptWordsCommand extends Command {
	private previousWords: TranscriptWord[] | null = null;
	private rippleDeleteCommand: RippleDeleteTimeRangeCommand;

	constructor(
		private startIndex: number,
		private endIndex: number,
	) {
		super();
		const editor = EditorCore.getInstance();
		const words = editor.transcript.getWords();
		const startWord = words[startIndex];
		const endWord = words[endIndex];
		
		if (!startWord || !endWord) {
			throw new Error("Invalid word indices for deletion");
		}

		this.rippleDeleteCommand = new RippleDeleteTimeRangeCommand(
			startWord.start,
			endWord.end,
		);
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		
		// Save current transcript state
		this.previousWords = editor.transcript.getWords();

		// Execute timeline ripple delete
		this.rippleDeleteCommand.execute();

		// Update transcript state
		const newWords = [...this.previousWords];
		newWords.splice(this.startIndex, this.endIndex - this.startIndex + 1);
		editor.transcript.setWords(newWords);
	}

	undo(): void {
		const editor = EditorCore.getInstance();
		
		// Restore timeline state
		this.rippleDeleteCommand.undo();

		// Restore transcript state
		if (this.previousWords) {
			editor.transcript.setWords(this.previousWords);
		}
	}
}
