import type { RootNode } from "./nodes/root-node";

export type PreviewScheduleMode = "playback" | "exact";

export type PreviewFrameRequest = {
	frameIndex: number;
	time: number;
	tree: RootNode;
	mode: PreviewScheduleMode;
};

type SchedulerDeps = {
	render: (request: PreviewFrameRequest, signal: AbortSignal) => Promise<void>;
	onPresented?: (request: PreviewFrameRequest, costMs: number) => void;
	onDropped?: (count: number) => void;
	onCoalesced?: (count: number) => void;
	onError?: (error: unknown) => void;
};

/**
 * Realtime preview policy. Composition remains serialized because transition
 * nodes temporarily swap the shared renderer context. Playback keeps only the
 * newest request; exact seeks supersede all in-flight work.
 */
export class PreviewFrameScheduler {
	private generation = 0;
	private active: PreviewFrameRequest | null = null;
	private activeController: AbortController | null = null;
	private pending: PreviewFrameRequest | null = null;
	private disposed = false;

	constructor(private readonly deps: SchedulerDeps) {}

	request(request: PreviewFrameRequest): void {
		if (this.disposed) return;

		if (request.mode === "exact") {
			this.invalidate();
			this.pending = request;
			void this.drain();
			return;
		}

		if (!this.active) {
			this.pending = request;
			void this.drain();
			return;
		}

		const previousPending = this.pending;
		this.pending = request;
		if (previousPending) {
			this.deps.onCoalesced?.(1);
			const skipped = Math.max(0, request.frameIndex - previousPending.frameIndex);
			if (skipped > 0) this.deps.onDropped?.(skipped);
		}

		// Do not let a decode that is multiple display frames late paint after the
		// clock. Aborting only prevents presentation; cache generations safely
		// finish or discard underlying decoder work.
		if (request.frameIndex > this.active.frameIndex + 1) {
			const skipped = request.frameIndex - this.active.frameIndex - 1;
			this.deps.onDropped?.(skipped);
			this.activeController?.abort();
		}
	}

	invalidate(): void {
		this.generation += 1;
		this.activeController?.abort();
		this.pending = null;
	}

	dispose(): void {
		this.disposed = true;
		this.invalidate();
	}

	private async drain(): Promise<void> {
		if (this.active || this.disposed) return;

		while (this.pending && !this.disposed) {
			const request = this.pending;
			this.pending = null;
			const generation = this.generation;
			const controller = new AbortController();
			this.active = request;
			this.activeController = controller;
			const startedAt = performance.now();

			try {
				await this.deps.render(request, controller.signal);
				if (
					!controller.signal.aborted &&
					generation === this.generation &&
					!this.disposed
				) {
					this.deps.onPresented?.(request, performance.now() - startedAt);
				}
			} catch (error) {
				if (!controller.signal.aborted) this.deps.onError?.(error);
			} finally {
				if (this.activeController === controller) {
					this.activeController = null;
				}
				this.active = null;
			}
		}
	}
}
