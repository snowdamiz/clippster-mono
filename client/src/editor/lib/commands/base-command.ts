export abstract class Command {
	abstract execute(): void;

	/** Optional history compaction for high-frequency controls such as sliders. */
	canMergeWith?(_next: Command): boolean;

	/** Merge the final state of `next` while preserving this command's undo snapshot. */
	mergeWith?(_next: Command): void;

	undo(): void {
		throw new Error("Undo not implemented for this command");
	}

	redo(): void {
		this.execute();
	}
}
