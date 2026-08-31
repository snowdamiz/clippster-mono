import { Command } from "../../../../lib/commands/base-command";
import type { TimelineTrack } from "../../../../types/timeline";
import { EditorCore } from "../../../../core";
import { collapseMainVideoTracksIfPresent, isMainTrack } from "../../../../lib/timeline";

export class DeleteElementsCommand extends Command {
	private savedState: TimelineTrack[] | null = null;

	constructor(
		private elements: { trackId: string; elementId: string }[],
		/** When true (main-track magnet on), pack main video segments after deletion from the main track. */
		private collapseMainTrackGaps = true,
	) {
		super();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		this.savedState = editor.timeline.getTracks();

		const deletedFromMain = this.elements.some((el) => {
			const track = this.savedState?.find((t) => t.id === el.trackId);
			return !!track && isMainTrack(track);
		});

		const updatedTracks = this.savedState
			.map((track) => {
				const hasElementsToDelete = this.elements.some(
					(el) => el.trackId === track.id,
				);

				if (!hasElementsToDelete) {
					return track;
				}

				// Overlay tracks: remove in place and keep gaps. Main-track gap
				// packing is handled below via collapseMainVideoTracksIfPresent.
				const filteredElements = track.elements.filter(
					(element) =>
						!this.elements.some(
							(el) => el.trackId === track.id && el.elementId === element.id,
						),
				);

				return { ...track, elements: filteredElements } as typeof track;
			})
			.filter((track) => track.elements.length > 0 || isMainTrack(track));

		const fps = editor.project.getActive()?.settings?.fps ?? 30;
		editor.timeline.updateTracks(
			this.collapseMainTrackGaps && deletedFromMain
				? collapseMainVideoTracksIfPresent(updatedTracks, fps)
				: updatedTracks,
		);
	}

	undo(): void {
		if (this.savedState) {
			const editor = EditorCore.getInstance();
			editor.timeline.updateTracks(this.savedState);
		}
	}
}
