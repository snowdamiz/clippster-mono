import type { EditorCore } from "../../core";
import type { ClipboardItem } from "../../types/timeline";

type ElementRef = { trackId: string; elementId: string };

export class SelectionManager {
	private selectedElements: ElementRef[] = [];
	private clipboard: ClipboardItem[] = [];
	private listeners = new Set<() => void>();

	constructor(editor: EditorCore) {
		void editor;
	}

	getSelectedElements(): ElementRef[] {
		return this.selectedElements;
	}

	setSelectedElements({ elements }: { elements: ElementRef[] }): void {
		this.selectedElements = elements;
		this.notify();
	}

	clearSelection(): void {
		this.selectedElements = [];
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
