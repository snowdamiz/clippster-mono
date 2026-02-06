import { Command } from "../../../../lib/commands/base-command";
import type { TimelineTrack } from "../../../../types/timeline";
import { EditorCore } from "../../../../core";

export class UpdateElementDurationCommand extends Command {
	private savedState: TimelineTrack[] | null = null;

	constructor(
		private trackId: string,
		private elementId: string,
		private duration: number,
	) {
		super();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		this.savedState = editor.timeline.getTracks();

		const updatedTracks = this.savedState.map((t) => {
			if (t.id !== this.trackId) return t;

			const targetEl = t.elements.find((el) => el.id === this.elementId);
			if (!targetEl) return t;

			const durationDelta = this.duration - targetEl.duration;
			const oldEndTime = targetEl.startTime + targetEl.duration;

			const newElements = t.elements.map((el) => {
				if (el.id === this.elementId) {
					return { ...el, duration: this.duration };
				}
				// Ripple-push: shift elements that start at or after the old end
				if (durationDelta > 0 && el.startTime >= oldEndTime - 0.001) {
					return { ...el, startTime: el.startTime + durationDelta };
				}
				return el;
			});
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
