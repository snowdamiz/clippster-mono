import type { MobileEditProjectV3 } from '../model/schema';
import { parseMobileEditProject } from '../model/validation';
import type { EditorCommand } from './command';

interface HistoryEntry {
  forward: EditorCommand;
  inverse: EditorCommand;
}

export interface CommandCommit {
  document: MobileEditProjectV3;
  changed: boolean;
}

export class EditorCommandHistory {
  private readonly past: HistoryEntry[] = [];
  private readonly future: HistoryEntry[] = [];

  constructor(private readonly limit = 100) {
    if (!Number.isSafeInteger(limit) || limit < 1) {
      throw new Error('Command history limit must be a positive integer');
    }
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  get size(): number {
    return this.past.length;
  }

  commit(document: MobileEditProjectV3, command: EditorCommand): CommandCommit {
    const next = parseMobileEditProject(command.apply(document));
    if (next === document) return { document, changed: false };

    const previous = this.past[this.past.length - 1];
    const coalesced =
      previous &&
      previous.forward.coalescingKey &&
      previous.forward.coalescingKey === command.coalescingKey
        ? previous.forward.coalesce?.(command)
        : null;
    if (previous && coalesced) {
      previous.forward = coalesced;
    } else {
      this.past.push({ forward: command, inverse: command.invert(document) });
      if (this.past.length > this.limit) this.past.shift();
    }
    this.future.length = 0;
    return { document: next, changed: true };
  }

  undo(document: MobileEditProjectV3): CommandCommit {
    const entry = this.past.pop();
    if (!entry) return { document, changed: false };
    const next = parseMobileEditProject(entry.inverse.apply(document));
    this.future.push(entry);
    return { document: next, changed: true };
  }

  redo(document: MobileEditProjectV3): CommandCommit {
    const entry = this.future.pop();
    if (!entry) return { document, changed: false };
    const next = parseMobileEditProject(entry.forward.apply(document));
    this.past.push(entry);
    return { document: next, changed: true };
  }

  clear(): void {
    this.past.length = 0;
    this.future.length = 0;
  }
}
