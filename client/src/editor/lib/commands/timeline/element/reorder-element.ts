import { Command } from "../../../../lib/commands/base-command";
import type { TimelineTrack } from "../../../../types/timeline";
import { EditorCore } from "../../../../core";

type ReorderDirection = "front" | "back" | "forward" | "backward";

export class ReorderElementCommand extends Command {
	private savedState: TimelineTrack[] | null = null;

	constructor(
		private trackId: string,
		private elementId: string,
		private direction: ReorderDirection,
	) {
		super();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		this.savedState = editor.timeline.getTracks();

		const updatedTracks = [...this.savedState];
		const track = updatedTracks.find((t) => t.id === this.trackId);
		if (!track) return;

		const elementIndex = track.elements.findIndex((e) => e.id === this.elementId);
		if (elementIndex === -1) return;

		const element = track.elements[elementIndex];
		const currentOrder = element.orderIndex ?? 0;

		// Get all orderIndex values in the track
		const orderIndices = track.elements
			.map((e) => e.orderIndex ?? 0)
			.sort((a, b) => a - b);
		const uniqueOrders = [...new Set(orderIndices)];

		let newOrder = currentOrder;

		switch (this.direction) {
			case "front":
				// Move to highest orderIndex + 1
				newOrder = Math.max(...orderIndices, 0) + 1;
				break;
			case "back":
				// Move to lowest orderIndex - 1
				newOrder = Math.min(...orderIndices, 0) - 1;
				break;
			case "forward": {
				// Move to next higher orderIndex
				const higherOrders = uniqueOrders.filter((o) => o > currentOrder);
				if (higherOrders.length > 0) {
					newOrder = higherOrders[0];
				}
				break;
			}
			case "backward": {
				// Move to next lower orderIndex
				const lowerOrders = uniqueOrders.filter((o) => o < currentOrder);
				if (lowerOrders.length > 0) {
					newOrder = lowerOrders[lowerOrders.length - 1];
				}
				break;
			}
		}

		if (newOrder !== currentOrder) {
			element.orderIndex = newOrder;
			editor.timeline.updateTracks(updatedTracks);
		}
	}

	undo(): void {
		if (this.savedState) {
			const editor = EditorCore.getInstance();
			editor.timeline.updateTracks(this.savedState);
		}
	}
}
