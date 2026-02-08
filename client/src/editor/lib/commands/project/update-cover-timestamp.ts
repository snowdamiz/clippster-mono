import { Command } from "../base-command";
import { EditorCore } from "../../../core";

export class UpdateCoverTimestampCommand extends Command {
	private previousTimestamp: number | undefined = undefined;

	constructor(private timestamp: number | undefined) {
		super();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		this.previousTimestamp = editor.project.getCoverTimestamp();
		editor.project.setCoverTimestamp({ timestamp: this.timestamp });
	}

	undo(): void {
		const editor = EditorCore.getInstance();
		editor.project.setCoverTimestamp({ timestamp: this.previousTimestamp });
	}
}
