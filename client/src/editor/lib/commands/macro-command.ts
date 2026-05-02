import { Command } from "./base-command";

/**
 * Groups multiple commands into a single undo step.
 */
export class MacroCommand extends Command {
	private executed = false;

	constructor(private readonly commands: Command[]) {
		super();
	}

	execute(): void {
		for (const c of this.commands) {
			c.execute();
		}
		this.executed = true;
	}

	undo(): void {
		if (!this.executed) return;
		for (let i = this.commands.length - 1; i >= 0; i--) {
			const c = this.commands[i]!;
			c.undo();
		}
	}

	redo(): void {
		this.execute();
	}
}
