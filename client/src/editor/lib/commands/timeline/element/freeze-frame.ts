import { Command } from "../../../../lib/commands/base-command";
import type { TimelineTrack, ImageElement, CreateImageElement } from "../../../../types/timeline";
import { generateUUID } from "../../../../utils/id";
import { EditorCore } from "../../../../core";
import { shiftCaptionTimesAfter } from "../../../timeline/caption-sync";
import { collapseMainVideoTracksIfPresent } from "../../../../lib/timeline/main-track-layout";

const DEFAULT_FREEZE_DURATION = 3; // seconds, same as CapCut

export class FreezeFrameCommand extends Command {
	private savedState: TimelineTrack[] | null = null;
	private previousSelection: { trackId: string; elementId: string }[] = [];
	private freezeElementId: string;

	constructor(
		private trackId: string,
		private elementId: string,
		private splitTime: number,
		private mediaId: string,
		private freezeDuration: number = DEFAULT_FREEZE_DURATION,
	) {
		super();
		this.freezeElementId = generateUUID();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		this.savedState = editor.timeline.getTracks();
		this.previousSelection = editor.selection.getSelectedElements();

		const track = this.savedState.find((t) => t.id === this.trackId);
		if (!track) return;

		const element = track.elements.find((e) => e.id === this.elementId);
		if (!element) return;

		// Validate split time is within element bounds
		const effectiveStart = element.startTime;
		const effectiveEnd = element.startTime + element.duration;
		if (this.splitTime <= effectiveStart || this.splitTime >= effectiveEnd) return;

		const relativeTime = this.splitTime - element.startTime;
		const leftDuration = relativeTime;
		const rightDuration = element.duration - relativeTime;

		const rightElementId = generateUUID();

		// Build the freeze frame image element
		// The freeze frame PNG is captured from the preview canvas which already
		// has all transforms (scale, position, rotation, crop, flip, opacity)
		// baked into the rendered pixels. Use neutral defaults so FFmpeg doesn't
		// double-apply them during export.
		const freezeElement: ImageElement = {
			id: this.freezeElementId,
			type: "image",
			name: `Freeze Frame`,
			mediaId: this.mediaId,
			startTime: this.splitTime,
			duration: this.freezeDuration,
			trimStart: 0,
			trimEnd: 0,
			transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
			opacity: 1,
			flip: undefined,
			crop: undefined,
		};

		const updatedTracks = this.savedState.map((t) => {
			if (t.id !== this.trackId) return t;

			return {
				...t,
				elements: t.elements.flatMap((el) => {
					if (el.id !== this.elementId) return [el];

					// Split into: left part | freeze frame | right part (shifted by freeze duration)
					return [
						{
							...el,
							duration: leftDuration,
							trimEnd: el.trimEnd + rightDuration,
							name: el.name,
						},
						freezeElement,
						{
							...el,
							id: rightElementId,
							startTime: this.splitTime + this.freezeDuration,
							duration: rightDuration,
							trimStart: el.trimStart + leftDuration,
							name: el.name,
						},
					];
				}),
			} as typeof t;
		});

		// Shift caption word/line times after the split point by the freeze duration
		const finalTracks = shiftCaptionTimesAfter({
			tracks: updatedTracks,
			afterTime: this.splitTime,
			delta: this.freezeDuration,
		});

		const fps = editor.project.getActive()?.settings?.fps ?? 30;
		editor.timeline.updateTracks(collapseMainVideoTracksIfPresent(finalTracks, fps));
		editor.selection.setSelectedElements({
			elements: [{ trackId: this.trackId, elementId: this.freezeElementId }],
		});
	}

	undo(): void {
		if (this.savedState) {
			const editor = EditorCore.getInstance();
			editor.timeline.updateTracks(this.savedState);
			editor.selection.setSelectedElements({ elements: this.previousSelection });
		}
	}
}
