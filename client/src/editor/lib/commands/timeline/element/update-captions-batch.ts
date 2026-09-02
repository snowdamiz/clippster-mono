import { Command } from "../../../../lib/commands/base-command";
import type { CaptionElement, TimelineTrack } from "../../../../types/timeline";
import { EditorCore } from "../../../../core";
import {
	applyCaptionUpdates,
	cloneCaptionTracksForUndo,
	type CaptionElementUpdatable,
} from "./update-caption-element";

/**
 * Apply the same caption property updates to multiple elements on one track in a single undo step.
 */
export class UpdateCaptionsBatchCommand extends Command {
	private savedState: TimelineTrack[] | null = null;

	constructor(
		private readonly trackId: string,
		private readonly elementIds: string[],
		private readonly updates: CaptionElementUpdatable,
	) {
		super();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		const tracks = editor.timeline.getTracks();
		this.savedState = cloneCaptionTracksForUndo(tracks);

		const targetIds = new Set(this.elementIds);
		const updatedTracks = tracks.map((t) => {
			if (t.id !== this.trackId) return t;
			return {
				...t,
				elements: t.elements.map((el) =>
					targetIds.has(el.id) && el.type === "caption"
						? applyCaptionUpdates(el, this.updates)
						: el,
				),
			} as typeof t;
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
