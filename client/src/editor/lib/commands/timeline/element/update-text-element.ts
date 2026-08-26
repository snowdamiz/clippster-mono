import { Command } from "../../../../lib/commands/base-command";
import type { TextElement, TimelineTrack } from "../../../../types/timeline";
import { EditorCore } from "../../../../core";

export type TextElementUpdatable = Partial<
	Pick<
		TextElement,
		| "name"
		| "content"
		| "fontSize"
		| "fontFamily"
		| "fontFilePath"
		| "color"
		| "backgroundColor"
		| "textAlign"
		| "fontWeight"
		| "fontStyle"
		| "textDecoration"
		| "letterSpacing"
		| "lineHeight"
		| "textCase"
		| "stroke"
		| "shadow"
		| "glow"
		| "gradient"
		| "bubbleStyle"
		| "bubbleColor"
		| "bubblePadding"
		| "bubbleOpacity"
		| "textOpacity"
		| "transform"
		| "opacity"
		| "blendMode"
		| "fadeIn"
		| "fadeOut"
		| "locked"
		| "groupId"
	>
>;

export class UpdateTextElementCommand extends Command {
	private savedState: TimelineTrack[] | null = null;

	constructor(
		private trackId: string,
		private elementId: string,
		private updates: TextElementUpdatable,
	) {
		super();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		this.savedState = editor.timeline.getTracks();

		const updatedTracks = this.savedState.map((t) => {
			if (t.id !== this.trackId) return t;
			const newElements = t.elements.map((el) =>
				el.id === this.elementId && el.type === "text"
					? { ...el, ...this.updates }
					: el,
			);
			return { ...t, elements: newElements } as typeof t;
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
