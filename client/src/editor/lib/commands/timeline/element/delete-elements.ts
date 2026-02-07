import { Command } from "../../../../lib/commands/base-command";
import type { TimelineTrack } from "../../../../types/timeline";
import { EditorCore } from "../../../../core";
import { isMainTrack } from "../../../../lib/timeline";

export class DeleteElementsCommand extends Command {
	private savedState: TimelineTrack[] | null = null;

	constructor(
		private elements: { trackId: string; elementId: string }[],
		private mainTrackMagnet: boolean = true,
	) {
		super();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		this.savedState = editor.timeline.getTracks();

		const updatedTracks = this.savedState
			.map((track) => {
				const hasElementsToDelete = this.elements.some(
					(el) => el.trackId === track.id,
				);

				if (!hasElementsToDelete) {
					return track;
				}

				const filteredElements = track.elements.filter(
					(element) =>
						!this.elements.some(
							(el) => el.trackId === track.id && el.elementId === element.id,
						),
				);

				// Main video track: collapse gaps when magnet is ON
				if (this.mainTrackMagnet && isMainTrack(track) && filteredElements.length > 0) {
					const sorted = filteredElements
						.map((el) => ({ ...el }))
						.sort((a, b) => a.startTime - b.startTime);
					let cursor = 0;
					for (const el of sorted) {
						el.startTime = cursor;
						cursor += el.duration;
					}
					return { ...track, elements: sorted } as typeof track;
				}

				return { ...track, elements: filteredElements } as typeof track;
			})
			.filter((track) => track.elements.length > 0 || isMainTrack(track));

		editor.timeline.updateTracks(updatedTracks);
	}

	undo(): void {
		if (this.savedState) {
			const editor = EditorCore.getInstance();
			editor.timeline.updateTracks(this.savedState);
		}
	}
}
