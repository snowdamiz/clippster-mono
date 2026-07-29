import type { EditorCore } from "../../core";

type SaveManagerOptions = {
	debounceMs?: number;
};

export type SaveState = {
	isDirty: boolean;
	isSaving: boolean;
	lastSavedAt: Date | null;
	error: string | null;
};

export class SaveManager {
	private debounceMs: number;
	private isPaused = false;
	private isSaving = false;
	private hasPendingSave = false;
	private lastSavedAt: Date | null = null;
	private error: string | null = null;
	private saveTimer: ReturnType<typeof setTimeout> | null = null;
	private unsubscribeHandlers: Array<() => void> = [];
	private listeners = new Set<() => void>();

	constructor(
		private editor: EditorCore,
		{ debounceMs = 800 }: SaveManagerOptions = {},
	) {
		this.debounceMs = debounceMs;
	}

	start(): void {
		if (this.unsubscribeHandlers.length > 0) return;

		this.unsubscribeHandlers = [
			this.editor.scenes.subscribe(() => {
				this.markDirty();
			}),
			this.editor.timeline.subscribe(() => {
				this.markDirty();
			}),
		];
	}

	stop(): void {
		for (const unsubscribe of this.unsubscribeHandlers) {
			unsubscribe();
		}
		this.unsubscribeHandlers = [];
		this.clearTimer();
	}

	pause(): void {
		this.isPaused = true;
	}

	resume(): void {
		this.isPaused = false;
		if (this.hasPendingSave) {
			this.queueSave();
		}
	}

	markDirty({ force = false }: { force?: boolean } = {}): void {
		if (this.isPaused && !force) return;
		this.hasPendingSave = true;
		this.error = null;
		this.notify();
		this.queueSave();
	}

	async flush(): Promise<void> {
		this.hasPendingSave = true;
		await this.saveNow();
	}

	getIsDirty(): boolean {
		return this.hasPendingSave || this.isSaving;
	}

	getState(): SaveState {
		return {
			isDirty: this.hasPendingSave,
			isSaving: this.isSaving,
			lastSavedAt: this.lastSavedAt,
			error: this.error,
		};
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private queueSave(): void {
		if (this.isSaving) return;
		if (this.saveTimer) {
			clearTimeout(this.saveTimer);
		}
		// Longer debounce during playback/range drags to reduce main-thread JSON serialization while preview runs.
		const playing = this.editor.playback.getIsPlaying();
		const interactive = this.editor.getInteractiveDrag();
		const ms = playing || interactive ? Math.max(this.debounceMs, 2000) : this.debounceMs;
		this.saveTimer = setTimeout(() => {
			void this.saveNow();
		}, ms);
	}

	private async saveNow(): Promise<void> {
		if (this.isSaving) return;
		if (!this.hasPendingSave) return;

		const activeProject = this.editor.project.getActiveOrNull();
		if (!activeProject) return;
		if (this.editor.project.getIsLoading()) return;
		if (this.editor.project.getMigrationState().isMigrating) return;

		this.isSaving = true;
		this.hasPendingSave = false;
		this.error = null;
		this.notify();
		this.clearTimer();

		try {
			await this.editor.project.saveCurrentProject();
			this.lastSavedAt = new Date();
		} catch (error) {
			this.error = error instanceof Error ? error.message : "Failed to save";
		} finally {
			this.isSaving = false;
			this.notify();
			if (this.hasPendingSave) {
				this.queueSave();
			}
		}
	}

	private clearTimer(): void {
		if (!this.saveTimer) return;
		clearTimeout(this.saveTimer);
		this.saveTimer = null;
	}

	private notify(): void {
		for (const listener of this.listeners) listener();
	}
}
