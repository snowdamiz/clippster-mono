import type { EditorCore } from "../index";

export interface TranscriptWord {
	word: string;
	start: number;
	end: number;
	confidence?: number;
}

/**
 * Manages transcript data for the active project.
 * Provides centralized state that can be used by commands for undo/redo.
 */
export class TranscriptManager {
	private words: TranscriptWord[] = [];
	private listeners: Set<() => void> = new Set();

	constructor(private editor: EditorCore) {}

	/**
	 * Get all transcript words
	 */
	getWords(): TranscriptWord[] {
		return [...this.words];
	}

	/**
	 * Set transcript words (used by commands for undo/redo)
	 */
	setWords(words: TranscriptWord[]): void {
		this.words = [...words];
		this.notifyListeners();
	}

	/**
	 * Clear all transcript words
	 */
	clear(): void {
		this.words = [];
		this.notifyListeners();
	}

	/**
	 * Subscribe to transcript changes
	 */
	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private notifyListeners(): void {
		this.listeners.forEach((fn) => fn());
	}

	/**
	 * Reset manager state (called when editor is reset)
	 */
	reset(): void {
		this.words = [];
		this.listeners.clear();
	}
}
