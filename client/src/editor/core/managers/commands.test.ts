import { describe, expect, it, vi } from "vitest";
import { Command } from "../../lib/commands/base-command";
import { CommandManager } from "./commands";

class MergeableCommand extends Command {
	constructor(
		private readonly group: string,
		private readonly run: () => void,
	) {
		super();
	}

	execute() {
		this.run();
	}

	undo() {}

	canMergeWith(next: Command) {
		return next instanceof MergeableCommand && next.group === this.group;
	}

	mergeWith() {}
}

describe("CommandManager", () => {
	it("executes high-frequency commands but stores one merged undo step", () => {
		const manager = new CommandManager();
		const run = vi.fn();

		manager.execute({ command: new MergeableCommand("opacity", run) });
		manager.execute({ command: new MergeableCommand("opacity", run) });

		expect(run).toHaveBeenCalledTimes(2);
		expect(manager.getUndoStackSize()).toBe(1);
	});

	it("does not merge unrelated commands", () => {
		const manager = new CommandManager();
		const run = vi.fn();

		manager.execute({ command: new MergeableCommand("opacity", run) });
		manager.execute({ command: new MergeableCommand("scale", run) });

		expect(manager.getUndoStackSize()).toBe(2);
	});
});
