import type { Command } from "../../lib/commands";
import { MacroCommand } from "../../lib/commands/macro-command";

const MAX_HISTORY = 20;

export class CommandManager {
	private history: Command[] = [];
	private redoStack: Command[] = [];

	execute({ command }: { command: Command }): Command {
		command.execute();
		const previous = this.history[this.history.length - 1];
		if (
			previous?.canMergeWith?.(command) &&
			previous.mergeWith
		) {
			previous.mergeWith(command);
		} else {
			this.history.push(command);
		}
		if (this.history.length > MAX_HISTORY) {
			this.history.shift();
		}
		this.redoStack = [];
		return command;
	}

	/** Single undo step for multiple commands (e.g. batched inspector updates). */
	executeMacro({ commands }: { commands: Command[] }): Command {
		const macro = new MacroCommand(commands);
		return this.execute({ command: macro });
	}

	undo(): void {
		if (this.history.length === 0) return;
		const command = this.history.pop();
		command?.undo();
		if (command) {
			this.redoStack.push(command);
		}
	}

	redo(): void {
		if (this.redoStack.length === 0) return;
		const command = this.redoStack.pop();
		command?.redo();
		if (command) {
			this.history.push(command);
		}
	}

	canUndo(): boolean {
		return this.history.length > 0;
	}

	canRedo(): boolean {
		return this.redoStack.length > 0;
	}

	getUndoStackSize(): number {
		return this.history.length;
	}

	getRedoStackSize(): number {
		return this.redoStack.length;
	}

	clear(): void {
		this.history = [];
		this.redoStack = [];
	}
}
