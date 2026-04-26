import { Command } from "../../../../lib/commands/base-command";
import { EditorCore } from "../../../../core";
import type { TimelineTrack } from "../../../../types/timeline";
import { collapseMainVideoTracksIfPresent } from "../../../../lib/timeline/main-track-layout";

/**
 * Move multiple elements on the same track by a time delta.
 * Used when all elements in a track are selected (e.g. caption track)
 * and the user drags them together.
 */
export class MoveElementsBatchCommand extends Command {
	private savedState: TimelineTrack[] | null = null;

	constructor(
		private trackId: string,
		private elementIds: string[],
		private timeDelta: number,
	) {
		super();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		this.savedState = editor.timeline.getTracks();

		const movedSet = new Set(this.elementIds);
		const delta = this.timeDelta;

		const updatedTracks = this.savedState.map((track) => {
			if (track.id !== this.trackId) return track;
			const elements = track.elements.map((el) => {
				if (!movedSet.has(el.id)) return el;
				return { ...el, startTime: Math.max(0, el.startTime + delta) };
			});
			return { ...track, elements } as typeof track;
		});

		const fps = editor.project.getActive()?.settings?.fps ?? 30;
		editor.timeline.updateTracks(collapseMainVideoTracksIfPresent(updatedTracks, fps));
	}

	undo(): void {
		if (this.savedState) {
			const editor = EditorCore.getInstance();
			editor.timeline.updateTracks(this.savedState);
		}
	}
}
