import { Command } from "../../../../lib/commands/base-command";
import type { TimelineTrack } from "../../../../types/timeline";
import { generateUUID } from "../../../../utils/id";
import { EditorCore } from "../../../../core";
import { collapseMainVideoTracksIfPresent } from "../../../../lib/timeline/main-track-layout";

/**
 * Atomically ripple-deletes a time range from all video tracks.
 * Handles: full removal, left trim, right trim, mid-split, and ripple-shift.
 * Single undo restores the entire previous state.
 */
export class RippleDeleteTimeRangeCommand extends Command {
	private savedState: TimelineTrack[] | null = null;

	constructor(
		private startTime: number,
		private endTime: number,
	) {
		super();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		this.savedState = editor.timeline.getTracks();

		const deleteDuration = this.endTime - this.startTime;
		if (deleteDuration <= 0) return;

		const updatedTracks = this.savedState.map((track) => {
			if (track.type !== "video") return track;

			const newElements = track.elements
				.map((el) => ({ ...el }))
				.sort((a, b) => a.startTime - b.startTime);

			const result: typeof newElements = [];

			for (const el of newElements) {
				const elEnd = el.startTime + el.duration;

				// Element is entirely within delete range → remove it
				if (el.startTime >= this.startTime && elEnd <= this.endTime) {
					continue;
				}

				// Element is entirely before delete range → keep as-is
				if (elEnd <= this.startTime) {
					result.push(el);
					continue;
				}

				// Element is entirely after delete range → ripple shift left
				if (el.startTime >= this.endTime) {
					result.push({
						...el,
						startTime: el.startTime - deleteDuration,
					});
					continue;
				}

				// Element spans the delete range start (left side sticks out)
				if (el.startTime < this.startTime && elEnd > this.startTime && elEnd <= this.endTime) {
					result.push({
						...el,
						duration: this.startTime - el.startTime,
					});
					continue;
				}

				// Element spans the delete range end (right side sticks out)
				if (el.startTime >= this.startTime && el.startTime < this.endTime && elEnd > this.endTime) {
					const trimAmount = this.endTime - el.startTime;
					result.push({
						...el,
						startTime: this.startTime,
						duration: el.duration - trimAmount,
						trimStart: (el.trimStart || 0) + trimAmount,
					});
					continue;
				}

				// Element entirely contains delete range → split into two, remove middle
				if (el.startTime < this.startTime && elEnd > this.endTime) {
					// Left part: from el.startTime to startTime
					const leftDuration = this.startTime - el.startTime;
					result.push({
						...el,
						duration: leftDuration,
					});

					// Right part: from endTime to elEnd, shifted left
					const rightTrimAmount = this.endTime - el.startTime;
					const rightDuration = elEnd - this.endTime;
					result.push({
						...el,
						id: generateUUID(),
						startTime: this.startTime, // ripple: right part snaps to where left part ends
						duration: rightDuration,
						trimStart: (el.trimStart || 0) + rightTrimAmount,
						name: el.name ? `${el.name} (split)` : el.name,
					});
					continue;
				}

				// Fallback: keep element
				result.push(el);
			}

			return { ...track, elements: result } as typeof track;
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
