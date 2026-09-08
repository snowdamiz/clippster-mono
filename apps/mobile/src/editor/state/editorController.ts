import type { EditorCommand } from '../commands/command';
import { EditorCommandHistory } from '../commands/history';
import type { MobileEditProjectV3 } from '../model/schema';
import {
  DEFAULT_EDITOR_SESSION,
  sanitizeEditorSession,
  type EditorSessionState,
} from '../model/session';
import { parseMobileEditProject } from '../model/validation';
import type { DraftEnvelope } from '../persistence/draftRepository';
import { LocalDraftRepository } from '../persistence/draftRepository';

export interface EditorControllerState {
  document: MobileEditProjectV3;
  revision: number;
  dirty: boolean;
  saving: boolean;
  saveError: Error | null;
  canUndo: boolean;
  canRedo: boolean;
  session: EditorSessionState;
}

type Listener = (state: EditorControllerState) => void;

export class MobileEditorController {
  private readonly history: EditorCommandHistory;
  private readonly listeners = new Set<Listener>();
  private autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  private state: EditorControllerState;
  private saveChain: Promise<DraftEnvelope | null> = Promise.resolve(null);

  constructor(
    document: MobileEditProjectV3,
    private readonly repository: LocalDraftRepository,
    revision = 0,
    historyLimit = 100,
    private readonly autosaveDelayMs = 400,
    session: EditorSessionState = DEFAULT_EDITOR_SESSION,
  ) {
    this.history = new EditorCommandHistory(historyLimit);
    this.state = {
      document: parseMobileEditProject(document),
      revision,
      dirty: false,
      saving: false,
      saveError: null,
      canUndo: false,
      canRedo: false,
      session: sanitizeEditorSession(document, session),
    };
  }

  get snapshot(): EditorControllerState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  commit(command: EditorCommand): boolean {
    const result = this.history.commit(this.state.document, command);
    if (!result.changed) return false;
    this.updateDocument(result.document);
    return true;
  }

  applySystemCommand(command: EditorCommand): boolean {
    const document = command.apply(this.state.document);
    if (document === this.state.document) return false;
    this.updateDocument(document);
    return true;
  }

  undo(): boolean {
    const result = this.history.undo(this.state.document);
    if (!result.changed) return false;
    this.updateDocument(result.document);
    return true;
  }

  redo(): boolean {
    const result = this.history.redo(this.state.document);
    if (!result.changed) return false;
    this.updateDocument(result.document);
    return true;
  }

  updateSession(patch: Partial<EditorSessionState>): void {
    const session = sanitizeEditorSession(this.state.document, {
      ...this.state.session,
      ...patch,
    });
    if (
      session.playheadTick === this.state.session.playheadTick &&
      session.selection?.id === this.state.session.selection?.id &&
      session.selection?.kind === this.state.session.selection?.kind
    ) {
      return;
    }
    this.state = { ...this.state, session, dirty: true };
    this.emit();
    this.scheduleAutosave();
  }

  exportSnapshot(): MobileEditProjectV3 {
    return parseMobileEditProject(JSON.parse(JSON.stringify(this.state.document)));
  }

  scheduleAutosave(): void {
    if (this.autosaveTimer) clearTimeout(this.autosaveTimer);
    this.autosaveTimer = setTimeout(() => {
      this.autosaveTimer = null;
      void this.flush().catch(() => undefined);
    }, this.autosaveDelayMs);
  }

  async flush(): Promise<void> {
    if (this.autosaveTimer) {
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }
    if (!this.state.dirty) {
      await this.saveChain;
      return;
    }
    const sourceDocument = this.state.document;
    const sourceSession = this.state.session;
    const document = this.exportSnapshot();
    const expectedRevision = this.state.revision;
    this.state = { ...this.state, saving: true, saveError: null };
    this.emit();
    const saveTask = this.saveChain
      .catch(() => null)
      .then(() => this.repository.save(document, expectedRevision, sourceSession));
    this.saveChain = saveTask;
    try {
      const saved = await saveTask;
      if (!saved) return;
      const stillCurrent =
        this.state.document === sourceDocument && this.state.session === sourceSession;
      this.state = {
        ...this.state,
        revision: saved.revision,
        dirty: stillCurrent ? false : this.state.dirty,
        saving: false,
        saveError: null,
      };
    } catch (error) {
      this.state = {
        ...this.state,
        saving: false,
        dirty: true,
        saveError: error instanceof Error ? error : new Error(String(error)),
      };
      throw error;
    } finally {
      this.emit();
    }
  }

  async dispose(): Promise<void> {
    await this.flush();
    this.listeners.clear();
  }

  private updateDocument(document: MobileEditProjectV3): void {
    this.state = {
      ...this.state,
      document,
      session: sanitizeEditorSession(document, this.state.session),
      dirty: true,
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
    };
    this.emit();
    this.scheduleAutosave();
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.state);
  }
}
