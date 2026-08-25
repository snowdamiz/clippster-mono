import { Command } from "../../../../lib/commands/base-command";
import type { TimelineElement, TimelineTrack } from "../../../../types/timeline";
import { generateUUID } from "../../../../utils/id";
import { EditorCore } from "../../../../core";
import { collapseMainVideoTracksIfPresent } from "../../../../lib/timeline/main-track-layout";

interface DuplicateElementsParams {
	elements: { trackId: string; elementId: string }[];
}

export class DuplicateElementsCommand extends Command {
	private duplicatedElements: { trackId: string; elementId: string }[] = [];
	private savedState: TimelineTrack[] | null = null;
	private previousSelection: { trackId: string; elementId: string }[] = [];
	private elements: DuplicateElementsParams["elements"];

	constructor({ elements }: DuplicateElementsParams) {
		super();
		this.elements = elements;
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		this.savedState = editor.timeline.getTracks();
		this.previousSelection = editor.selection.getSelectedElements();
		this.duplicatedElements = [];

		const updatedTracks = [...this.savedState];

		for (const track of updatedTracks) {
			const elementsToDuplicate = this.elements.filter(
				(el) => el.trackId === track.id,
			);

			if (elementsToDuplicate.length === 0) {
				continue;
			}

			const elementIdsToDuplicate = new Set(
				elementsToDuplicate.map((element) => element.elementId),
			);

			// Find highest orderIndex in track
			const maxOrderIndex = track.elements.reduce(
				(max, el) => Math.max(max, el.orderIndex ?? 0),
				0,
			);

			// Duplicate elements on same track with incremented orderIndex
			for (const element of track.elements) {
				if (!elementIdsToDuplicate.has(element.id)) {
					continue;
				}

				const newId = generateUUID();
				const newOrderIndex = (element.orderIndex ?? 0) + maxOrderIndex + 1;

				this.duplicatedElements.push({
					trackId: track.id,
					elementId: newId,
				});

				const duplicatedElement = buildDuplicateElement({
					element,
					id: newId,
					startTime: element.startTime,
					orderIndex: newOrderIndex,
				});
				
				// TypeScript: track.elements is typed as specific element array, cast to match
				(track.elements as TimelineElement[]).push(duplicatedElement);
			}
		}

		const fps = editor.project.getActive()?.settings?.fps ?? 30;
		editor.timeline.updateTracks(collapseMainVideoTracksIfPresent(updatedTracks, fps));

		if (this.duplicatedElements.length > 0) {
			editor.selection.setSelectedElements({ elements: this.duplicatedElements });
		}
	}

	undo(): void {
		if (this.savedState) {
			const editor = EditorCore.getInstance();
			editor.timeline.updateTracks(this.savedState);
			editor.selection.setSelectedElements({ elements: this.previousSelection });
		}
	}

	getDuplicatedElements(): { trackId: string; elementId: string }[] {
		return this.duplicatedElements;
	}
}

function buildDuplicateElement({
	element,
	id,
	startTime,
	orderIndex,
}: {
	element: TimelineElement;
	id: string;
	startTime: number;
	orderIndex: number;
}): TimelineElement {
	return { ...element, id, name: `${element.name} (copy)`, startTime, orderIndex };
}
