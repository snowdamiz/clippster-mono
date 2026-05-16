import type { ManualSourceFramingPayload } from "@/types";
import { Command } from "../base-command";
import { EditorCore } from "../../../core";

function applyCanvasSourceFraming(framing: ManualSourceFramingPayload | null): void {
	const editor = EditorCore.getInstance();
	const active = editor.project.getActive();
	if (!active) return;

	const updatedProject = {
		...active,
		settings: {
			...active.settings,
			...(framing === null
				? { canvasSourceFraming: undefined }
				: { canvasSourceFraming: { ...framing } }),
		},
		metadata: { ...active.metadata, updatedAt: new Date() },
	};

	editor.project.setActiveProject({ project: updatedProject });
	editor.save.markDirty();
}

/** One undo step for a canvas framing drag (previous → next). */
export class SetCanvasSourceFramingCommand extends Command {
	constructor(
		private readonly previous: ManualSourceFramingPayload | null,
		private readonly next: ManualSourceFramingPayload | null,
	) {
		super();
	}

	execute(): void {
		applyCanvasSourceFraming(this.next);
	}

	undo(): void {
		applyCanvasSourceFraming(this.previous);
	}
}
