import { Command } from "../base-command";
import { EditorCore } from "../../../core";
import type { TranscriptWord } from "../../../core/managers/transcript-manager";
import type { TimelineTrack } from "../../../types/timeline";

/**
 * Syncs the timeline to match the transcript word order.
 * Rebuilds video segments to match the sequential order of transcript words.
 * Supports undo/redo.
 */
export class SyncTimelineToTranscriptCommand extends Command {
	private previousTracks: TimelineTrack[] | null = null;

	constructor() {
		super();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		
		// Save current timeline state
		this.previousTracks = editor.timeline.getTracks();

		const words = editor.transcript.getWords();
		if (words.length === 0) {
			console.warn("[SyncTimelineToTranscriptCommand] No transcript words to sync");
			return;
		}

		// Rebuild video track to match transcript order
		const updatedTracks = this.previousTracks.map((track) => {
			if (track.type !== "video") return track;

			// Sort elements by their current startTime (which should match transcript order)
			const sortedElements = [...track.elements].sort((a, b) => a.startTime - b.startTime);

			// Recalculate startTime to be sequential with no gaps
			let currentStart = 0;
			const newElements = sortedElements.map((el) => {
				const newEl = {
					...el,
					startTime: currentStart,
				};
				currentStart += el.duration;
				return newEl;
			});

			return { ...track, elements: newElements } as typeof track;
		});

		editor.timeline.updateTracks(updatedTracks);
	}

	undo(): void {
		if (this.previousTracks) {
			const editor = EditorCore.getInstance();
			editor.timeline.updateTracks(this.previousTracks);
		}
	}
}
