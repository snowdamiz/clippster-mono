import { Command } from "../../../../lib/commands/base-command";
import type { TimelineTrack, Transform } from "../../../../types/timeline";
import { cloneTransform } from "../../../timeline/element-utils";
import { EditorCore } from "../../../../core";

/**
 * Apply transform updates to multiple elements on one track in a single undo step.
 */
export class UpdateElementsTransformsBatchCommand extends Command {
	private savedState: TimelineTrack[] | null = null;

	constructor(
		private readonly trackId: string,
		private readonly updates: { elementId: string; transform: Transform }[],
		private readonly previousTransforms?: { elementId: string; transform: Transform }[],
	) {
		super();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		const tracks = editor.timeline.getTracks();
		this.savedState = this.previousTransforms?.length
			? this.applyTransformUpdates(this.cloneTracks(tracks), this.previousTransforms)
			: this.cloneTracks(tracks);
		const byId = new Map(this.updates.map((u) => [u.elementId, u.transform]));

		const updatedTracks = tracks.map((t) => {
			if (t.id !== this.trackId) return t;
			const newElements = t.elements.map((el) => {
				const next = byId.get(el.id);
				return next
					? {
							...el,
							transform: cloneTransform(next),
						}
					: el;
			});
			return { ...t, elements: newElements } as typeof t;
		});

		editor.timeline.updateTracks(updatedTracks);
	}

	undo(): void {
		if (this.savedState) {
			const editor = EditorCore.getInstance();
			editor.timeline.updateTracks(this.savedState);
		}
	}

	private cloneTracks(tracks: TimelineTrack[]): TimelineTrack[] {
		return tracks.map((t) => ({
			...t,
			elements: t.elements.map((el) => {
				if (!("transform" in el) || !el.transform) return el;
				return {
					...el,
					transform: cloneTransform(el.transform),
				};
			}),
		})) as TimelineTrack[];
	}

	private applyTransformUpdates(
		tracks: TimelineTrack[],
		updates: { elementId: string; transform: Transform }[],
	): TimelineTrack[] {
		const byId = new Map(updates.map((u) => [u.elementId, u.transform]));
		return tracks.map((t) => {
			if (t.id !== this.trackId) return t;
			return {
				...t,
				elements: t.elements.map((el) => {
					const next = byId.get(el.id);
					return next
						? {
								...el,
								transform: cloneTransform(next),
							}
						: el;
				}),
			} as typeof t;
		});
	}
}
