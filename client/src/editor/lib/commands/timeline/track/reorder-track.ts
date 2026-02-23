import { Command } from "../../../../lib/commands/base-command";
import type { TimelineTrack } from "../../../../types/timeline";
import { EditorCore } from "../../../../core";

export class ReorderTrackCommand extends Command {
	private savedState: TimelineTrack[] | null = null;

	constructor(
		private trackId: string,
		private newIndex: number,
	) {
		super();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		this.savedState = editor.timeline.getTracks();

		const tracks = [...(this.savedState || [])];
		const oldIndex = tracks.findIndex((t) => t.id === this.trackId);
		if (oldIndex === -1 || oldIndex === this.newIndex) return;

		const [track] = tracks.splice(oldIndex, 1);
		tracks.splice(this.newIndex, 0, track);

		editor.timeline.updateTracks(tracks);
	}

	undo(): void {
		if (this.savedState) {
			const editor = EditorCore.getInstance();
			editor.timeline.updateTracks(this.savedState);
		}
	}
}
