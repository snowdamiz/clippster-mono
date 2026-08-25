import { Command } from "../../../../lib/commands/base-command";
import { EditorCore } from "../../../../core";
import type { MaskShape, TimelineTrack } from "../../../../types/timeline";

export class UpdateMaskCommand extends Command {
	constructor(
		private trackId: string,
		private elementId: string,
		private previousMasks: MaskShape[],
		private nextMasks: MaskShape[],
	) {
		super();
	}

	execute(): void {
		this.applyMasks(this.nextMasks);
	}

	undo(): void {
		this.applyMasks(this.previousMasks);
	}

	private applyMasks(masks: MaskShape[]): void {
		const editor = EditorCore.getInstance();
		const tracks = editor.timeline.getTracks();
		const updatedTracks = tracks.map((t) => {
			if (t.id !== this.trackId) return t;
			return {
				...t,
				elements: t.elements.map((e) =>
					e.id === this.elementId ? ({ ...e, masks } as typeof e) : e,
				),
			};
		});
		editor.timeline.updateTracks(updatedTracks as TimelineTrack[]);
	}
}
