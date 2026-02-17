import { Command } from "../base-command";
import { EditorCore } from "../../../core";
import type { TranscriptWord } from "../../../core/managers/transcript-manager";

/**
 * Updates a single transcript word's text.
 * Supports undo/redo.
 */
export class UpdateTranscriptWordCommand extends Command {
	private previousWords: TranscriptWord[] | null = null;

	constructor(
		private wordIndex: number,
		private newText: string,
	) {
		super();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		
		// Save current transcript state
		this.previousWords = editor.transcript.getWords();

		// Update word text
		const newWords = [...this.previousWords];
		if (newWords[this.wordIndex]) {
			newWords[this.wordIndex] = {
				...newWords[this.wordIndex],
				word: this.newText,
			};
			editor.transcript.setWords(newWords);
		}
	}

	undo(): void {
		const editor = EditorCore.getInstance();
		
		// Restore transcript state
		if (this.previousWords) {
			editor.transcript.setWords(this.previousWords);
		}
	}
}
