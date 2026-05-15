/**
 * Tiny rAF coalescer used by drag/resize/scrub paths.
 *
 * `mousemove` can fire 1000+ Hz on high-poll mice; we don't need that.
 * `schedule(fn)` queues `fn` to run at most once per animation frame, with the
 * latest call winning. The frame work writes DOM directly and never touches
 * Vue reactive state, so there is no risk of triggering a re-render storm.
 */
import { onUnmounted } from "vue";

export interface DragRaf {
	/** Queue work for the next animation frame. Latest call wins. */
	schedule: (work: () => void) => void;
	/** Cancel any pending frame and stop scheduling new ones. */
	flush: () => void;
}

export function useDragRaf(): DragRaf {
	let rafId: number | null = null;
	let pending: (() => void) | null = null;

	function tick() {
		rafId = null;
		const work = pending;
		pending = null;
		if (work) work();
	}

	function schedule(work: () => void) {
		pending = work;
		if (rafId !== null) return;
		rafId = requestAnimationFrame(tick);
	}

	function flush() {
		if (rafId !== null) {
			cancelAnimationFrame(rafId);
			rafId = null;
		}
		pending = null;
	}

	onUnmounted(flush);

	return { schedule, flush };
}
