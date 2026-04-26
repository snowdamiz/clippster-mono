import { Command } from "../../../../lib/commands/base-command";
import type { TimelineTrack } from "../../../../types/timeline";
import { EditorCore } from "../../../../core";
import { shiftCaptionTimesAfter } from "../../../timeline/caption-sync";
import { collapseMainVideoTracksIfPresent } from "../../../../lib/timeline/main-track-layout";

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

		// Find the target element to compute delta before mapping
		const targetTrack = this.savedState.find((t) => t.id === this.trackId);
		const targetEl = targetTrack?.elements.find((el) => el.id === this.elementId);
		if (!targetEl) {
			editor.timeline.updateTracks(this.savedState);
			return;
		}

		const durationDelta = this.duration - targetEl.duration;
		const oldEndTime = targetEl.startTime + targetEl.duration;

		const updatedTracks = this.savedState.map((t) => {
			if (t.id !== this.trackId) return t;

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

		const fps = editor.project.getActive()?.settings?.fps ?? 30;
		// Shift caption times when ripple-pushing
		if (durationDelta !== 0) {
			const finalTracks = shiftCaptionTimesAfter({
				tracks: updatedTracks,
				afterTime: oldEndTime,
				delta: durationDelta,
			});
			editor.timeline.updateTracks(collapseMainVideoTracksIfPresent(finalTracks, fps));
		} else {
			editor.timeline.updateTracks(collapseMainVideoTracksIfPresent(updatedTracks, fps));
		}
	}

	undo(): void {
		if (this.savedState) {
			const editor = EditorCore.getInstance();
			editor.timeline.updateTracks(this.savedState);
		}
	}
}
