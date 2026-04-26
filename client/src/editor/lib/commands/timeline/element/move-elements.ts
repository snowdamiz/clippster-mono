import { Command } from "../../../../lib/commands/base-command";
import { EditorCore } from "../../../../core";
import type {
	TimelineTrack,
	TimelineElement,
	TrackType,
} from "../../../../types/timeline";
import {
	buildEmptyTrack,
	isMainTrack,
	validateElementTrackCompatibility,
} from "../../../../lib/timeline/track-utils";
import { collapseMainVideoTracksIfPresent } from "../../../../lib/timeline/main-track-layout";

export class MoveElementCommand extends Command {
	private savedState: TimelineTrack[] | null = null;

	constructor(
		private sourceTrackId: string,
		private targetTrackId: string,
		private elementId: string,
		private newStartTime: number,
		private createTrack?: { type: TrackType; index: number },
	) {
		super();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		this.savedState = editor.timeline.getTracks();

		const sourceTrack = this.savedState.find(
			(t) => t.id === this.sourceTrackId,
		);
		const element = sourceTrack?.elements.find(
			(el) => el.id === this.elementId,
		);

		if (!sourceTrack || !element) {
			console.error("Source track or element not found");
			return;
		}

		let targetTrack = this.savedState.find((t) => t.id === this.targetTrackId);
		let tracksToUpdate = this.savedState;
		if (!targetTrack && this.createTrack) {
			const newTrack = buildEmptyTrack({
				id: this.targetTrackId,
				type: this.createTrack.type,
			});
			tracksToUpdate = [...this.savedState];
			tracksToUpdate.splice(this.createTrack.index, 0, newTrack);
			targetTrack = newTrack;
		}
		if (!targetTrack) {
			console.error("Target track not found");
			return;
		}

		const validation = validateElementTrackCompatibility({
			element,
			track: targetTrack,
		});

		if (!validation.isValid) {
			console.error(validation.errorMessage);
			return;
		}

		const movedElement: TimelineElement = {
			...element,
			startTime: this.newStartTime,
		};

		const isSameTrack = this.sourceTrackId === this.targetTrackId;
		const movedEndTime = movedElement.startTime + movedElement.duration;

		let updatedTracks = tracksToUpdate.map((track) => {
			if (isSameTrack && track.id === this.sourceTrackId) {
				// Same track: update the moved element, then ripple-push any
				// elements that now overlap with the moved element's new position
				let elements = track.elements.map((el) =>
					el.id === this.elementId ? movedElement : el,
				);
				elements = this.ripplePush(elements, this.elementId, movedEndTime);
				return { ...track, elements };
			}

			if (track.id === this.sourceTrackId) {
				return {
					...track,
					elements: track.elements.filter((el) => el.id !== this.elementId),
				};
			}

			if (track.id === this.targetTrackId) {
				// Different track: add element, then ripple-push overlapping elements
				let elements = [...track.elements, movedElement];
				elements = this.ripplePush(elements, this.elementId, movedEndTime);
				return { ...track, elements };
			}

			return track;
		}) as TimelineTrack[];

		if (!isSameTrack) {
			const sourceTrackAfterMove = updatedTracks.find(
				(track) => track.id === this.sourceTrackId,
			);
			if (
				sourceTrackAfterMove &&
				sourceTrackAfterMove.elements.length === 0 &&
				!isMainTrack(sourceTrackAfterMove)
			) {
				updatedTracks = updatedTracks.filter(
					(track) => track.id !== this.sourceTrackId,
				);
			}
		}

		const fps = editor.project.getActive()?.settings?.fps ?? 30;
		editor.timeline.updateTracks(collapseMainVideoTracksIfPresent(updatedTracks, fps));
	}

	/**
	 * Sort elements by startTime, then iterate: if any element overlaps
	 * the previous one, push it forward so it starts at the previous end.
	 */
	private ripplePush(
		elements: TimelineElement[],
		movedId: string,
		movedEndTime: number,
	): TimelineElement[] {
		const sorted = [...elements].sort((a, b) => a.startTime - b.startTime);
		const result: TimelineElement[] = [];

		for (const el of sorted) {
			if (el.id === movedId) {
				result.push(el);
				continue;
			}
			if (result.length > 0) {
				const prev = result[result.length - 1];
				const prevEnd = prev.startTime + prev.duration;
				if (el.startTime < prevEnd - 0.001) {
					result.push({ ...el, startTime: prevEnd });
					continue;
				}
			}
			result.push(el);
		}

		return result;
	}

	undo(): void {
		if (this.savedState) {
			const editor = EditorCore.getInstance();
			editor.timeline.updateTracks(this.savedState);
		}
	}
}
