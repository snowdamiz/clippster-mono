import { Command } from "../../../../lib/commands/base-command";
import type { CaptionElement, TimelineTrack } from "../../../../types/timeline";
import { EditorCore } from "../../../../core";
import { collapseMainVideoTracksIfPresent } from "../../../../lib/timeline/main-track-layout";
import { syncCaptionElementTimelineBounds } from "../../../timeline/caption-sync";

export class UpdateElementTrimCommand extends Command {
	private savedState: TimelineTrack[] | null = null;

	constructor(
		private elementId: string,
		private trimStart: number,
		private trimEnd: number,
		private startTime?: number,
		private duration?: number,
	) {
		super();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		this.savedState = editor.timeline.getTracks();

		const updatedTracks = this.savedState.map((track) => {
			const newElements = track.elements.map((element) => {
				if (element.id !== this.elementId) {
					return element;
				}

				const next = {
					...element,
					trimStart: this.trimStart,
					trimEnd: this.trimEnd,
					startTime: this.startTime ?? element.startTime,
					duration: this.duration ?? element.duration,
				};

				if (next.type === "caption") {
					return syncCaptionElementTimelineBounds(next as CaptionElement);
				}

				return next;
			});
			return { ...track, elements: newElements } as typeof track;
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
