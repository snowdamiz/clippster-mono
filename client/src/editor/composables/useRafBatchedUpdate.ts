import { onUnmounted } from "vue";

/**
 * Coalesces high-frequency inspector input into at most one state mutation per
 * animation frame. Callers still commit through the command system, so undo
 * remains available while Vue/renderer/save invalidations stay bounded.
 */
export function useRafBatchedUpdate<T extends Record<string, unknown>>(
	commit: (updates: T) => void,
) {
	let pending: T | null = null;
	let frameId: number | null = null;

	function flush() {
		if (frameId !== null) {
			cancelAnimationFrame(frameId);
			frameId = null;
		}
		const updates = pending;
		pending = null;
		if (updates) commit(updates);
	}

	function update(updates: T) {
		pending = pending ? { ...pending, ...updates } : updates;
		if (frameId !== null) return;
		frameId = requestAnimationFrame(() => {
			frameId = null;
			const next = pending;
			pending = null;
			if (next) commit(next);
		});
	}

	onUnmounted(flush);

	return { update, flush };
}
