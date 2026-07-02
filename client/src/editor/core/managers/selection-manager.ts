import type { EditorCore } from "../../core";
import type { ClipboardItem } from "../../types/timeline";

type ElementRef = { trackId: string; elementId: string };

export class SelectionManager {
	private selectedElements: ElementRef[] = [];
	/** When set, no timeline elements are selected — user picked a junction transition badge. */
	private selectedTransitionId: string | null = null;
	private clipboard: ClipboardItem[] = [];
	private listeners = new Set<() => void>();

	constructor(editor: EditorCore) {
		void editor;
	}

	getSelectedElements(): ElementRef[] {
		return [...this.selectedElements];
	}

	getSelectedTransitionId(): string | null {
		return this.selectedTransitionId;
	}

	setSelectedElements({ elements }: { elements: ElementRef[] }): void {
		this.selectedElements = elements;
		this.selectedTransitionId = null;
		this.notify();
	}

	/** Selects a scene transition by id and clears element selection. Pass null to clear only the transition. */
	setSelectedTransition({ transitionId }: { transitionId: string | null }): void {
		if (transitionId) {
			this.selectedElements = [];
			this.selectedTransitionId = transitionId;
		} else {
			this.selectedTransitionId = null;
		}
		this.notify();
	}

	clearSelection(): void {
		this.selectedElements = [];
		this.selectedTransitionId = null;
		this.notify();
	}

	getClipboard(): ClipboardItem[] {
		return this.clipboard;
	}

	setClipboard({ items }: { items: ClipboardItem[] }): void {
		this.clipboard = items;
	}

	hasClipboard(): boolean {
		return this.clipboard.length > 0;
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private notify(): void {
		this.listeners.forEach((fn) => fn());
	}
}
